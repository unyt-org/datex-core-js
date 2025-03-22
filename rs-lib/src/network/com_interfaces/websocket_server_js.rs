use std::sync::Mutex; // FIXME no-std

use datex_core::{
    network::com_interfaces::websocket::websocket_server::WebSocketServerError,
    stdlib::{cell::RefCell, collections::VecDeque, rc::Rc, sync::Arc},
};

use datex_core::network::com_interfaces::{
    com_interface_socket::SocketState,
    websocket::websocket_server::WebSocket,
};
use tokio::sync::Notify;
use url::Url;

pub struct WebSocketServerJS {
    port: u32,
    receive_queue: Arc<Mutex<VecDeque<u8>>>,
    wait_for_state_change: Arc<Notify>,
    state: Rc<RefCell<SocketState>>,
}

impl WebSocketServerJS {
    pub fn new(port: u32) -> Result<WebSocketServerJS, WebSocketServerError> {
        if port == 0 || port > 65535 {
            return Err(WebSocketServerError::InvalidPort);
        }
        Ok(WebSocketServerJS {
            port,
            receive_queue: Arc::new(Mutex::new(VecDeque::new())),
            wait_for_state_change: Arc::new(Notify::new()),
            state: Rc::new(RefCell::new(SocketState::Closed)),
        })
    }
}

impl WebSocket for WebSocketServerJS {
    fn send_data(&self, message: &[u8]) -> bool {
        todo!()
    }

    fn get_address(&self) -> Url {
        todo!()
    }

    fn connect(
        &mut self,
    ) -> Result<Arc<Mutex<VecDeque<u8>>>, WebSocketServerError> {
        todo!()
    }
}
