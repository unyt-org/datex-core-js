#[cfg(feature = "wasm_matchbox")]
use super::com_interfaces::matchbox_js_interface::MatchboxClientRegistry;
#[cfg(feature = "wasm_serial")]
use super::com_interfaces::serial_js_interface::SerialRegistry;
#[cfg(feature = "wasm_webrtc")]
use super::com_interfaces::webrtc_js_interface::WebRTCRegistry;
#[cfg(feature = "wasm_websocket_client")]
use super::com_interfaces::websocket_client_js_interface::WebSocketClientRegistry;
#[cfg(feature = "wasm_websocket_server")]
use super::com_interfaces::websocket_server_js_interface::WebSocketServerRegistry;

use datex_core::global::dxb_block::IncomingSection;
use datex_core::network::com_hub::InterfacePriority;
use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceUUID,
};
use datex_core::network::com_interfaces::com_interface_socket::ComInterfaceSocketUUID;
use datex_core::stdlib::{cell::RefCell, rc::Rc};
use datex_core::{network::com_hub::ComHub, utils::uuid::UUID};
use datex_core::runtime::Runtime;
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
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSComHub {
    // pub(crate) async fn open_and_add_interface<T: ComInterface>(
    //     &self,
    //     interface: Rc<RefCell<T>>,
    // ) {
    //     interface.clone().borrow_mut().handle_open().await;
    //     self.com_hub
    //         .lock()
    //         .unwrap()
    //         .add_interface(interface)
    //         .expect("Failed to add interface");
    // }

    fn com_hub(&self) -> &ComHub {
        self.runtime.com_hub()
    }

    /// Add an interface to the ComHub. If the interface is not open,
    /// it will not be opened by the ComHub.
    /// This is useful for adding interfaces that are already open.
    pub(crate) fn add_interface<T: ComInterface>(
        &self,
        interface: Rc<RefCell<T>>,
    ) -> Result<(), JsValue> {
        // TODO: set custom interface priority
        self.com_hub()
            .add_interface(interface, InterfacePriority::default())
            .map_err(|e| JsError::new(&format!("{e:?}")))?;
        Ok(())
    }

    pub(crate) fn get_interface_by_uuid(
        &self,
        interface_uuid: &ComInterfaceUUID,
    ) -> Option<Rc<RefCell<dyn ComInterface>>> {
        self.com_hub().get_dyn_interface_by_uuid(interface_uuid)
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

    #[cfg(feature = "wasm_websocket_server")]
    #[wasm_bindgen(getter)]
    pub fn websocket_server(&self) -> WebSocketServerRegistry {
        WebSocketServerRegistry::new(self.runtime.clone())
    }

    #[cfg(feature = "wasm_websocket_client")]
    #[wasm_bindgen(getter)]
    pub fn websocket_client(&self) -> WebSocketClientRegistry {
        WebSocketClientRegistry::new(self.runtime.clone())
    }

    #[cfg(feature = "wasm_serial")]
    #[wasm_bindgen(getter)]
    pub fn serial(&self) -> SerialRegistry {
        SerialRegistry::new(self.runtime.clone())
    }

    #[cfg(feature = "wasm_matchbox")]
    #[wasm_bindgen(getter)]
    pub fn matchbox(&self) -> MatchboxClientRegistry {
        MatchboxClientRegistry::new(self.runtime.clone())
    }

    #[cfg(feature = "wasm_webrtc")]
    #[wasm_bindgen(getter)]
    pub fn webrtc(&self) -> WebRTCRegistry {
        WebRTCRegistry::new(self.runtime.clone())
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
        self.get_interface_by_uuid(&interface_uuid)
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
