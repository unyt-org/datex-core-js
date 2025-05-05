use std::cell::RefCell;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use datex_core::{delegate_com_interface_info, set_opener};
use datex_core::network::com_interfaces::com_interface::{ComInterface, ComInterfaceError, ComInterfaceFactory, ComInterfaceInfo, ComInterfaceSockets, ComInterfaceUUID};
use datex_core::network::com_interfaces::com_interface_properties::{
    InterfaceDirection, InterfaceProperties,
};
use datex_core::network::com_interfaces::com_interface_socket::{
    ComInterfaceSocket, ComInterfaceSocketUUID,
};
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::{WebSocketClientInterfaceSetupData, WebSocketError};
use datex_core::network::com_interfaces::socket_provider::SingleSocketProvider;
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::parse_url;

use crate::{define_registry, wrap_error_for_js};
use datex_core::network::com_hub::InterfacePriority;
use futures::channel::oneshot;
use log::{error, info, warn};
use url::Url;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::{prelude::Closure, JsCast};
use wasm_bindgen::{JsError, JsValue};
use web_sys::{js_sys, ErrorEvent, MessageEvent};

pub struct WebSocketClientJSInterface {
    pub address: Url,
    pub ws: web_sys::WebSocket,
    info: ComInterfaceInfo,
}

impl SingleSocketProvider for WebSocketClientJSInterface {
    fn provide_sockets(&self) -> Arc<Mutex<ComInterfaceSockets>> {
        self.get_sockets().clone()
    }
}
wrap_error_for_js!(JSWebSocketError, datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::WebSocketError);
use datex_macros::{com_interface, create_opener};
#[com_interface]
impl WebSocketClientJSInterface {
    pub fn new(
        address: &str,
    ) -> Result<WebSocketClientJSInterface, WebSocketError> {
        let address =
            parse_url(address).map_err(|_| WebSocketError::InvalidURL)?;
        let ws = web_sys::WebSocket::new(address.as_ref())
            .map_err(|_| WebSocketError::InvalidURL)?;
        let interface = WebSocketClientJSInterface {
            address,
            info: ComInterfaceInfo::new(),
            ws,
        };
        Ok(interface)
    }

    #[create_opener]
    async fn open(&mut self) -> Result<(), WebSocketError> {
        let address = self.address.clone();
        info!("Connecting to WebSocket server at {address}");

        self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

        let message_callback = self.create_onmessage_callback();
        let error_callback = self.create_onerror_callback();
        let (sender, receiver) = oneshot::channel::<()>();
        let uuid = self.get_uuid().clone();
        let com_interface_sockets = self.get_sockets().clone();
        let open_callback = Closure::once(move |_: MessageEvent| {
            let socket = ComInterfaceSocket::new(
                uuid.clone(),
                InterfaceDirection::InOut,
                1,
            );
            com_interface_sockets
                .lock()
                .unwrap()
                .add_socket(Arc::new(Mutex::new(socket)));
            sender.send(()).expect("Failed to send onopen event");
        });
        let close_callback = self.create_onclose_callback();

        self.ws
            .set_onmessage(Some(message_callback.as_ref().unchecked_ref()));
        self.ws
            .set_onerror(Some(error_callback.as_ref().unchecked_ref()));

        self.ws
            .set_onclose(Some(close_callback.as_ref().unchecked_ref()));
        self.ws
            .set_onopen(Some(open_callback.as_ref().unchecked_ref()));
        receiver.await.map_err(|_| {
            error!("Failed to receive onopen event");
            WebSocketError::Other("Failed to receive onopen event".to_string())
        })?;

        message_callback.forget();
        error_callback.forget();
        open_callback.forget();
        close_callback.forget();
        Ok(())
    }

    fn create_onmessage_callback(
        &mut self,
    ) -> Closure<dyn FnMut(MessageEvent)> {
        let sockets = self.get_sockets().clone();
        Closure::new(move |e: MessageEvent| {
            let sockets = sockets.clone();
            let sockets = sockets.lock().unwrap();
            let socket = sockets.sockets.values().next().unwrap();

            let receive_queue = socket.lock().unwrap().receive_queue.clone();
            if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
                let array = js_sys::Uint8Array::new(&abuf);
                receive_queue.lock().unwrap().extend(array.to_vec());
                info!(
                    "message event, received: {:?} bytes ({:?})",
                    array.to_vec().len(),
                    receive_queue
                );
            }
        })
    }

    fn create_onerror_callback(&self) -> Closure<dyn FnMut(ErrorEvent)> {
        Closure::new(move |e: ErrorEvent| {
            error!("Socket error event: {:?}", e.message());
        })
    }

    fn create_onclose_callback(&self) -> Closure<dyn FnMut()> {
        let state = self.get_info().state.clone();
        Closure::new(move || {
            warn!("Socket closed");
            state.lock().unwrap().set(ComInterfaceState::NotConnected);
        })
    }
}

impl ComInterfaceFactory<WebSocketClientInterfaceSetupData>
    for WebSocketClientJSInterface
{
    fn create(
        setup_data: WebSocketClientInterfaceSetupData,
    ) -> Result<WebSocketClientJSInterface, ComInterfaceError> {
        WebSocketClientJSInterface::new(&setup_data.address)
            .map_err(|_| ComInterfaceError::InvalidSetupData)
    }

    fn get_default_properties() -> InterfaceProperties {
        InterfaceProperties {
            interface_type: "websocket-client".to_string(),
            channel: "websocket".to_string(),
            round_trip_time: Duration::from_millis(40),
            max_bandwidth: 1000,
            ..InterfaceProperties::default()
        }
    }
}

impl ComInterface for WebSocketClientJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        _: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move {
            self.ws
                .send_with_u8_array(block)
                .map_err(|e| {
                    error!("Error sending message: {e:?}");
                    false
                })
                .is_ok()
        })
    }

    fn init_properties(&self) -> InterfaceProperties {
        Self::get_default_properties()
    }
    fn handle_close<'a>(
        &'a mut self,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move { self.ws.close().is_ok() })
    }
    delegate_com_interface_info!();
    set_opener!(open);
}

define_registry!(WebSocketClientRegistry, WebSocketClientJSInterface);

#[wasm_bindgen]
impl WebSocketClientRegistry {
    pub async fn register(
        &self,
        address: String,
    ) -> Result<String, JSWebSocketError> {
        let com_hub = self.com_hub.clone();
        let address_clone = address.clone();
        let mut websocket_interface =
            WebSocketClientJSInterface::new(&address_clone)?;
        websocket_interface
            .open()
            .await
            .map_err(JSWebSocketError::from)?;
        let interface_uuid = websocket_interface.get_uuid().clone();
        let websocket_interface = Rc::new(RefCell::new(websocket_interface));

        com_hub
            .add_interface(
                websocket_interface.clone(),
                InterfacePriority::default(),
            )
            .map_err(|e| WebSocketError::Other(format!("{e:?}")))?;
        Ok(interface_uuid.0.to_string())
    }
}
