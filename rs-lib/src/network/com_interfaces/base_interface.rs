use crate::{
    network::{com_hub::JSComHub, errors::JsComInterfaceError},
    wrap_error_for_js,
};
use datex_core::{
    network::{
        com_hub::{InterfacePriority, errors::InterfaceCreateError},
        com_interfaces::com_interface::{
            ComInterfaceProxy, ComInterfaceUUID,
            error::ComInterfaceError,
            implementation::ComInterfaceSyncFactory,
            properties::{InterfaceDirection, InterfaceProperties},
        },
    },
    serde::{
        deserializer::from_value_container, serializer::to_value_container,
    },
    utils::uuid::UUID,
    values::{
        core_values::endpoint::Endpoint, value_container::ValueContainer,
    },
};
use log::error;
use serde::{Deserialize, Serialize};
use std::{
    future::Future,
    pin::Pin,
    str::FromStr,
    sync::{Arc, Mutex},
    time::Duration,
};
use wasm_bindgen::{JsError, JsValue, prelude::wasm_bindgen};
use wasm_bindgen_futures::JsFuture;
use web_sys::js_sys::{Function, Promise, Uint8Array};

#[wasm_bindgen]
#[derive(tsify::Tsify, Serialize, Deserialize)]
pub struct BaseJSInterfaceSetupData(InterfaceProperties);
impl ComInterfaceSyncFactory for BaseJSInterfaceSetupData {
    fn create_interface(
        self,
        mut com_interface_proxy: ComInterfaceProxy,
    ) -> Result<InterfaceProperties, InterfaceCreateError> {
        Ok(self.0)
    }
    fn get_default_properties() -> InterfaceProperties {
        InterfaceProperties {
            interface_type: "local".to_string(),
            channel: "local".to_string(),
            auto_identify: false,
            round_trip_time: Duration::from_millis(0),
            max_bandwidth: u32::MAX,
            ..InterfaceProperties::default()
        }
    }
}

// impl BaseJSInterfaceSetupData {
//     pub fn register_new_socket(
//         &mut self,
//         direction: InterfaceDirection,
//     ) -> ComInterfaceSocketUUID {
//         let socket =
//             ComInterfaceSocket::new(self.get_uuid().clone(), direction, 1);
//         let socket_uuid = socket.uuid.clone();
//         let socket = Arc::new(Mutex::new(socket));
//         self.add_socket(socket);
//         socket_uuid
//     }
//     pub fn register_new_socket_with_endpoint(
//         &mut self,
//         direction: InterfaceDirection,
//         endpoint: Endpoint,
//     ) -> ComInterfaceSocketUUID {
//         let socket_uuid = self.register_new_socket(direction);
//         self.register_socket_endpoint(socket_uuid.clone(), endpoint, 1)
//             .unwrap();
//         socket_uuid
//     }

//     pub fn set_on_send_callback(
//         &mut self,
//         on_send: Box<OnSendCallback>,
//     ) -> &mut Self {
//         self.on_send = Some(on_send);
//         self
//     }

//     pub fn receive(
//         &mut self,
//         receiver_socket_uuid: ComInterfaceSocketUUID,
//         data: Vec<u8>,
//     ) -> Result<(), BaseInterfaceError> {
//         match self.get_socket_with_uuid(receiver_socket_uuid) {
//             Some(socket) => {
//                 let socket = socket.lock().unwrap();
//                 let receive_queue = socket.get_receive_queue();
//                 receive_queue.lock().unwrap().extend(data);
//                 Ok(())
//             }
//             _ => {
//                 error!("Socket not found");
//                 Err(BaseInterfaceError::SocketNotFound)
//             }
//         }
//     }
// }

pub enum JsBaseInterfaceError {
    InvalidInput(String),
}

impl From<JsBaseInterfaceError> for JsValue {
    fn from(err: JsBaseInterfaceError) -> JsValue {
        match err {
            JsBaseInterfaceError::InvalidInput(msg) => {
                JsError::new(&msg).into()
            }
        }
    }
}

