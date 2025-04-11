use std::sync::Mutex; // FIXME no-std

use datex_core::{
    network::com_interfaces::websocket::websocket_common::WebSocketServerError,
    stdlib::{cell::RefCell, collections::VecDeque, rc::Rc, sync::Arc},
};

use datex_core::network::com_interfaces::com_interface_socket::SocketState;
use tokio::sync::Notify;

pub struct WebSocketServerJS {
    port: u32,
    receive_queue: Arc<Mutex<VecDeque<u8>>>,
    wait_for_state_change: Arc<Notify>,
    state: Rc<RefCell<SocketState>>,
}
