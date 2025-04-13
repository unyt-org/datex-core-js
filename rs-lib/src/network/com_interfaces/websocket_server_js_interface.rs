use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
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
use datex_core::stdlib::{cell::RefCell, rc::Rc, sync::Arc};

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use log::{debug, error, info, warn};
use wasm_bindgen::{prelude::Closure, JsCast};
use web_sys::{js_sys, ErrorEvent, MessageEvent};

pub struct WebSocketServerJSInterface {
    pub sockets: HashMap<ComInterfaceSocketUUID, web_sys::WebSocket>,
    info: ComInterfaceInfo,
}

impl WebSocketServerJSInterface {
    pub async fn open() -> Result<WebSocketServerJSInterface, WebSocketError> {
        Ok(WebSocketServerJSInterface {
            info: ComInterfaceInfo::new_with_state(
                ComInterfaceState::Connected,
            ),
            sockets: HashMap::new(),
        })
    }

    pub fn register_socket(&mut self, web_socket: &web_sys::WebSocket) {
        let interface_uuid = self.get_uuid().clone();
        let socket = ComInterfaceSocket::new(
            interface_uuid,
            InterfaceDirection::IN_OUT,
            1,
        );
        let socket_uuid = socket.uuid.clone();
        let sockets = self.get_sockets();
        let mut sockets = sockets.lock().unwrap();
        sockets
            .sockets
            .insert(socket_uuid.clone(), Arc::new(Mutex::new(socket)));

        web_socket.set_onmessage(Some(
            &self
                .create_onmessage_callback(socket_uuid.clone())
                .as_ref()
                .unchecked_ref(),
        ));
        web_socket.set_onerror(Some(
            &self
                .create_onerror_callback(socket_uuid.clone())
                .as_ref()
                .unchecked_ref(),
        ));
        web_socket.set_onclose(Some(
            &self
                .create_onclose_callback(socket_uuid.clone())
                .as_ref()
                .unchecked_ref(),
        ));
    }

    pub fn get_socket(&self) -> Option<Arc<Mutex<ComInterfaceSocket>>> {
        return self
            .get_sockets()
            .lock()
            .unwrap()
            .sockets
            .values()
            .next()
            .cloned();
    }

    pub fn get_socket_uuid(&self) -> Option<ComInterfaceSocketUUID> {
        self.get_socket().map(|s| s.lock().unwrap().uuid.clone())
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
            debug!("Sending block: {:?}", block);
            self.sockets
                .get(&socket_uuid)
                .ok_or_else(|| {
                    error!("Socket not found: {:?}", socket_uuid);
                    WebSocketError::SendError
                })
                .and_then(|socket| {
                    socket.send_with_u8_array(block).map_err(|e| {
                        error!("Error sending message: {:?}", e);
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

    delegate_com_interface_info!();
}
