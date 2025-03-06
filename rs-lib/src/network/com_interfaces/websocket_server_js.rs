use std::{cell::RefCell, collections::VecDeque, rc::Rc, sync::{Arc, Mutex}};

use anyhow::Error;
use datex_core::{network::com_interfaces::{
	com_interface_socket::SocketState, websocket::{websocket_common::parse_url, websocket_server::{WebSocket, WebSocketServerInterface}}
}, utils::logger::Logger};
use tokio::sync::Notify;
use url::Url;

pub struct WebSocketServerJS {
	port: u32,
	receive_queue: Arc<Mutex<VecDeque<u8>>>,
	logger: Option<Rc<RefCell<Logger>>>,
	wait_for_state_change: Arc<Notify>,
	state: Rc<RefCell<SocketState>>,
}

impl WebSocketServerJS {
	pub fn new(
	  port: u32,
	  logger: Option<Logger>,
	) -> Result<WebSocketServerJS, Error> {
		Ok(WebSocketServerJS {
			logger: match logger {
				Some(logger) => Some(Rc::new(RefCell::new(logger))),
				None => None,
			},
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

	fn connect(&mut self) -> anyhow::Result<Arc<Mutex<VecDeque<u8>>>> {
		todo!()
	}
}