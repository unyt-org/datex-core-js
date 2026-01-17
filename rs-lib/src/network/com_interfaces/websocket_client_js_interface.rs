use std::future::Future;
use std::ops::Deref;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use datex_core::network::com_hub::errors::InterfaceCreateError;
use datex_core::network::com_interfaces::com_interface::ComInterfaceProxy;
use datex_core::network::com_interfaces::com_interface::error::ComInterfaceError;
use datex_core::network::com_interfaces::com_interface::implementation::{ComInterfaceAsyncFactory, ComInterfaceSyncFactory};
use datex_core::network::com_interfaces::com_interface::properties::{InterfaceDirection, InterfaceProperties};
use datex_core::network::com_interfaces::com_interface::socket::ComInterfaceSocketUUID;
use datex_core::network::com_interfaces::com_interface::state::{ComInterfaceState, ComInterfaceStateWrapper};
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::{WebSocketClientInterfaceSetupData, WebSocketError};
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::parse_url;

use crate::wrap_error_for_js;
use datex_core::task::{spawn_with_panic_notify_default, UnboundedSender};
use futures::channel::mpsc;
use futures::{Sink, SinkExt, StreamExt};
use log::{error, info, warn};
use url::Url;
use wasm_bindgen::{JsCast, prelude::Closure};
use web_sys::{ErrorEvent, MessageEvent, js_sys};

wrap_error_for_js!(JSWebSocketError, datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::WebSocketError);
use datex_macros::{com_interface, create_opener};

struct WebSocketClientInterfaceSetupDataJS(WebSocketClientInterfaceSetupData);
impl Deref for WebSocketClientInterfaceSetupDataJS {
    type Target = WebSocketClientInterfaceSetupData;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl WebSocketClientInterfaceSetupDataJS {
    async fn create_interface(
        &self,
        proxy: ComInterfaceProxy,
    ) -> Result<InterfaceProperties, InterfaceCreateError> {
        let address =
            parse_url(&self.address).map_err(|e| InterfaceCreateError::invalid_setup_data(e))?;

        info!("Connecting to WebSocket server at {address}");

        let ws = web_sys::WebSocket::new(address.as_ref())
            .map_err(|e| {
                error!("Failed to create WebSocket: {:?}", e);
                InterfaceCreateError::InterfaceError(
                    ComInterfaceError::connection_error_with_details(
                        WebSocketError::ConnectionError,
                    ),
                )
            })?;

        ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

        let state = proxy.state.clone();

        let (mut sender, mut receiver) =
            mpsc::channel::<(ComInterfaceSocketUUID, UnboundedSender<Vec<u8>>)>(32); // buffer size of 32

        let open_callback = Closure::once(move |_: MessageEvent| {
            let (uuid, socket_sender) = proxy.create_and_init_socket(
                InterfaceDirection::InOut,
                1,
            );
            info!("WebSocket connection opened successfully");
            sender.start_send((uuid, socket_sender)).unwrap();
        });
        ws.set_onopen(Some(open_callback.as_ref().unchecked_ref()));
        info!("Waiting for WebSocket connection to open...");

        let (_, sender) = receiver.next().await.ok_or_else(|| {
            error!("Failed to receive onopen event");
            InterfaceCreateError::InterfaceError(ComInterfaceError::connection_error())
        })?;

        // handle incoming messages
        ws.set_onmessage(Some(
            Self::create_onmessage_callback(sender.clone())
                .as_ref()
                .unchecked_ref(),
        ));
        // handle socket close
        ws.set_onclose(Some(
            Self::create_onclose_callback(state.clone())
               .as_ref()
               .unchecked_ref(),
        ));
        // handle error (close the socket)
        ws.set_onerror(Some(
            Self::create_onclose_callback(state)
               .as_ref()
               .unchecked_ref(),
        ));

        Ok(Self::get_default_properties())
    }

    fn create_onmessage_callback(
        mut sender: UnboundedSender<Vec<u8>>
    ) -> Closure<dyn FnMut(MessageEvent)> {
        Closure::new(move |e: MessageEvent| {
            if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
                let array = js_sys::Uint8Array::new(&abuf);
                sender.start_send(array.to_vec()).unwrap()
            }
        })
    }

    fn create_onclose_callback(
        state: Arc<Mutex<ComInterfaceStateWrapper>>
    ) -> Closure<dyn FnMut()> {
        Closure::new(move || {
            warn!("Socket closed");
            state.lock().unwrap().set(ComInterfaceState::NotConnected);
        })
    }
}

impl ComInterfaceAsyncFactory for WebSocketClientInterfaceSetupDataJS {
    fn create_interface(
        &self,
        proxy: ComInterfaceProxy,
    ) -> Pin<
        Box<
            dyn Future<
                Output = Result<InterfaceProperties, InterfaceCreateError>,
            >,
        >,
    > {
        Box::pin(self.create_interface(proxy))
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
