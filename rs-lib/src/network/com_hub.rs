use std::any::Any;
#[cfg(feature = "wasm_matchbox")]
use super::com_interfaces::matchbox_js_interface::MatchboxClientRegistry;
#[cfg(feature = "wasm_webrtc")]
use super::com_interfaces::webrtc_js_interface::WebRTCRegistry;
#[cfg(feature = "wasm_websocket_server")]
use super::com_interfaces::websocket_server_js_interface::WebSocketServerRegistry;

use datex_core::global::dxb_block::IncomingSection;
use datex_core::network::com_hub::{ComHubError, InterfacePriority};
use datex_core::network::com_interfaces::com_interface::{ComInterface, ComInterfaceFactory, ComInterfaceUUID};
use datex_core::network::com_interfaces::com_interface_socket::ComInterfaceSocketUUID;
use datex_core::stdlib::{cell::RefCell, rc::Rc};
use datex_core::{network::com_hub::ComHub, utils::uuid::UUID};
use datex_core::runtime::execution::execute_dxb_sync;
use datex_core::runtime::Runtime;
use datex_core::values::serde::deserializer::from_value_container;
use log::error;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::{self, Promise};
#[wasm_bindgen]
#[derive(Clone)]
pub struct JSComHub {
    // ignore for wasm bindgen
    runtime: Runtime,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSComHub {
    pub fn new(runtime: Runtime) -> JSComHub {
        JSComHub {
            runtime
        }
    }

    pub fn com_hub(&self) -> &ComHub {
        self.runtime.com_hub()
    }

    pub fn get_interface_for_uuid<T: ComInterface>(&self, uuid: String) -> Result<Rc<RefCell<T>>, ComHubError> {
        let base_interface = self
            .com_hub()
            .get_interface_by_uuid::<T>(&ComInterfaceUUID::from_string(uuid));
        if let Some(base_interface) = base_interface {
            Ok(base_interface)
        } else {
            Err(ComHubError::InterfaceDoesNotExist)
        }
    }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSComHub {
    pub fn register_default_interface_factories(&self) {
        self.com_hub().register_interface_factory(
            "base".to_string(),
            crate::network::com_interfaces::base_interface::BaseJSInterface::factory
        );

        #[cfg(feature = "wasm_websocket_client")]
        self.com_hub().register_interface_factory(
            "websocket-client".to_string(),
            crate::network::com_interfaces::websocket_client_js_interface::WebSocketClientJSInterface::factory
        );

        #[cfg(feature = "wasm_websocket_server")]
        self.com_hub().register_interface_factory(
            "websocket-server".to_string(),
            crate::network::com_interfaces::websocket_server_js_interface::WebSocketServerJSInterface::factory
        );

        //wasm_serial
        #[cfg(feature = "wasm_serial")]
        self.com_hub().register_interface_factory(
            "serial".to_string(),
            crate::network::com_interfaces::serial_js_interface::SerialJSInterface::factory
        );

        // TODO: wasm_webrtc
    }

    pub fn create_interface(
        &self,
        interface_type: String,
        properties: String,
    ) -> Promise {
        let runtime = self.runtime.clone();
        future_to_promise(async move {
            let com_hub = runtime.com_hub();
            let properties = runtime.execute_sync(&properties, &[], None)
                .map_err(|e| JsError::new(&format!("{e:?}")))?;
            if let Some(properties) = properties {
                let interface = com_hub
                    .create_interface(&interface_type, properties, InterfacePriority::default())
                    .await
                    .map_err(|e| JsError::new(&format!("{e:?}")))?;
                Ok(JsValue::from_str(&interface.borrow().get_uuid().0.to_string()))
            }
            else {
                Err(JsError::new("Failed to create interface: properties are empty").into())
            }
        })
    }

    pub fn close_interface(&self, interface_uuid: String) -> Promise {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));
        let runtime = self.runtime.clone();
        future_to_promise(async move {
            let com_hub = runtime.com_hub();
            let has_interface = { com_hub.has_interface(&interface_uuid) };
            if has_interface {
                com_hub
                    .remove_interface(interface_uuid.clone())
                    .await
                    .map_err(|e| JsError::new(&format!("{e:?}")))?;
                Ok(JsValue::TRUE)
            } else {
                error!("Failed to find interface");
                Err(JsError::new("Failed to find interface").into())
            }
        })
    }

    pub async fn update(&self) {
        self.com_hub().update_async().await;
    }

    /// Send a block to the given interface and socket
    /// This does not involve the routing on the ComHub level.
    /// The socket UUID is used to identify the socket to send the block over
    /// The interface UUID is used to identify the interface to send the block over
    pub async fn send_block(
        &self,
        block: &[u8],
        interface_uuid: String,
        socket_uuid: String,
    ) -> bool {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));
        let socket_uuid =
            ComInterfaceSocketUUID(UUID::from_string(socket_uuid));
        self.com_hub().get_dyn_interface_by_uuid(&interface_uuid)
            .expect("Failed to find interface")
            .borrow_mut()
            .send_block(block, socket_uuid)
            .await
    }

    pub fn _drain_incoming_blocks(&self) -> Vec<js_sys::Uint8Array> {
        let mut sections = self
            .com_hub()
            .block_handler
            .incoming_sections_queue
            .borrow_mut();
        let sections = sections.drain(..).collect::<Vec<_>>();

        let mut blocks = vec![];

        for section in sections {
            match section {
                IncomingSection::SingleBlock(block) => {
                    blocks.push(block.clone());
                }
                _ => {
                    panic!("Expected single block, but got block stream");
                }
            }
        }

        blocks
            .iter()
            .map(|(block, ..)| {
                let bytes = block.clone().unwrap().to_bytes().unwrap();
                let entry =
                    js_sys::Uint8Array::new_with_length(bytes.len() as u32);
                entry.copy_from(&bytes);
                entry
            })
            .collect::<Vec<_>>()
    }
}