#[wasm_bindgen]
impl JSComHub {
    pub async fn create_base_interface(
        &self,
        setup_data: String,
        priority: Option<u16>,
    ) -> Promise {
        self.create_interface("base".to_string(), setup_data, priority)
    }
    pub fn base_interface_register_socket(
        &self,
        uuid: String,
        direction: String,
    ) -> Result<String, JsBaseInterfaceError> {
        self.base_interface_register_socket_with_endpoint(uuid, direction, None)
    }
    pub fn base_interface_register_socket_with_endpoint(
        &self,
        uuid: String,
        direction: String,
        endpoint: Option<String>,
    ) -> Result<String, JsBaseInterfaceError> {
        let interface_direction = InterfaceDirection::from_str(&direction)
            .map_err(|e| JsBaseInterfaceError::InvalidInput(e.to_string()))?;
        let interface_uuid = ComInterfaceUUID::from_string(uuid);
        let interface_manager = self.com_hub().interface_manager();
        let interface_borrow = interface_manager.borrow();
        let interface = interface_borrow.get_interface_by_uuid(&interface_uuid);

        let endpoint = endpoint
            .map(|e| {
                Endpoint::from_str(&e).map_err(|e| {
                    JsBaseInterfaceError::InvalidInput(e.to_string())
                })
            })
            .transpose()?;

        let (socket_uuid, sender) = interface
            .socket_manager()
            .lock()
            .unwrap()
            .create_and_init_socket_with_optional_endpoint(
                interface_direction,
                1,
                endpoint,
            );
        Ok(socket_uuid.to_string())
    }
    // pub fn base_interface_register_socket(
    //     &self,
    //     uuid: String,
    //     direction: String,
    // ) -> Result<String, JsBaseInterfaceError> {
    //     let interface_direction = InterfaceDirection::from_str(&direction)
    //         .map_err(|_| {
    //             BaseInterfaceError::InvalidInput(
    //                 "Invalid direction".to_string(),
    //             )
    //         })?;
    //     let base_interface =
    //         self.get_interface_for_uuid::<BaseJSInterfaceSetupData>(uuid)?;
    //     Ok(base_interface
    //         .borrow_mut()
    //         .register_new_socket(interface_direction)
    //         .0
    //         .to_string())
    // }

    // pub fn base_interface_receive(
    //     &self,
    //     uuid: String,
    //     socket_uuid: String,
    //     data: Vec<u8>,
    // ) -> Result<(), JsBaseInterfaceError> {
    //     let base_interface =
    //         self.get_interface_for_uuid::<BaseJSInterfaceSetupData>(uuid)?;
    //     let socket_uuid = ComInterfaceSocketUUID::from_string(socket_uuid);
    //     Ok(base_interface.borrow_mut().receive(socket_uuid, data)?)
    // }

    // pub fn base_interface_destroy_socket(
    //     &self,
    //     uuid: String,
    //     socket_uuid: String,
    // ) -> Result<(), JsBaseInterfaceError> {
    //     let base_interface =
    //         self.get_interface_for_uuid::<BaseJSInterfaceSetupData>(uuid)?;
    //     let socket_uuid = ComInterfaceSocketUUID::from_string(socket_uuid);
    //     if base_interface
    //         .borrow()
    //         .has_socket_with_uuid(socket_uuid.clone())
    //     {
    //         base_interface.borrow_mut().remove_socket(&socket_uuid);
    //         Ok(())
    //     } else {
    //         Err(BaseInterfaceError::SocketNotFound.into())
    //     }
    // }

    // pub fn base_interface_on_send(
    //     &mut self,
    //     uuid: String,
    //     func: Function,
    // ) -> Result<(), JsBaseInterfaceError> {
    //     let base_interface =
    //         self.get_interface_for_uuid::<BaseJSInterfaceSetupData>(uuid)?;
    //     let callback = move |block: &[u8],
    //                          uuid: ComInterfaceSocketUUID|
    //           -> Pin<Box<dyn Future<Output = bool>>> {
    //         let block = Uint8Array::from(block);
    //         let socket_uuid = JsValue::from(uuid.0.to_string());
    //         let result = func
    //             .call2(&JsValue::NULL, &block.into(), &socket_uuid)
    //             .expect("Callback threw");
    //         let future = async move {
    //             match JsFuture::from(Promise::from(result)).await {
    //                 Ok(val) => val.as_bool().unwrap_or(false),
    //                 Err(_) => false,
    //             }
    //         };
    //         Box::pin(future)
    //     };
    //     base_interface
    //         .borrow_mut()
    //         .set_on_send_callback(Box::new(callback));
    //     Ok(())
    // }

    // pub async fn base_interface_test_send_block(
    //     &self,
    //     uuid: String,
    //     socket_uuid: String,
    //     data: &[u8],
    // ) -> Result<bool, JsBaseInterfaceError> {
    //     let base_interface =
    //         self.get_interface_for_uuid::<BaseJSInterfaceSetupData>(uuid)?;
    //     Ok(base_interface
    //         .borrow_mut()
    //         .send_block(
    //             data,
    //             ComInterfaceSocketUUID(UUID::from_string(socket_uuid)),
    //         )
    //         .await)
    // }
}
