use std::{cell::RefCell, collections::VecDeque, rc::Rc, sync::{Arc, Mutex}, vec};

use anyhow::Result;
use datex_core::network::com_interfaces::websocket_client::{
    parse_url, WebSocket, WebSocketClientInterface,
  };

use url::Url;
use wasm_bindgen::{prelude::{wasm_bindgen, Closure}, JsCast, JsError};
use web_sys::{js_sys, ErrorEvent, MessageEvent};

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub struct JSWebSocketClientInterface {
  ws_interface: Rc<RefCell<WebSocketClientInterface<WebSocketJS>>>,
}

#[wasm_bindgen]
impl JSWebSocketClientInterface {
  #[wasm_bindgen(constructor)]
  pub fn new(address: &str) -> Result<JSWebSocketClientInterface, JsError> {
    
    let websocket = WebSocketJS::new(address)?;
    return Ok(
        JSWebSocketClientInterface {
            ws_interface: Rc::new(RefCell::new(WebSocketClientInterface::new_with_web_socket(websocket)))
        }
    );
  }

  #[wasm_bindgen(getter)]
  pub fn url(&self) -> String {
    self.ws_interface.borrow().websocket.get_address().to_string()
  }
}

impl JSWebSocketClientInterface {
    pub fn get_ws_interface(&self) -> Rc<RefCell<WebSocketClientInterface<WebSocketJS>>> {
        self.ws_interface.clone()
    }
}

pub struct WebSocketJS {
  address: Url,
  ws: web_sys::WebSocket,
  receive_queue: Arc<Mutex<VecDeque<u8>>>,
}

impl WebSocketJS {
  fn new(address: &str) -> Result<WebSocketJS, JsError> {
    let address = parse_url(address).map_err(|_| JsError::new("Invalid URL"))?;
    let ws = web_sys::WebSocket::new(&address.to_string()).map_err(|_| JsError::new("Failed to create WebSocket"))?;
    return Ok(WebSocketJS {
      address,
      ws,
      receive_queue: Arc::new(Mutex::new(VecDeque::new())),
    });
  }

  fn connect(&self) -> Result<()> {
    self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
    // create callback
    let cloned_ws = self.ws.clone();
    cloned_ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
    
    let receive_queue = self.receive_queue.clone();
    let onmessage_callback = Closure::<dyn FnMut(_)>::new(move |e: MessageEvent| {
        if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
            let array = js_sys::Uint8Array::new(&abuf);
            receive_queue.lock().unwrap().extend(array.to_vec().iter().cloned());
        } else {
            console_log!("message event, received Unknown: {:?}", e.data());
        }
    });
    self.ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
    onmessage_callback.forget();

    let onerror_callback = Closure::<dyn FnMut(_)>::new(move |e: ErrorEvent| {
        console_log!("error event: {:?}", e);
    });
    self.ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
    onerror_callback.forget();

    let onopen_callback = Closure::<dyn FnMut()>::new(move || {
        console_log!("socket opened");
    });
    self.ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
    onopen_callback.forget();
    Ok(())
  }
}

impl WebSocket for WebSocketJS {
    
    fn connect(&self) -> Result<Arc<Mutex<VecDeque<u8>>>> {
        self.connect()?;
        Ok(self.receive_queue.clone())
    }

    fn send_data(&self, message: &[u8]) -> bool {
        if self.ws.send_with_u8_array(&message).is_ok() {
            true
        } else {
            false
        }
    }

    fn get_address(&self) -> Url {
        self.address.clone()
    }
}
