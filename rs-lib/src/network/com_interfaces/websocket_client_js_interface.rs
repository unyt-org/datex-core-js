use futures_channel::oneshot;
use gloo_timers::future::TimeoutFuture;
use std::{
    cell::RefCell, future::Future, pin::Pin, rc::Rc, sync::Mutex,
    time::Duration,
}; // FIXME no-std

use datex_core::{
    network::{
        com_hub::{
            errors::InterfaceCreateError,
            managers::interface_manager::ComInterfaceAsyncFactoryResult,
        },
        com_interfaces::com_interface::{
            ComInterface, ComInterfaceEvent, ComInterfaceProxy,
            error::ComInterfaceError,
            implementation::ComInterfaceAsyncFactory,
            properties::{InterfaceDirection, InterfaceProperties},
            state::ComInterfaceStateWrapper,
        },
    },
    runtime::AsyncContext,
};

use datex_core::{
    network::com_interfaces::{
        com_interface::socket::{ComInterfaceSocket, ComInterfaceSocketUUID},
        default_com_interfaces::websocket::websocket_common::{
            WebSocketClientInterfaceSetupData, WebSocketError,
        },
    },
    stdlib::sync::Arc,
};

use datex_core::network::com_interfaces::{
    com_interface::state::ComInterfaceState,
    default_com_interfaces::websocket::websocket_common::parse_url,
};
use serde::{Deserialize, Serialize};

