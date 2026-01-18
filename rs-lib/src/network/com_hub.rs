use datex_core::{
    global::dxb_block::DXBBlock,
    network::{
        com_hub::{ComHub, InterfacePriority},
        com_interfaces::com_interface::{
            ComInterfaceUUID, socket::ComInterfaceSocketUUID,
        },
    },
    runtime::Runtime,
    stdlib::rc::Rc,
    utils::uuid::UUID,
    values::core_values::endpoint::Endpoint,
};
use js_sys::Uint8Array;
use log::error;
use std::str::FromStr;
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
        JSComHub { runtime }
    }

    pub fn com_hub(&self) -> Rc<ComHub> {
        self.runtime.com_hub()
    }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSComHub {
    pub fn register_default_interface_factories(&self) {
        self.com_hub().register_sync_interface_factory::<
            crate::network::com_interfaces::base_interface::BaseJSInterfaceSetupData,
        >();

        #[cfg(feature = "wasm_websocket_client")]
        self.com_hub().register_async_interface_factory::<crate::network::com_interfaces::websocket_client_js_interface::WebSocketClientJSInterfaceSetupData>();

        // #[cfg(feature = "wasm_websocket_server")]
        // self.com_hub().register_async_interface_factory::<crate::network::com_interfaces::websocket_server_js_interface::WebSocketServerInterfaceSetupDataJS>();

        #[cfg(feature = "wasm_serial")]
        self.com_hub().register_async_interface_factory::<crate::network::com_interfaces::serial_js_interface::SerialInterfaceSetupDataJS>();

        // #[cfg(feature = "wasm_webrtc")]
        // self.com_hub().register_async_interface_factory::<crate::network::com_interfaces::webrtc_js_interface::WebRTCJSInterface>();
    }

    pub fn create_interface(
        &self,
        interface_type: String,
        properties: String,
        priority: Option<u16>,
    ) -> Promise {
        let runtime = self.runtime.clone();
        future_to_promise(async move {
            let com_hub = runtime.com_hub();
            let setup_data = runtime
                .execute_sync(&properties, &[], None)
                .map_err(|e| JsError::new(&format!("{e:?}")))?;
            if let Some(setup_data) = setup_data {
                let interface = com_hub
                    .create_interface(
                        &interface_type,
                        setup_data,
                        InterfacePriority::from(priority),
                        com_hub.async_context.clone(),
                    )
                    .await
                    .map_err(|e| JsError::new(&format!("{e:?}")))?;
                Ok(JsValue::from_str(&interface.to_string()))
            } else {
                Err(JsError::new(
                    "Failed to create interface: properties are empty",
                )
                .into())
            }
        })
    }

    pub fn close_interface(
        &self,
        interface_uuid: String,
    ) -> Result<JsValue, JsError> {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));
        let runtime = self.runtime.clone();
        let com_hub = runtime.com_hub();
        let has_interface = { com_hub.has_interface(&interface_uuid) };
        if has_interface {
            com_hub
                .remove_interface(interface_uuid.clone())
                .map_err(|e| JsError::new(&format!("{e:?}")))?;
            Ok(JsValue::TRUE)
        } else {
            error!("Failed to find interface");
            Err(JsError::new("Failed to find interface"))
        }
    }

    /// Send a block to the given interface and socket
    /// This does not involve the routing on the ComHub level.
    /// The socket UUID is used to identify the socket to send the block over
    /// The interface UUID is used to identify the interface to send the block over
    pub async fn send_block(
        &self,
        block: Uint8Array,
        interface_uuid: String,
        socket_uuid: String,
    ) -> Result<(), JsError> {
        let interface_uuid =
            ComInterfaceUUID(UUID::from_string(interface_uuid));
        let socket_uuid =
            ComInterfaceSocketUUID(UUID::from_string(socket_uuid));
        let block = DXBBlock::from_bytes(block.to_vec().as_slice())
            .await
            .map_err(|e| JsError::new(&format!("{e:?}")))?;
        self.com_hub()
            .interface_manager()
            .borrow()
            .get_interface_by_uuid(&interface_uuid)
            .send_block(block, socket_uuid);
        Ok(())
    }

    // pub fn _drain_incoming_blocks(&self) -> Vec<js_sys::Uint8Array> {
    //     let mut sections = self
    //         .com_hub()
    //         .block_handler
    //         .incoming_sections_queue
    //         .borrow_mut();
    //     let sections = sections.drain(..).collect::<Vec<_>>();

    //     let mut blocks = vec![];

    //     for section in sections {
    //         match section {
    //             IncomingSection::SingleBlock(block) => {
    //                 blocks.push(block.clone());
    //             }
    //             _ => {
    //                 panic!("Expected single block, but got block stream");
    //             }
    //         }
    //     }

    //     blocks
    //         .iter()
    //         .map(|(block, ..)| {
    //             let bytes = block.clone().unwrap().to_bytes().unwrap();
    //             let entry =
    //                 js_sys::Uint8Array::new_with_length(bytes.len() as u32);
    //             entry.copy_from(&bytes);
    //             entry
    //         })
    //         .collect::<Vec<_>>()
    // }

    #[cfg(feature = "debug")]
    pub fn get_metadata_string(&self) -> String {
        let metadata = self.com_hub().metadata();
        metadata.to_string()
    }

    #[cfg(feature = "debug")]
    pub async fn get_trace_string(&self, endpoint: String) -> Option<String> {
        let endpoint = Endpoint::from_str(&endpoint);
        if let Ok(endpoint) = endpoint {
            let trace = self.com_hub().record_trace(endpoint).await;
            trace.map(|t| t.to_string())
        } else {
            println!("Invalid endpoint: {}", endpoint.unwrap_err());
            None
        }
    }

    pub fn register_outgoing_block_interceptor(
        &self,
        callback: js_sys::Function,
    ) {
        self.com_hub().register_outgoing_block_interceptor(
            move |block, socket, endpoints| {
                let this = JsValue::NULL;
                let block_bytes =
                    js_sys::Uint8Array::from(block.to_bytes().as_slice());
                let socket_uuid = JsValue::from_str(&socket.0.to_string());
                let endpoints_array = js_sys::Array::new();
                for endpoint in endpoints {
                    endpoints_array
                        .push(&JsValue::from_str(&endpoint.to_string()));
                }
                if let Err(e) = callback.call3(
                    &this,
                    &JsValue::from(block_bytes),
                    &socket_uuid,
                    &endpoints_array,
                ) {
                    error!(
                        "Error in outgoing block interceptor callback: {:?}",
                        e
                    );
                }
            },
        );
    }

    pub fn register_incoming_block_interceptor(
        &self,
        callback: js_sys::Function,
    ) {
        self.com_hub().register_incoming_block_interceptor(
            move |block, socket| {
                let this = JsValue::NULL;
                let block_bytes =
                    js_sys::Uint8Array::from(block.to_bytes().as_slice());
                let socket_uuid = JsValue::from_str(&socket.0.to_string());
                if let Err(e) = callback.call2(
                    &this,
                    &JsValue::from(block_bytes),
                    &socket_uuid,
                ) {
                    error!(
                        "Error in incoming block interceptor callback: {:?}",
                        e
                    );
                }
            },
        );
    }
}
