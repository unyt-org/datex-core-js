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
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::parse_url;

use log::{debug, error, info};
use tokio::sync::oneshot;
use url::Url;
use wasm_bindgen::{prelude::Closure, JsCast};
use web_sys::{js_sys, ErrorEvent, MessageEvent};

pub struct WebSocketClientJSInterface {
    pub address: Url,
    pub ws: web_sys::WebSocket,
    info: ComInterfaceInfo,
}

impl WebSocketClientJSInterface {
    pub async fn open(
        address: &str,
    ) -> Result<WebSocketClientJSInterface, WebSocketError> {
        let address =
            parse_url(address).map_err(|_| WebSocketError::InvalidURL)?;

        let ws = web_sys::WebSocket::new(address.as_ref())
            .map_err(|_| WebSocketError::ConnectionError)?;

        let mut interface = WebSocketClientJSInterface {
            address,
            info: ComInterfaceInfo::new(),
            ws,
        };
        interface.start().await?;
        Ok(interface)
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

    async fn start(&mut self) -> Result<(), WebSocketError> {
        let address = self.address.clone();
        info!(
            "Connecting to WebSocket server at {}",
            address.host_str().unwrap()
        );

        self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

        let message_callback = self.create_onmessage_callback();
        let error_callback = self.create_onerror_callback();
        let (sender, receiver) = oneshot::channel::<()>();
        let uuid = self.get_uuid().clone();
        let com_interface_sockets = self.get_sockets().clone();
        let state = self.get_info().get_state();
        let open_callback = Closure::once(move |_: MessageEvent| {
            info!("Socket opened");
            com_interface_sockets.lock().unwrap().add_socket(Arc::new(
                Mutex::new(ComInterfaceSocket::new(
                    uuid.clone(),
                    InterfaceDirection::IN_OUT,
                    1,
                )),
            ));
            state
                .lock()
                .unwrap()
                .set_state(ComInterfaceState::Connected);
            sender.send(()).unwrap_or_else(|_| {
                error!("Failed to send onopen event");
            });
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
            } else {
                info!("message event, received Unknown: {:?}", e.data());
            }
        })
    }

    fn create_onerror_callback(&self) -> Closure<dyn FnMut(ErrorEvent)> {
        Closure::new(move |e: ErrorEvent| {
            error!("Socket error event: {:?}", e.message());
        })
    }

    fn create_onclose_callback(&self) -> Closure<dyn FnMut()> {
        let state = self.get_info().get_state();
        Closure::new(move || {
            state.lock().unwrap().set_state(ComInterfaceState::Closed);
        })
    }
}

impl ComInterface for WebSocketClientJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        _: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move {
            debug!("Sending block: {:?}", block);
            self.ws
                .send_with_u8_array(block)
                .map_err(|e| {
                    error!("Error sending message: {:?}", e);
                    false
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
