use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use datex_core::network::com_hub::errors::InterfaceCreateError;
use datex_core::network::com_hub::managers::interface_manager::ComInterfaceAsyncFactoryResult;
use datex_core::network::com_interfaces::com_interface::implementation::ComInterfaceAsyncFactory;
use datex_core::network::com_interfaces::com_interface::properties::{
    InterfaceDirection, InterfaceProperties,
};
use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceProxy,
};

use datex_core::network::com_interfaces::com_interface::socket::{
    ComInterfaceSocket, ComInterfaceSocketUUID,
};
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::{WebSocketClientInterfaceSetupData, WebSocketError};
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::state::ComInterfaceState;
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::parse_url;
use serde::{Deserialize, Serialize};

use crate::wrap_error_for_js;
use datex_core::task::{
    UnboundedReceiver, UnboundedSender, create_bounded_channel,
    create_unbounded_channel, spawn_with_panic_notify,
    spawn_with_panic_notify_default,
};
use futures::channel::mpsc;
use futures::{SinkExt, StreamExt};
use log::{error, info, warn};
use url::Url;
use wasm_bindgen::{JsCast, prelude::Closure};
use web_sys::{ErrorEvent, MessageEvent, js_sys};

wrap_error_for_js!(JSWebSocketError, datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::WebSocketError);

#[derive(Debug, Serialize, Deserialize)]
pub struct WebSocketClientJSInterfaceSetupData(
    WebSocketClientInterfaceSetupData,
);

impl WebSocketClientJSInterfaceSetupData {
    async fn create_interface(
        self,
        com_interface_proxy: ComInterfaceProxy,
    ) -> Result<InterfaceProperties, InterfaceCreateError> {
        let (address, write, read) =
            self.create_websocket_client_connection().await?;

        todo!(); // TODO: Implement the interface creation logic
        // let (_, sender) = com_interface_proxy
        //     .create_and_init_socket(InterfaceDirection::InOut, 1);

        // let state = com_interface_proxy.state;

        // spawn_with_panic_notify(
        //     &com_interface_proxy.async_context,
        //     Self::read_task(read, sender, state.clone()),
        // );

        // spawn_with_panic_notify(
        //     &com_interface_proxy.async_context,
        //     Self::event_handler_task(
        //         write,
        //         com_interface_proxy.event_receiver,
        //         state,
        //     ),
        // );
    }

    async fn create_websocket_client_connection(
        &self,
    ) -> Result<
        (Url, UnboundedSender<Vec<u8>>, UnboundedReceiver<Vec<u8>>),
        InterfaceCreateError,
    > {
        let address = parse_url(&self.0.address).map_err(|e| {
            InterfaceCreateError::InvalidSetupData(e.to_string())
        })?;
        let ws = web_sys::WebSocket::new(address.as_ref()).map_err(
            |_: wasm_bindgen::JsValue| {
                InterfaceCreateError::InterfaceOpenFailed
            },
        )?;
        ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
        let (mut write_sender, write_receiver) =
            create_unbounded_channel::<Vec<u8>>();
        let (mut read_sender, read_receiver) =
            create_unbounded_channel::<Vec<u8>>();
        todo!(); // TODO: Implement the WebSocket event handlers
        // let onmessage_callback = Closure::new(move |e: MessageEvent| {
        //     if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
        //         let array = js_sys::Uint8Array::new(&abuf);
        //         let mut data = vec![0; array.byte_length() as usize];
        //         array.copy_to(&mut data[..]);
        //         let mut read_sender = read_sender.clone();
        //         read_sender
        //             .start_send(data)
        //             .expect("Failed to send received data");
        //     }
        // });
        // ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
        // onmessage_callback.forget();
        // let onerror_callback = Closure::new(move |e: ErrorEvent| {
        //     error!("WebSocket error event: {:?}", e.message());
        // });
        // ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
        // onerror_callback.forget();
        // let onopen_callback = Closure::once(move |_: MessageEvent| {
        //     info!("WebSocket connection opened successfully");
        // });
        // ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
        // onopen_callback.forget();
        // let ws_clone = ws.clone();
        // spawn_with_panic_notify_default(async move {
        //     let mut write_receiver = write_receiver;
        //     while let Some(data) = write_receiver.next().await {
        //         if let Err(e) = ws_clone.send_with_u8_array(&data) {
        //             error!("Error sending WebSocket message: {e:?}");
        //         }
        //     }
        // });
        // Ok((address, write_sender, read_receiver))
    }
}

impl ComInterfaceAsyncFactory for WebSocketClientJSInterfaceSetupData {
    fn create_interface(
        self,
        com_interface_proxy: ComInterfaceProxy,
    ) -> ComInterfaceAsyncFactoryResult {
        todo!()
    }

    fn get_default_properties() -> InterfaceProperties {
        todo!()
    }
}

// #[com_interface]
// impl WebSocketClientJSInterface {
//     pub fn new(
//         address: &str,
//     ) -> Result<WebSocketClientJSInterface, WebSocketError> {
//         let address =
//             parse_url(address, true).map_err(|_| WebSocketError::InvalidURL)?;
//         let ws = web_sys::WebSocket::new(address.as_ref())
//             .map_err(|_| WebSocketError::InvalidURL)?;
//         let interface = WebSocketClientJSInterface {
//             address,
//             info: ComInterfaceInfo::new(),
//             ws,
//         };
//         Ok(interface)
//     }

