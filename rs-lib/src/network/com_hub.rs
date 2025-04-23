use std::cell::{Ref, RefMut};
use std::sync::{Arc, Mutex};

#[cfg(feature = "wasm_serial")]
use super::com_interfaces::serial_js_interface::SerialRegistry;
#[cfg(feature = "webrtc")]
use super::com_interfaces::webrtc_js_interface::WebRTCClientRegistry;
#[cfg(feature = "wasm_websocket_client")]
use super::com_interfaces::websocket_client_js_interface::WebSocketClientRegistry;
#[cfg(feature = "wasm_websocket_server")]
use super::com_interfaces::websocket_server_js_interface::WebSocketServerRegistry;

use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceUUID,
};
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
    pub(crate) fn add_interface<T: ComInterface>(&self, interface: T) {
        self.com_hub
            .lock()
            .unwrap()
            .add_interface(Rc::new(RefCell::new(interface)))
            .expect("Failed to add interface");
    }
    pub(crate) fn assss<T: ComInterface + 'static>(
        &self,
        interface_uuid: &ComInterfaceUUID,
    ) -> Option<Ref<T>> {
        let com_hub = self.com_hub.lock().unwrap();
        let x = com_hub.get_interface_by_uuid::<T>(interface_uuid).unwrap();
        x
    }

    pub(crate) fn get_interface_by_uuid<T: 'static + ComInterface>(
        &self,
        interface_uuid: &ComInterfaceUUID,
    ) -> &T {
        let com_hub = self.com_hub.lock().unwrap();
        let interface = com_hub
            .get_interface_ref_by_uuid(&interface_uuid)
            .unwrap_or_else(|| panic!("Failed to get interface"));

        // Clone the Rc so we return a valid owned pointer
        let rc = Rc::clone(&interface);

        // Check & downcast inside the borrow
        // Borrow and extract a reference to T
        let inner = rc.borrow();
        let _t_ref: &T = inner
            .as_any()
            .downcast_ref::<T>()
            .expect("Failed to downcast interface");
        _t_ref

        // let com_hub = self.com_hub.lock().unwrap();
        // let interface = com_hub.get_interface_ref_by_uuid(&interface_uuid);
        // if interface.is_none() {
        //     error!("Failed to get interface");
        // }
        // let interface = interface.unwrap();
        // let x = interface
        //     .borrow_mut()
        //     .as_any_mut()
        //     .downcast_mut::<T>()
        //     .expect("Failed to downcast interface");
        // x
    }

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
