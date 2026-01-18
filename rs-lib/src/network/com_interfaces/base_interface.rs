use crate::network::com_hub::JSComHub;
use datex_core::{
    global::dxb_block::DXBBlock,
    network::{
        com_hub::{InterfacePriority, errors::InterfaceCreateError},
        com_interfaces::com_interface::{
            ComInterfaceEvent, ComInterfaceProxy, ComInterfaceUUID,
            implementation::ComInterfaceSyncFactory,
            properties::{InterfaceDirection, InterfaceProperties},
            socket::ComInterfaceSocketUUID,
        },
    },
    runtime::AsyncContext,
    serde::deserializer::from_value_container,
    task::{
        UnboundedSender, create_unbounded_channel,
        spawn_with_panic_notify_default,
    },
    values::core_values::endpoint::Endpoint,
};
use futures::FutureExt;
use js_sys::{Function, Reflect, Uint8Array};
use serde::{Deserialize, Serialize};
use std::{cell::RefCell, rc::Rc, str::FromStr, time::Duration};
use wasm_bindgen::{JsCast, JsError, JsValue, prelude::wasm_bindgen};
use web_sys::js_sys::Promise;

#[wasm_bindgen]
#[derive(tsify::Tsify, Serialize, Deserialize)]
pub struct BaseJSInterfaceSetupData(InterfaceProperties);
impl ComInterfaceSyncFactory for BaseJSInterfaceSetupData {
    fn create_interface(
        self,
        com_interface_proxy: ComInterfaceProxy,
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

pub enum JsBaseInterfaceError {
    InvalidInput(String),
    SetupDataParseError,
}

impl From<JsBaseInterfaceError> for JsValue {
    fn from(err: JsBaseInterfaceError) -> JsValue {
        match err {
            JsBaseInterfaceError::InvalidInput(msg) => {
                JsError::new(&msg).into()
            }
            JsBaseInterfaceError::SetupDataParseError => {
                JsError::new("Failed to parse setup data").into()
            }
        }
    }
}

#[derive(Default)]
struct BaseInterfaceState {
    on_receive: Option<js_sys::Function>,
    on_closed: Option<js_sys::Function>,
}

pub enum BaseInterfaceEvent {
    SendBlock(ComInterfaceSocketUUID, Vec<u8>),
    AddSocket(ComInterfaceSocketUUID),
    RemoveSocket(ComInterfaceSocketUUID),
}

#[wasm_bindgen]
pub struct BaseInterfaceHandle {
    tx: UnboundedSender<(ComInterfaceSocketUUID, Vec<u8>)>,
    state: Rc<RefCell<BaseInterfaceState>>,
}

#[wasm_bindgen]
impl BaseInterfaceHandle {
    #[wasm_bindgen(js_name = "send")]
    pub fn send_js(&mut self, socket_uuid: String, data: Uint8Array) {
        let mut buf = vec![0u8; data.length() as usize];
        data.copy_to(&mut buf);
        let socket_uuid = ComInterfaceSocketUUID::from_string(socket_uuid);
        let _ = self.tx.start_send((socket_uuid, buf));
    }

    #[wasm_bindgen(js_name = "onReceive")]
    pub fn set_on_receive(&self, cb: js_sys::Function) {
        self.state.borrow_mut().on_receive.replace(cb);
    }

    #[wasm_bindgen(js_name = "onClosed")]
    pub fn set_on_closed(&self, cb: js_sys::Function) {
        self.state.borrow_mut().on_closed.replace(cb);
    }
}

#[wasm_bindgen]
impl JSComHub {
    pub async fn create_base_interface(
        &self,
        setup_data: String,
        priority: Option<u16>,
    ) -> Result<BaseInterfaceHandle, JsBaseInterfaceError> {
        let runtime = self.runtime.clone();
        let setup_data = runtime
            .execute_sync(&setup_data, &[], None)
            .map_err(|e| JsBaseInterfaceError::SetupDataParseError)?
            .ok_or_else(|| {
                JsBaseInterfaceError::InvalidInput(
                    "Failed to parse setup data".to_string(),
                )
            })?;
        let interface_properties =
            from_value_container::<InterfaceProperties>(setup_data)
                .map_err(|_| JsBaseInterfaceError::SetupDataParseError)?;
        let (proxy, interface) = ComInterfaceProxy::create_interface(
            interface_properties,
            AsyncContext::default(),
        );
        let interface_uuid = interface.0.uuid().clone();
        self.com_hub()
            .register_com_interface(
                interface,
                InterfacePriority::from(priority),
            )
            .unwrap();

        // intercept events from wrapper and forward to interface
        let (send_block_tx, mut send_block_rx) =
            create_unbounded_channel::<(ComInterfaceSocketUUID, Vec<u8>)>();
        let handle = BaseInterfaceHandle {
            tx,
            state: Rc::new(RefCell::new(BaseInterfaceState::default())),
        };
        let task_handle = handle.state.clone();
        use futures::{StreamExt, select};
        let com_hub = self.com_hub();
        wasm_bindgen_futures::spawn_local(async move {
            let mut hub_rx = proxy.event_receiver;
            loop {
                select! {
                    // Event from JS side
                    js_event = rx.next().fuse() => {
                        match js_event {
                            Some((uuid, data)) => {
                                let dxb_block = DXBBlock::from_bytes(&data).await.unwrap();
                                let interface_manager = com_hub.interface_manager();
                                let manager = interface_manager.borrow();
                                let interface = manager.get_interface_by_uuid(&interface_uuid);
                                let _ = interface.send_block(dxb_block, uuid);
                            }
                            None => {
                                break;
                            }
                        }
                    }

                    // Event from ComHub side
                    com_hub_event = hub_rx.next().fuse() => {
                        match com_hub_event {
                            Some(ComInterfaceEvent::SendBlock(block, socket_uuid)) => {
                                let bytes = block.to_bytes();
                                if let Some(cb) = task_handle.borrow().on_receive.as_ref() {
                                    let _ = cb.call2(
                                        &JsValue::NULL,
                                        &JsValue::from_str(socket_uuid.0.to_string().as_str()),
                                        &Uint8Array::from(bytes.as_slice()).into(),
                                    );
                                }

                            }
                            Some(ComInterfaceEvent::Destroy) => {
                                if let Some(cb) = task_handle.borrow().on_closed.as_ref() {
                                    let _ = cb.call0(&JsValue::NULL);
                                }
                                break;
                            }
                            Some(other) => {
                                todo!("Handle other events: {:?}", other);
                            }
                            None => break,
                        }
                    }
                }
            }
        });

        Ok(handle)
    }

    /// Registers a new socket on the base interface.
    pub fn base_interface_register_socket(
        &self,
        uuid: String,
        direction: String,
    ) -> Result<String, JsBaseInterfaceError> {
        self.base_interface_register_socket_with_endpoint(uuid, direction, None)
    }

    /// Registers a new socket on the base interface with an optional endpoint.
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
