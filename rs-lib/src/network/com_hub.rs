use std::sync::{Arc, Mutex};

#[cfg(feature = "wasm_serial")]
use super::com_interfaces::serial_js_interface::SerialRegistry;
#[cfg(feature = "webrtc")]
use super::com_interfaces::webrtc_js_interface::WebRTCClientRegistry;
#[cfg(feature = "wasm_websocket_client")]
use super::com_interfaces::websocket_client_js_interface::WebSocketClientRegistry;
#[cfg(feature = "wasm_websocket_server")]
use super::com_interfaces::websocket_server_js_interface::WebSocketServerRegistry;

use datex_core::network::com_interfaces::com_interface::ComInterfaceUUID;
use datex_core::stdlib::{cell::RefCell, rc::Rc};
use datex_core::{network::com_hub::ComHub, utils::uuid::UUID};
use log::error;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::{self, Promise};

#[wasm_bindgen]
pub struct JSComHub {
    com_hub: Arc<Mutex<ComHub>>,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSComHub {
    pub fn new(com_hub: Arc<Mutex<ComHub>>) -> JSComHub {
        JSComHub {
            com_hub: com_hub.clone(),
        }
    }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSComHub {
    pub fn close_interface(&self, interface_uuid: String) -> Promise {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));
        let com_hub = self.com_hub.clone();
        future_to_promise(async move {
            let com_hub = com_hub.clone();
            let has_interface = {
                let com_hub = com_hub
                    .lock()
                    .map_err(|_| JsError::new("Failed to lock ComHub"))?;
                com_hub.has_interface(&interface_uuid)
            };
            if has_interface {
                let com_hub = com_hub.clone();
                let mut com_hub_mut = com_hub
                    .lock()
                    .map_err(|_| JsError::new("Failed to lock ComHub"))?;

                com_hub_mut
                    .remove_interface(interface_uuid.clone())
                    .await
                    .map_err(|e| JsError::new(&format!("{:?}", e)))?;
                Ok(JsValue::TRUE)
            } else {
                error!("Failed to find interface");
                Err(JsError::new("Failed to find interface").into())
            }
        })
    }

    pub async fn _update(&mut self) {
        self.com_hub.lock().unwrap().update().await;
    }

    #[cfg(feature = "wasm_websocket_server")]
    #[wasm_bindgen(getter)]
    pub fn websocket_server(&self) -> WebSocketServerRegistry {
        WebSocketServerRegistry::new(self.com_hub.clone())
    }

    #[cfg(feature = "wasm_websocket_client")]
    #[wasm_bindgen(getter)]
    pub fn websocket_client(&self) -> WebSocketClientRegistry {
        WebSocketClientRegistry::new(self.com_hub.clone())
    }

    #[cfg(feature = "wasm_serial")]
    #[wasm_bindgen(getter)]
    pub fn serial(&self) -> SerialRegistry {
        SerialRegistry::new(self.com_hub.clone())
    }

    #[cfg(feature = "webrtc")]
    #[wasm_bindgen(getter)]
    pub fn webrtc(&self) -> WebRTCClientRegistry {
        WebRTCClientRegistry::new(self.com_hub.clone())
    }

    #[wasm_bindgen(getter)]
    pub fn _incoming_blocks(&self) -> Vec<js_sys::Uint8Array> {
        let vec: Rc<
            RefCell<
                std::collections::VecDeque<
                    Rc<datex_core::global::dxb_block::DXBBlock>,
                >,
            >,
        > = self.com_hub.lock().unwrap().incoming_blocks.clone();
        let vec = vec.borrow();
        vec.iter()
            .map(|block| {
                let bytes = block.to_bytes().unwrap();
                let entry =
                    js_sys::Uint8Array::new_with_length(bytes.len() as u32);
                entry.copy_from(&bytes);
                entry
            })
            .collect::<Vec<_>>()
    }
}
