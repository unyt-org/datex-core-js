use datex_core::network::{
  com_hub::ComHub,
  com_interfaces::{
    com_interface::ComInterfaceTrait,
    com_interface_socket::SocketState,
    websocket_client::WebSocketClientInterface,
  },
};
use std::{cell::RefCell, rc::Rc};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::{self, Promise};

use crate::network::com_interfaces::websocket_client_js::WebSocketJS;

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
  pub fn add_ws_interface(&mut self, address: String) -> Promise {
    let com_hub = self.com_hub.clone();
    let address_clone = address.clone();

    future_to_promise(async move {
      let websocket =
        WebSocketJS::new(&address_clone, com_hub.borrow().logger.clone())
          .map_err(|e| JsError::new(&format!("{:?}", e)))?;
      let websocket = Rc::new(RefCell::new(websocket));

      let ws_interface =
        Rc::new(RefCell::new(WebSocketClientInterface::new_with_web_socket(
          websocket.clone(),
          com_hub.borrow().logger.clone(),
        )));
      
      com_hub
        .borrow_mut()
        .add_interface(ComInterfaceTrait::new(ws_interface.clone()))
        .map_err(|e| JsError::new(&format!("{:?}", e)))?;

      let socket_state =
        websocket.clone().borrow_mut().wait_for_state_change().await;
      if socket_state != SocketState::Open {
        return Err(JsError::new("Failed to connect to WebSocket").into());
      }
      // FIXME return uuid
      // ws_interface.borrow().get_properties();

      Ok(JsValue::UNDEFINED)
    })
  }

  #[wasm_bindgen]
  pub fn _update(&mut self) {
    self.com_hub.borrow_mut().update();
  }

  #[wasm_bindgen(getter)]
  pub fn _incoming_blocks(&self) -> Vec<js_sys::Uint8Array> {
    let vec: Rc<
      RefCell<
        std::collections::VecDeque<Rc<datex_core::global::dxb_block::DXBBlock>>,
      >,
    > = self.com_hub.borrow().incoming_blocks.clone();
    let vec = vec.borrow();
    vec
      .iter()
      .map(|block| {
        let bytes = block.to_bytes().unwrap();
        let entry = js_sys::Uint8Array::new_with_length(bytes.len() as u32);
        entry.copy_from(&bytes);
        entry
      })
      .collect::<Vec<_>>()
  }
}
