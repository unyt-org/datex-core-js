use core::error;
use std::sync::{Arc, Mutex};

use datex_core::network::com_interfaces::com_interface::{
    ComInterfaceState, ComInterfaceUUID,
};
use datex_core::stdlib::{cell::RefCell, rc::Rc};
use datex_core::{
    network::{com_hub::ComHub, com_interfaces::com_interface::ComInterface},
    utils::uuid::UUID,
};
use log::{error, info};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::console::info;
use web_sys::js_sys::{self, Promise};

use crate::network::com_interfaces::{
    websocket_client_js_interface::WebSocketClientJSInterface,
    websocket_server_js_interface::WebSocketServerJSInterface,
};

#[wasm_bindgen]
pub struct JSComHub {
    com_hub: Arc<Mutex<ComHub>>,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSComHub {
    pub fn new(com_hub: Arc<Mutex<ComHub>>) -> JSComHub {
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
            let websocket_interface =
                WebSocketClientJSInterface::open(&address_clone)
                    .await
                    .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            let interface_uuid = websocket_interface.get_uuid().clone();

            if websocket_interface.get_state() != ComInterfaceState::Connected {
                error!("Failed to connect to WebSocket");
                return Err(
                    JsError::new("Failed to connect to WebSocket").into()
                );
            }
            let websocket_interface =
                Rc::new(RefCell::new(websocket_interface));
            com_hub
                .lock()
                .unwrap()
                .add_interface(websocket_interface.clone())
                .await
                .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            Ok(JsValue::from_str(&interface_uuid.0.to_string()))
        })
    }

    #[wasm_bindgen]
    pub async fn close_websocket_server_interface(
        &mut self,
        interface_uuid: String,
    ) -> Promise {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));

        let com_hub = self.com_hub.clone();
        future_to_promise(async move {
            let com_hub = com_hub.clone();

            let has_interface = {
                let com_hub_mut = com_hub
                    .lock()
                    .map_err(|_| JsError::new("Failed to lock ComHub"))?;

                let interface = com_hub_mut
                    .get_interface_by_uuid::<WebSocketServerJSInterface>(
                        &interface_uuid.clone(),
                    );
                interface.is_some()
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
                return Ok(JsValue::TRUE);
            } else {
                error!("Failed to find WebSocket interface");
                return Err(
                    JsError::new("Failed to find WebSocket interface").into()
                );
            }
        })
    }
    #[wasm_bindgen]
    pub async fn create_websocket_server_interface(&self) -> Promise {
        let com_hub = self.com_hub.clone();

        future_to_promise(async move {
            let websocket_interface = WebSocketServerJSInterface::open()
                .await
                .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            let uuid = websocket_interface.get_uuid().clone();

            let mut com_hub = com_hub.lock().unwrap();
            com_hub
                .add_interface(Rc::new(RefCell::new(websocket_interface)))
                .await
                .map_err(|e| JsError::new(&format!("{:?}", e)))?;

            Ok(JsValue::from_str(&uuid.0.to_string()))
        })
    }

    #[wasm_bindgen]
    pub async fn add_websocket_to_server_interface(
        &mut self,
        interface_uuid: String,
        websocket: web_sys::WebSocket,
    ) -> JsValue {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));

        let com_hub = self.com_hub.clone();
        let com_hub = com_hub.lock().unwrap();
        let interface = com_hub
            .get_interface_by_uuid_mut::<WebSocketServerJSInterface>(
                &interface_uuid,
            );
        if interface.is_some() {
            interface.unwrap().register_socket(websocket);
            return JsValue::undefined();
        } else {
            error!("Failed to find WebSocket interface");
            return JsError::new("Failed to find WebSocket interface").into();
        }
    }

    #[wasm_bindgen]
    pub async fn _update(&mut self) {
        self.com_hub.lock().unwrap().update().await;
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
