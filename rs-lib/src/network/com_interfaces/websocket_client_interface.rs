use datex_core::network::com_interfaces::{
  com_interface_properties::{InterfaceDirection, InterfaceProperties},
  com_interface_socket::ComInterfaceSocket,
};

use datex_core::network::com_interfaces::com_interface::ComInterface;
use url::Url;
use wasm_bindgen::{prelude::wasm_bindgen, JsError};

#[wasm_bindgen]
pub struct JSWebSocketClientInterface {
  url: Url,
}

#[wasm_bindgen]
impl JSWebSocketClientInterface {
  #[wasm_bindgen(constructor)]
  pub fn new(address: &str) -> Result<JSWebSocketClientInterface, JsError> {
    let address = if address.contains("://") {
      address.to_string()
    } else {
      format!("wss://{}", address)
    };

    let mut url =
      Url::parse(&address).map_err(|_| JsError::new("Invalid URL"))?;
    match url.scheme() {
      "https" => url.set_scheme("wss").unwrap(),
      "http" => url.set_scheme("ws").unwrap(),
      "wss" | "ws" => (),
      _ => return Err(JsError::new("Invalid URL scheme")),
    }
    Ok(JSWebSocketClientInterface { url })
  }

  #[wasm_bindgen(getter)]
  pub fn url(&self) -> String {
    self.url.to_string()
  }
}
#[wasm_bindgen]
impl JSWebSocketClientInterface {
  #[wasm_bindgen]
  pub fn send_block(&mut self, block: &[u8]) -> () {
    ComInterface::send_block(self, block, &ComInterfaceSocket::default());
  }
}

impl ComInterface for JSWebSocketClientInterface {
  fn send_block(&mut self, block: &[u8], socket: &ComInterfaceSocket) -> () {}

  fn get_properties(&self) -> InterfaceProperties {
    InterfaceProperties {
      channel: "websocket".to_string(),
      name: None,
      direction: InterfaceDirection::IN_OUT,
      reconnect_interval: None,
      latency: 0,
      bandwidth: 1000,
      continuous_connection: true,
      allow_redirects: true,
    }
  }

  fn get_sockets(
    &self,
  ) -> std::rc::Rc<
    std::cell::RefCell<
      Vec<std::rc::Rc<std::cell::RefCell<ComInterfaceSocket>>>,
    >,
  > {
    todo!()
  }
}
