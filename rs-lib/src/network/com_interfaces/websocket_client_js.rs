use std::sync::Mutex; // FIXME no-std

use datex_core::stdlib::{
    cell::RefCell, collections::VecDeque, rc::Rc, sync::Arc,
};

use anyhow::{Error, Result};
use datex_core::network::com_interfaces::{
    com_interface_socket::{ComInterfaceSocket, SocketState},
    websocket::{websocket_client::WebSocket, websocket_common::parse_url},
};

use log::{error, info, warn};
use tokio::sync::Notify;
use url::Url;
use wasm_bindgen::{
    prelude::{wasm_bindgen, Closure},
    JsCast, JsError,
};
use web_sys::{js_sys, ErrorEvent, MessageEvent};

pub struct WebSocketClientJS {
    address: Url,
    ws: web_sys::WebSocket,
    receive_queue: Arc<Mutex<VecDeque<u8>>>,
    wait_for_state_change: Arc<Notify>,
    state: Rc<RefCell<SocketState>>,
}

impl WebSocketClientJS {
    pub fn new(address: &str) -> Result<WebSocketClientJS, Error> {
        let address = parse_url(address)?;
        let ws = web_sys::WebSocket::new(&address.to_string())
            .map_err(|_| Error::msg("Failed to create WebSocket"))?;
        return Ok(WebSocketClientJS {
            address,
            state: Rc::new(RefCell::new(SocketState::Closed)),
            wait_for_state_change: Arc::new(Notify::new()),
            ws,
            receive_queue: Arc::new(Mutex::new(VecDeque::new())),
        });
    }

    pub async fn wait_for_state_change(&self) -> SocketState {
        self.wait_for_state_change.notified().await;
        *self.state.borrow()
    }

    fn create_onmessage_callback(&self) -> Closure<dyn FnMut(MessageEvent)> {
        let receive_queue = self.receive_queue.clone();
        Closure::new(move |e: MessageEvent| {
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
        let state = self.state.clone();
        let on_error = self.wait_for_state_change.clone();

        Closure::new(move |e: ErrorEvent| {
            error!("Socket error event: {:?}", e.message());
            *state.borrow_mut() = SocketState::Error;
            on_error.notify_one();
        })
    }

    fn create_onclose_callback(&self) -> Closure<dyn FnMut()> {
        let state = self.state.clone();
        let on_close = self.wait_for_state_change.clone();
        Closure::new(move || {
            if *state.borrow() == SocketState::Error
                || *state.borrow() == SocketState::Closed
            {
                return;
            }
            warn!("Socket closed");
            *state.borrow_mut() = SocketState::Closed;

            on_close.notify_one();
        })
    }

    fn create_onopen_callback(&self) -> Closure<dyn FnMut()> {
        let on_connect = self.wait_for_state_change.clone();
        let state = self.state.clone();

        Closure::new(move || {
            info!("Socket opened");
            *state.borrow_mut() = SocketState::Open;

            on_connect.notify_one(); // Notify that connection is open
        })
    }

    fn connect(&mut self) -> Result<()> {
        self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
        let cloned_ws = self.ws.clone();
        cloned_ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

        let message_callback = self.create_onmessage_callback();
        let error_callback = self.create_onerror_callback();
        let open_callback = self.create_onopen_callback();
        let close_callback = self.create_onclose_callback();

        self.ws
            .set_onmessage(Some(message_callback.as_ref().unchecked_ref()));
        self.ws
            .set_onerror(Some(error_callback.as_ref().unchecked_ref()));
        self.ws
            .set_onopen(Some(open_callback.as_ref().unchecked_ref()));
        self.ws
            .set_onclose(Some(close_callback.as_ref().unchecked_ref()));

        message_callback.forget();
        error_callback.forget();
        open_callback.forget();
        close_callback.forget();

        Ok(())
    }
}

impl WebSocket for WebSocketClientJS {
    fn connect(&mut self) -> Result<Arc<Mutex<VecDeque<u8>>>> {
        self.connect()?;
        Ok(self.receive_queue.clone())
    }

    fn send_data(&mut self, message: &[u8]) -> bool {
        self.ws.send_with_u8_array(&message).is_ok()
    }

    fn get_address(&self) -> Url {
        self.address.clone()
    }
}