//     #[create_opener]
//     async fn open(&mut self) -> Result<(), WebSocketError> {
//         let address = self.address.clone();
//         info!("Connecting to WebSocket server at {address}");

//         self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

//         let (mut sender, mut receiver) =
//             mpsc::channel::<Result<(), WebSocketError>>(32); // buffer size of 32

//         let message_callback = self.create_onmessage_callback();
//         let error_callback = self.create_onerror_callback(sender.clone());

//         let uuid = self.get_uuid().clone();
//         let com_interface_sockets = self.get_sockets().clone();
//         let open_callback = Closure::once(move |_: MessageEvent| {
//             let socket = ComInterfaceSocket::new(
//                 uuid.clone(),
//                 InterfaceDirection::InOut,
//                 1,
//             );
//             com_interface_sockets
//                 .lock()
//                 .unwrap()
//                 .add_socket(Arc::new(Mutex::new(socket)));
//             info!("WebSocket connection opened successfully");
//             spawn_with_panic_notify_default(async move {
//                 sender
//                     .send(Ok(()))
//                     .await
//                     .expect("Failed to send onopen event");
//             });
//         });
//         let close_callback = self.create_onclose_callback();

//         self.ws
//             .set_onmessage(Some(message_callback.as_ref().unchecked_ref()));
//         self.ws
//             .set_onerror(Some(error_callback.as_ref().unchecked_ref()));

//         self.ws
//             .set_onclose(Some(close_callback.as_ref().unchecked_ref()));
//         self.ws
//             .set_onopen(Some(open_callback.as_ref().unchecked_ref()));

//         info!("Waiting for WebSocket connection to open...");
//         /* receiver.recv().await.map_err(|_| {
//             error!("Failed to receive onopen event");
//             WebSocketError::Other("Failed to receive onopen event".to_string())
//         })?;*/
//         receiver.next().await.ok_or_else(|| {
//             error!("Failed to receive onopen event");
//             WebSocketError::Other("Failed to receive onopen event".to_string())
//         })??;

//         message_callback.forget();
//         error_callback.forget();
//         open_callback.forget();
//         close_callback.forget();
//         Ok(())
//     }

//     fn create_onmessage_callback(
//         &mut self,
//     ) -> Closure<dyn FnMut(MessageEvent)> {
//         let sockets = self.get_sockets().clone();
//         Closure::new(move |e: MessageEvent| {
//             let sockets = sockets.clone();
//             let sockets = sockets.lock().unwrap();
//             let socket = sockets.sockets.values().next().unwrap();

//             let receive_queue = socket.lock().unwrap().receive_queue.clone();
//             if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
//                 let array = js_sys::Uint8Array::new(&abuf);
//                 receive_queue.lock().unwrap().extend(array.to_vec());
//             }
//         })
//     }

//     fn create_onerror_callback(
//         &self,
//         sender: mpsc::Sender<Result<(), WebSocketError>>,
//     ) -> Closure<dyn FnMut(ErrorEvent)> {
//         Closure::new(move |e: ErrorEvent| {
//             error!("Socket error event: {:?}", e.message());
//             let mut sender = sender.clone();
//             spawn_with_panic_notify_default(async move {
//                 sender
//                     .send(Err(WebSocketError::ConnectionError))
//                     .await
//                     .expect("Failed to send onerror event");
//             })
//         })
//     }

//     fn create_onclose_callback(&self) -> Closure<dyn FnMut()> {
//         let state = self.get_info().state.clone();
//         Closure::new(move || {
//             warn!("Socket closed");
//             state.lock().unwrap().set(ComInterfaceState::NotConnected);
//         })
//     }
// }

// impl ComInterfaceFactory<WebSocketClientInterfaceSetupData>
//     for WebSocketClientJSInterface
// {
//     fn create(
//         setup_data: WebSocketClientInterfaceSetupData,
//     ) -> Result<WebSocketClientJSInterface, ComInterfaceError> {
//         WebSocketClientJSInterface::new(&setup_data.address)
//             .map_err(|_| ComInterfaceError::InvalidSetupData)
//     }

//     fn get_default_properties() -> InterfaceProperties {
//         InterfaceProperties {
//             interface_type: "websocket-client".to_string(),
//             channel: "websocket".to_string(),
//             round_trip_time: Duration::from_millis(40),
//             max_bandwidth: 1000,
//             ..InterfaceProperties::default()
//         }
//     }
// }

// impl ComInterface for WebSocketClientJSInterface {
//     fn send_block<'a>(
//         &'a mut self,
//         block: &'a [u8],
//         _: ComInterfaceSocketUUID,
//     ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
//         Box::pin(async move {
//             self.ws
//                 .send_with_u8_array(block)
//                 .map_err(|e| {
//                     error!("Error sending message: {e:?}");
//                     false
//                 })
//                 .is_ok()
//         })
//     }

//     fn init_properties(&self) -> InterfaceProperties {
//         InterfaceProperties {
//             name: Some(self.address.to_string()),
//             ..Self::get_default_properties()
//         }
//     }
//     fn handle_close<'a>(
//         &'a mut self,
//     ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
//         Box::pin(async move { self.ws.close().is_ok() })
//     }
//     delegate_com_interface_info!();
//     set_opener!(open);
// }