use crate::wrap_error_for_js;
use datex_core::task::{
    UnboundedReceiver, UnboundedSender, create_bounded_channel,
    create_unbounded_channel, spawn_with_panic_notify,
    spawn_with_panic_notify_default,
};
use futures::{SinkExt, StreamExt, channel::mpsc};
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
    const OPEN_TIMEOUT_MS: Duration = Duration::from_secs(15);
    const MAX_RECONNECTS: usize = 5;
    const RECONNECT_BACKOFF_MS: Duration = Duration::from_secs(5);

    async fn create_interface(
        self,
        com_interface_proxy: ComInterfaceProxy,
    ) -> Result<InterfaceProperties, InterfaceCreateError> {
        let address = parse_url(&self.0.address).map_err(|e| {
            InterfaceCreateError::InvalidSetupData(e.to_string())
        })?;
        let state = com_interface_proxy.state.clone();

        let ws = Self::create_websocket_client_connection(
            address.clone(),
            state.clone(),
        )
        .await?;

        let (_, incoming_tx) = com_interface_proxy
            .create_and_init_socket(InterfaceDirection::InOut, 1);

        let async_context = com_interface_proxy.async_context;
        spawn_with_panic_notify_default(Self::reconnect_task(
            address.clone(),
            com_interface_proxy.event_receiver,
            state,
            incoming_tx,
        ));

        Ok(InterfaceProperties {
            name: Some(address.to_string()),
            ..Self::get_default_properties()
        })
    }

    async fn reconnect_task(
        address: Url,
        event_receiver: UnboundedReceiver<ComInterfaceEvent>,
        state: Arc<Mutex<ComInterfaceStateWrapper>>,
        incoming_tx: UnboundedSender<Vec<u8>>,
    ) {
        let ws = Self::create_websocket_client_connection(
            address.clone(),
            state.clone(),
        )
        .await?;
        let shutdown_signal =
            state.try_lock().unwrap().shutdown_signal().clone();

        let (close_tx, close_rx) = oneshot::channel::<()>();
        spawn_with_panic_notify_default(Self::read_task(
            ws.clone(),
            incoming_tx,
            Some(close_tx),
        ));
        spawn_with_panic_notify_default(Self::event_handler_task(
            ws.clone(),
            event_receiver,
            state,
        ));
    }

    async fn event_handler_task(
        ws: web_sys::WebSocket,
        mut receiver: UnboundedReceiver<ComInterfaceEvent>,
        state: Arc<Mutex<ComInterfaceStateWrapper>>,
    ) {
        while let Some(event) = receiver.next().await {
            match event {
                ComInterfaceEvent::SendBlock(block, uuid) => {
                    let bytes = block.to_bytes();
                    ws.send_with_u8_array(bytes.as_slice())
                        .expect("Failed to send data to WebSocket writer task");
                }

                ComInterfaceEvent::Destroy => {
                    let _ = ws.close();
                    break;
                }

                _ => {
                    todo!()
                }
            }
        }
    }

    async fn create_websocket_client_connection(
        address: Url,
        state: Arc<Mutex<ComInterfaceStateWrapper>>,
    ) -> Result<web_sys::WebSocket, InterfaceCreateError> {
        let ws = web_sys::WebSocket::new(address.as_ref()).map_err(
            |_: wasm_bindgen::JsValue| {
                InterfaceCreateError::InterfaceOpenFailed
            },
        )?;
        ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
        let (open_tx, open_rx) = oneshot::channel::<()>();
        let (fail_tx, fail_rx) = oneshot::channel::<InterfaceCreateError>();

        let open_cell = Rc::new(RefCell::new(Some(open_tx)));
        let fail_cell = Rc::new(RefCell::new(Some(fail_tx)));

        // onopen
        {
            let open_cell = Rc::clone(&open_cell);
            let onopen = Closure::once(move |_e: web_sys::Event| {
                if let Some(tx) = open_cell.borrow_mut().take() {
                    let _ = tx.send(());
                }
            });
            ws.set_onopen(Some(onopen.as_ref().unchecked_ref()));
            onopen.forget();
        }

        // onerror
        {
            let fail_cell = Rc::clone(&fail_cell);
            let onerror = Closure::once(move |e: web_sys::ErrorEvent| {
                if let Some(tx) = fail_cell.borrow_mut().take() {
                    let _ = tx.send(
                        ComInterfaceError::connection_error_with_details(
                            e.to_string(),
                        )
                        .into(),
                    );
                }
            });
            ws.set_onerror(Some(onerror.as_ref().unchecked_ref()));
            onerror.forget();
        }

        // onclose (before open)
        {
            let fail_cell = Rc::clone(&fail_cell);
            let onclose = Closure::once(move |_e: web_sys::Event| {
                if let Some(tx) = fail_cell.borrow_mut().take() {
                    let _ = tx.send(
                        ComInterfaceError::connection_error_with_details(
                            "Closed before open",
                        )
                        .into(),
                    );
                }
            });
            ws.set_onclose(Some(onclose.as_ref().unchecked_ref()));
            onclose.forget();
        }

        futures::pin_mut!(open_rx);
        futures::pin_mut!(fail_rx);
        let timeout =
            TimeoutFuture::new(Self::OPEN_TIMEOUT_MS.as_millis() as u32);
        futures::pin_mut!(timeout);

        use futures::{FutureExt, select};
        let shutdown_signal = state.lock().unwrap().shutdown_signal();
        futures::pin_mut!(shutdown_signal);

        select! {
            _ = open_rx.fuse() => Ok(ws),
            stop = shutdown_signal.notified().fuse() => {
                // Close the socket to avoid dangling connection attempt
                let _ = ws.close();
                Err(InterfaceCreateError::InterfaceError(ComInterfaceError::connection_error_with_details(
                    "Creation cancelled due to shutdown",
                ).into()))
            },
            err = fail_rx.fuse() => Err(err.unwrap_or(ComInterfaceError::connection_error().into())),
            _ = timeout.fuse() => {
                // Close the socket to avoid dangling connection attempt
                let _ = ws.close();
                Err(InterfaceCreateError::Timeout)
            }
        }
    }

    async fn read_task(
        ws: web_sys::WebSocket,
        mut incoming_tx: UnboundedSender<Vec<u8>>,
        mut close_tx: Option<oneshot::Sender<()>>,
    ) {
        let mut incoming_tx_clone = incoming_tx.clone();
        let onmessage =
            Closure::wrap(Box::new(move |e: web_sys::MessageEvent| {
                if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
                    let array = js_sys::Uint8Array::new(&abuf);
                    let mut data = vec![0; array.byte_length() as usize];
                    array.copy_to(&mut data[..]);
                    let _ = incoming_tx_clone.start_send(data);
                }
            }) as Box<dyn FnMut(_)>);
        ws.set_onmessage(Some(onmessage.as_ref().unchecked_ref()));
        onmessage.forget();

        // onerror
        let onerror = Closure::once(move |_: web_sys::ErrorEvent| {
            // pass
        });
        ws.set_onerror(Some(onerror.as_ref().unchecked_ref()));
        onerror.forget();

        let ws_clone = ws.clone();
        // onclose
        let onclose = Closure::once(move |e: web_sys::Event| {
            if let Some(close_tx) = close_tx.take() {
                let _ = close_tx.send(());
                // clear event handlers
                ws_clone.set_onmessage(None);
                ws_clone.set_onopen(None);
                ws_clone.set_onerror(None);
                ws_clone.set_onclose(None);
            }
        });
        ws.set_onclose(Some(onclose.as_ref().unchecked_ref()));
        onclose.forget();
    }
}

impl ComInterfaceAsyncFactory for WebSocketClientJSInterfaceSetupData {
    fn create_interface(
        self,
        com_interface_proxy: ComInterfaceProxy,
    ) -> ComInterfaceAsyncFactoryResult {
        Box::pin(
            async move { self.create_interface(com_interface_proxy).await },
        )
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
