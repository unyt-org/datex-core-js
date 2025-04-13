use datex_core::network::com_interfaces::com_interface::{
    ComInterfaceState, ComInterfaceUUID,
};
use datex_core::stdlib::{cell::RefCell, rc::Rc};
use datex_core::{
    network::{
        com_hub::ComHub,
        com_interfaces::{
            com_interface::ComInterface, com_interface_socket::SocketState,
        },
    },
    utils::uuid::UUID,
};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::{self, Promise};

use crate::network::com_interfaces::{
    websocket_client_js_interface::WebSocketClientJSInterface,
    websocket_server_js_interface::WebSocketServerJSInterface,
};

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
    pub fn add_ws_interface(&mut self, address: String) -> Promise {
        let com_hub = self.com_hub.clone();
        let address_clone = address.clone();

        future_to_promise(async move {
            let websocket_interface =
                WebSocketClientJSInterface::open(&address_clone)
                    .await
                    .map_err(|e| JsError::new(&format!("{:?}", e)))?;
            let websocket_interface =
                Rc::new(RefCell::new(websocket_interface));

            com_hub
                .borrow_mut()
                .add_interface(websocket_interface.clone())
                .await
                .map_err(|e| JsError::new(&format!("{:?}", e)))?;

            if websocket_interface.borrow().get_state()
                != ComInterfaceState::Connected
            {
                return Err(
                    JsError::new("Failed to connect to WebSocket").into()
                );
            }
            let uuid = websocket_interface.borrow().get_uuid().clone();
            Ok(JsValue::from_str(&uuid.0.to_string()))
        })
    }

    #[wasm_bindgen]
    pub async fn create_websocket_server_interface(&self) -> Promise {
        future_to_promise(async move {
            let websocket_interface = WebSocketServerJSInterface::open()
                .await
                .map_err(|e| JsError::new(&format!("{:?}", e)))?;

            let uuid = websocket_interface.get_uuid().clone();
            Ok(JsValue::from_str(&uuid.0.to_string()))
        })
    }

    #[wasm_bindgen]
    pub async fn add_websocket_to_server_interface(
        &mut self,
        interface_uuid: String,
        websocket: web_sys::WebSocket,
    ) {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));

        let com_hub = self.com_hub.clone();
        let interface = com_hub.borrow_mut();
        let mut interface = interface
            .get_interface_by_uuid::<WebSocketServerJSInterface>(
                &interface_uuid,
            )
            .unwrap();

        // interface.register_socket(&websocket);

        // let websocket_interface = interface.clone()
    }

    #[wasm_bindgen]
    pub async fn _update(&mut self) {
        self.com_hub.borrow_mut().update().await;
    }

    #[wasm_bindgen(getter)]
    pub fn _incoming_blocks(&self) -> Vec<js_sys::Uint8Array> {
        let vec: Rc<
            RefCell<
                std::collections::VecDeque<
                    Rc<datex_core::global::dxb_block::DXBBlock>,
                >,
            >,
        > = self.com_hub.borrow().incoming_blocks.clone();
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
