use std::cell::RefCell;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use datex_core::delegate_com_interface_info;
use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceInfo, ComInterfaceSockets, ComInterfaceUUID,
};
use datex_core::network::com_interfaces::com_interface_properties::{
    InterfaceDirection, InterfaceProperties,
};
use datex_core::network::com_interfaces::com_interface_socket::{
    ComInterfaceSocket, ComInterfaceSocketUUID,
};
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::WebSocketError;
use datex_core::network::com_interfaces::socket_provider::MultipleSocketProvider;
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use datex_core::utils::uuid::UUID;
use log::{debug, error, info};
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::{prelude::Closure, JsCast};
use wasm_bindgen::{JsError, JsValue};
use web_sys::{js_sys, ErrorEvent, MessageEvent};

use crate::{define_registry, wrap_error_for_js};

pub struct WebSocketServerJSInterface {
    sockets: HashMap<ComInterfaceSocketUUID, web_sys::WebSocket>,
    info: ComInterfaceInfo,
}
impl MultipleSocketProvider for WebSocketServerJSInterface {
    fn provide_sockets(&self) -> Arc<Mutex<ComInterfaceSockets>> {
        self.get_sockets().clone()
    }
}

wrap_error_for_js!(JSWebSocketServerError, datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::WebSocketServerError);

impl WebSocketServerJSInterface {
    pub fn open() -> Result<WebSocketServerJSInterface, JSWebSocketServerError>
    {
        Ok(WebSocketServerJSInterface {
            info: ComInterfaceInfo::new_with_state(
                ComInterfaceState::Connected,
            ),
            sockets: HashMap::new(),
        })
    }

    pub fn register_socket(
        &mut self,
        web_socket: web_sys::WebSocket,
    ) -> ComInterfaceSocketUUID {
        let interface_uuid = self.get_uuid().clone();
        let socket = ComInterfaceSocket::new(
            interface_uuid,
            InterfaceDirection::InOut,
            1,
        );
        let socket_uuid = socket.uuid.clone();
        let sockets = self.get_sockets();
        let mut sockets = sockets.lock().unwrap();
        sockets
            .sockets
            .insert(socket_uuid.clone(), Arc::new(Mutex::new(socket)));
        web_socket.set_binary_type(web_sys::BinaryType::Arraybuffer);

        let on_message = self.create_onmessage_callback(socket_uuid.clone());
        web_socket.set_onmessage(Some(on_message.as_ref().unchecked_ref()));

        let on_error = self.create_onerror_callback(socket_uuid.clone());
        web_socket.set_onerror(Some(on_error.as_ref().unchecked_ref()));

        let on_close = self.create_onclose_callback(socket_uuid.clone());
        web_socket.set_onclose(Some(on_close.as_ref().unchecked_ref()));

        on_message.forget();
        on_error.forget();
        on_close.forget();
        self.sockets.insert(socket_uuid.clone(), web_socket);
        socket_uuid
    }

    fn create_onmessage_callback(
        &mut self,
        socket_uuid: ComInterfaceSocketUUID,
    ) -> Closure<dyn FnMut(MessageEvent)> {
        let sockets = self.get_sockets().clone();
        Closure::new(move |e: MessageEvent| {
            let sockets = sockets.clone();
            let sockets = sockets.lock().unwrap();
            let socket = sockets.sockets.get(&socket_uuid).unwrap();
            let receive_queue = socket.lock().unwrap().receive_queue.clone();
            if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
                let array = js_sys::Uint8Array::new(&abuf);
                receive_queue.lock().unwrap().extend(array.to_vec());
                info!(
                    "message event, received: {:?} bytes ({:?})",
                    array.to_vec().len(),
                    receive_queue
                );
            } else {
                info!("message event, received Unknown: {:?}", e.data());
            }
        })
    }

    fn create_onerror_callback(
        &self,
        socket_uuid: ComInterfaceSocketUUID,
    ) -> Closure<dyn FnMut(ErrorEvent)> {
        Closure::new(move |e: ErrorEvent| {
            error!("Socket error event: {:?} {}", e.message(), socket_uuid);
        })
    }

    fn create_onclose_callback(
        &mut self,
        socket_uuid: ComInterfaceSocketUUID,
    ) -> Closure<dyn FnMut()> {
        let sockets = self.get_sockets().clone();
        Closure::new(move || {
            let mut sockets = sockets.lock().unwrap();
            sockets.sockets.remove(&socket_uuid);
        })
    }
}

impl ComInterface for WebSocketServerJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        socket_uuid: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move {
            debug!("Sending block: {block:?}");
            self.sockets
                .get(&socket_uuid)
                .ok_or_else(|| {
                    error!("Socket not found: {socket_uuid:?}");
                    WebSocketError::SendError
                })
                .and_then(|socket| {
                    socket.send_with_u8_array(block).map_err(|e| {
                        error!("Error sending message: {e:?}");
                        WebSocketError::SendError
                    })
                })
                .is_ok()
        })
    }

    fn init_properties(&self) -> InterfaceProperties {
        InterfaceProperties {
            channel: "websocket".to_string(),
            round_trip_time: Duration::from_millis(40),
            max_bandwidth: 1000,
            ..InterfaceProperties::default()
        }
    }
    fn close<'a>(&'a mut self) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        for (_, socket) in self.sockets.iter() {
            // FIXME
            // Do we have to remove the event listeners here
            // or is this done automatically when the socket is closed?
            let _ = socket.close().is_ok();
        }
        Box::pin(async move { true })
    }
    delegate_com_interface_info!();
}

define_registry!(WebSocketServerRegistry);

#[wasm_bindgen]
impl WebSocketServerRegistry {
    pub fn register(&self) -> Result<String, JsError> {
        let com_hub = self.com_hub.clone();
        let websocket_interface = WebSocketServerJSInterface::open()?;
        let uuid = websocket_interface.get_uuid().clone();

        let mut com_hub = com_hub.lock().unwrap();
        com_hub
            .add_interface(Rc::new(RefCell::new(websocket_interface)))
            .map_err(|e| JsError::new(&format!("{e:?}")))?;
        Ok(uuid.0.to_string())
    }
    pub fn add_socket(
        &self,
        interface_uuid: String,
        websocket: web_sys::WebSocket,
    ) -> JsValue {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));

        let com_hub = self.com_hub.clone();
        let com_hub = com_hub.lock().unwrap();
        let interface = com_hub
            .get_interface_by_uuid_mut::<WebSocketServerJSInterface>(
                &interface_uuid,
            );
        if interface.is_some() {
            let uuid = interface.unwrap().register_socket(websocket);
            JsValue::from_str(&uuid.0.to_string())
        } else {
            error!("Failed to find WebSocket interface");
            JsError::new("Failed to find WebSocket interface").into()
        }
    }
}
