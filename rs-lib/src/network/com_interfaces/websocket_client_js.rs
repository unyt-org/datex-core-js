use std::{cell::RefCell, rc::Rc};

use anyhow::Result;
use datex_core::network::com_interfaces::websocket_client::{
    parse_url, WebSocket, WebSocketClientInterface,
  };

use url::Url;
use wasm_bindgen::{convert::IntoWasmAbi, prelude::{wasm_bindgen, Closure}, JsCast, JsError, JsValue};
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
}

impl WebSocketJS {
  fn new(address: &str) -> Result<WebSocketJS, JsError> {
    let address = parse_url(address).map_err(|_| JsError::new("Invalid URL"))?;
    let ws = web_sys::WebSocket::new(&address.to_string()).map_err(|_| JsError::new("Failed to create WebSocket"))?;
    return Ok(WebSocketJS { address, ws });
  }

  fn connect(&self) -> Result<()> {
  
    self.ws.set_binary_type(web_sys::BinaryType::Arraybuffer);
    // create callback
    let cloned_ws = self.ws.clone();
    cloned_ws.set_binary_type(web_sys::BinaryType::Arraybuffer);

    let onmessage_callback = Closure::<dyn FnMut(_)>::new(move |e: MessageEvent| {
        // Handle difference Text/Binary,...
        if let Ok(abuf) = e.data().dyn_into::<js_sys::ArrayBuffer>() {
            console_log!("message event, received arraybuffer: {:?}", abuf);
            let array = js_sys::Uint8Array::new(&abuf);
            let len = array.byte_length() as usize;
            console_log!("Arraybuffer received {}bytes: {:?}", len, array.to_vec());
            // here you can for example use Serde Deserialize decode the message
            // for demo purposes we switch back to Blob-type and send off another binary message
            // cloned_ws.set_binary_type(web_sys::BinaryType::Blob);
            // match cloned_ws.send_with_u8_array(&[5, 6, 7, 8]) {
            //     Ok(_) => console_log!("binary message successfully sent"),
            //     Err(err) => console_log!("error sending message: {:?}", err),
            // }
        } else {
            console_log!("message event, received Unknown: {:?}", e.data());
        }
    });
    // set message event handler on WebSocket
    self.ws.set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
    // forget the callback to keep it alive
    onmessage_callback.forget();

    let onerror_callback = Closure::<dyn FnMut(_)>::new(move |e: ErrorEvent| {
        console_log!("error event: {:?}", e);
    });
    self.ws.set_onerror(Some(onerror_callback.as_ref().unchecked_ref()));
    onerror_callback.forget();

    let onopen_callback = Closure::<dyn FnMut()>::new(move || {
        console_log!("socket opened");
        // TODO: create socket and add incoming messages to the socket queue
    });
    self.ws.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
    onopen_callback.forget();

    Ok(())
  }

}

impl WebSocket for WebSocketJS {
    
    fn connect(&self) -> Result<()> {
        self.connect()
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
