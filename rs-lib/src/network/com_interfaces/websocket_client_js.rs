use std::{cell::RefCell, collections::VecDeque, rc::Rc, sync::{Arc, Mutex}, vec};

use anyhow::Result;
use datex_core::{network::com_interfaces::{com_interface_socket::ComInterfaceSocket, websocket_client::{
    parse_url, WebSocket, WebSocketClientInterface,
  }}, utils::logger::{self, Logger, LoggerContext}};

use url::Url;
use wasm_bindgen::{prelude::{wasm_bindgen, Closure}, JsCast, JsError};
use web_sys::{js_sys, ErrorEvent, MessageEvent};


pub struct WebSocketJS {
  address: Url,
  ws: web_sys::WebSocket,
  receive_queue: Arc<Mutex<VecDeque<u8>>>,
  logger: Option<Rc<RefCell<Logger>>>,
}

impl WebSocketJS {
  pub fn new(address: &str, logger: Option<Logger>) -> Result<WebSocketJS, JsError> {
    let address = parse_url(address).map_err(|_| JsError::new("Invalid URL"))?;
    let ws = web_sys::WebSocket::new(&address.to_string()).map_err(|_| JsError::new("Failed to create WebSocket"))?;
    return Ok(WebSocketJS {
      address,
      logger: match logger {
        Some(logger) => Some(Rc::new(RefCell::new(logger))),
        None => None,
      },
      ws,
      receive_queue: Arc::new(Mutex::new(VecDeque::new())),
    });
  }

  fn connect(&mut self) -> Result<()> {
    self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
    // create callback
    let cloned_ws = self.ws.clone();
    cloned_ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
    
    let receive_queue = self.receive_queue.clone();

    // TODO fix this sh*t
    let logger = match &self.logger.clone() {
      Some(logger) => logger.clone(),
      None => Rc::new(RefCell::new(
        Logger::new_for_development(Rc::new(RefCell::new(LoggerContext { log_redirect: None })), "name".to_string())
      )),
    };
   
    let onmessage_callback = Closure::<dyn FnMut(_)>::new(move |e: MessageEvent| {
        if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
            let array = js_sys::Uint8Array::new(&abuf);
            receive_queue.lock().unwrap().extend(array.to_vec().iter().cloned());
            logger.borrow().info(&format!("message event, received: {:?}", array));
        } else {
            logger.borrow().info(&format!("message event, received Unknown: {:?}", e.data()));
        }
    });
    self.ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
    onmessage_callback.forget();

    // TODO fix this sh*t
    let logger = match &self.logger.clone() {
      Some(logger) => logger.clone(),
      None => Rc::new(RefCell::new(
        Logger::new_for_development(Rc::new(RefCell::new(LoggerContext { log_redirect: None })), "name".to_string())
      )),
    };

    let onerror_callback = Closure::<dyn FnMut(_)>::new(move |e: ErrorEvent| {
      logger.borrow().error(&format!("error event: {:?}", e));
    });
    self.ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
    onerror_callback.forget();

    // TODO fix this sh*t
    let logger = match &self.logger.clone() {
      Some(logger) => logger.clone(),
      None => Rc::new(RefCell::new(
        Logger::new_for_development(Rc::new(RefCell::new(LoggerContext { log_redirect: None })), "name".to_string())
      )),
    };

    // TODO FIXME

    let onopen_callback = Closure::<dyn FnMut()>::new(move || {
      logger.borrow().success(&format!("Socket opened"));

    });
    self.ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
    onopen_callback.forget();
    Ok(())
  }
}

impl WebSocket for WebSocketJS {
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
