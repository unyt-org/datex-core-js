use std::{
  cell::RefCell,
  collections::VecDeque,
  rc::Rc,
  sync::{Arc, Mutex},
};

use anyhow::{Error, Result};
use datex_core::{
  network::com_interfaces::{
    com_interface_socket::{ComInterfaceSocket, SocketState}, websocket::{websocket_client::WebSocket, websocket_common::parse_url},
  },
  utils::logger::{self, Logger, LoggerContext},
};

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
  logger: Option<Rc<RefCell<Logger>>>,
  wait_for_state_change: Arc<Notify>,
  state: Rc<RefCell<SocketState>>,
}

impl WebSocketClientJS {
  pub fn new(
    address: &str,
    logger: Option<Logger>,
  ) -> Result<WebSocketClientJS, Error> {
    let address = parse_url(address)?;
    let ws = web_sys::WebSocket::new(&address.to_string())
      .map_err(|_| Error::msg("Failed to create WebSocket"))?;
    return Ok(WebSocketClientJS {
      address,
      state: Rc::new(RefCell::new(SocketState::Closed)),
      wait_for_state_change: Arc::new(Notify::new()),
      logger: match logger {
        Some(logger) => Some(Rc::new(RefCell::new(logger))),
        None => None,
      },
      ws,
      receive_queue: Arc::new(Mutex::new(VecDeque::new())),
    });
  }

  pub async fn wait_for_state_change(&self) -> SocketState {
    self.wait_for_state_change.notified().await;
    *self.state.borrow()
  }

  fn get_logger(&self) -> Rc<RefCell<Logger>> {
    self.logger.clone().unwrap_or_else(|| {
      Rc::new(RefCell::new(Logger::new_for_development(
        Rc::new(RefCell::new(LoggerContext { log_redirect: None })),
        "name".to_string(),
      )))
    })
  }

  fn create_onmessage_callback(&self) -> Closure<dyn FnMut(MessageEvent)> {
    let receive_queue = self.receive_queue.clone();
    let logger = self.get_logger();
    Closure::new(move |e: MessageEvent| {
      if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
        let array = js_sys::Uint8Array::new(&abuf);
        receive_queue.lock().unwrap().extend(array.to_vec());
        logger.borrow().info(&format!(
          "message event, received: {:?} bytes ({:?})",
          array.to_vec().len(),
          receive_queue
        ));
      } else {
        logger
          .borrow()
          .info(&format!("message event, received Unknown: {:?}", e.data()));
      }
    })
  }

  fn create_onerror_callback(&self) -> Closure<dyn FnMut(ErrorEvent)> {
    let state = self.state.clone();
    let on_error = self.wait_for_state_change.clone();

    let logger = self.get_logger();
    Closure::new(move |e: ErrorEvent| {
      logger
        .borrow()
        .error(&format!("Socket error event: {:?}", e.message()));
      *state.borrow_mut() = SocketState::Error;
      on_error.notify_one();
    })
  }

  fn create_onclose_callback(&self) -> Closure<dyn FnMut()> {
    let state = self.state.clone();
    let on_close = self.wait_for_state_change.clone();
    let logger = self.get_logger();
    Closure::new(move || {
      if *state.borrow() == SocketState::Error
        || *state.borrow() == SocketState::Closed
      {
        return;
      }
      logger.borrow().warn("Socket closed");
      *state.borrow_mut() = SocketState::Closed;

      on_close.notify_one();
    })
  }

  fn create_onopen_callback(&self) -> Closure<dyn FnMut()> {
    let logger = self.get_logger();
    let on_connect = self.wait_for_state_change.clone();
    let state = self.state.clone();

    Closure::new(move || {
      logger.borrow().success("Socket opened");
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

    self
      .ws
      .set_onmessage(Some(message_callback.as_ref().unchecked_ref()));
    self
      .ws
      .set_onerror(Some(error_callback.as_ref().unchecked_ref()));
    self
      .ws
      .set_onopen(Some(open_callback.as_ref().unchecked_ref()));
    self
      .ws
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

  fn send_data(&self, message: &[u8]) -> bool {
    self.ws.send_with_u8_array(&message).is_ok()
  }

  fn get_address(&self) -> Url {
    self.address.clone()
  }
}
