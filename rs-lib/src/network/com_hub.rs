use std::{cell::RefCell, rc::Rc};
use datex_core::network::{com_hub::ComHub, com_interfaces::{com_interface::ComInterfaceTrait, websocket_client::WebSocketClientInterface}};
use wasm_bindgen::prelude::*;
use web_sys::js_sys;

use crate::network::com_interfaces::websocket_client_js::WebSocketJS;

// use crate::network::com_interfaces::websocket_client_js::JSWebSocketClientInterface;

#[wasm_bindgen]
pub struct JSComHub {
  com_hub: Rc<RefCell<ComHub>>,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSComHub {
  pub fn new(com_hub: Rc<RefCell<ComHub>>) -> JSComHub {
	JSComHub { com_hub }
  }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSComHub {
  #[wasm_bindgen]
  pub fn add_ws_interface(&mut self, address: &str) -> Result<(), JsError> {

	let websocket = WebSocketJS::new(address, self.com_hub.borrow().logger.clone())?;
    let ws_interface = Rc::new(RefCell::new(WebSocketClientInterface::new_with_web_socket(websocket, self.com_hub.borrow().logger.clone())));

	self.com_hub.borrow_mut().add_interface(ComInterfaceTrait::new(
		ws_interface.clone(),
	)).map_err(|e| JsError::new(&format!("{:?}", e)))?;

	Ok(())
  }

  #[wasm_bindgen]
  pub fn _update(&mut self) {
	self.com_hub.borrow_mut().update();
  }

  #[wasm_bindgen(getter)]
  pub fn _incoming_blocks(&self) -> Vec<js_sys::Uint8Array> {
	let vec: Rc<RefCell<std::collections::VecDeque<Rc<datex_core::global::dxb_block::DXBBlock>>>> = self.com_hub.borrow().incoming_blocks.clone();
	let vec = vec.borrow();
	vec.iter().map(|block| {
		let bytes = block.to_bytes().unwrap();
		let entry = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
		entry.copy_from(&bytes);
		entry
	}).collect::<Vec<_>>()
  }
}