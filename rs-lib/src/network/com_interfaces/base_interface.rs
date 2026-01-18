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
#[derive(Serialize, Deserialize)]
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
    AddSocket(Option<Endpoint>),
    RemoveSocket(ComInterfaceSocketUUID),
}

#[wasm_bindgen]
pub struct BaseInterfaceHandle {
    tx: UnboundedSender<BaseInterfaceEvent>,
    state: Rc<RefCell<BaseInterfaceState>>,
}

#[wasm_bindgen]
impl BaseInterfaceHandle {
    #[wasm_bindgen(js_name = "sendBlock")]
    pub fn send_block(&mut self, socket_uuid: String, data: Uint8Array) {
        let mut buf = vec![0u8; data.length() as usize];
        data.copy_to(&mut buf);
        let socket_uuid = ComInterfaceSocketUUID::from_string(socket_uuid);
        let _ = self
            .tx
            .start_send(BaseInterfaceEvent::SendBlock(socket_uuid, buf));
    }

    #[wasm_bindgen(js_name = "registerSocket")]
    pub fn register_socket(&mut self) {
        let _ = self.tx.start_send(BaseInterfaceEvent::AddSocket(None));
    }

    #[wasm_bindgen(js_name = "registerSocketWithEndpoint")]
    pub fn register_socket_with_endpoint(&mut self, endpoint: String) {
        let endpoint = Endpoint::from_str(&endpoint).unwrap();
        let _ = self
            .tx
            .start_send(BaseInterfaceEvent::AddSocket(Some(endpoint)));
    }

    #[wasm_bindgen(js_name = "removeSocket")]
    pub fn remove_socket(&mut self, socket_uuid: String) {
        let socket_uuid = ComInterfaceSocketUUID::from_string(socket_uuid);
        let _ = self
            .tx
            .start_send(BaseInterfaceEvent::RemoveSocket(socket_uuid));
    }

    pub fn destroy(&mut self) {
        self.tx.close_channel();
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
        let (js_event_tx, mut js_event_rx) =
            create_unbounded_channel::<BaseInterfaceEvent>();
        let handle = BaseInterfaceHandle {
            tx: js_event_tx,
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
                    js_event = js_event_rx.next().fuse() => {
                        let interface_manager_borrow = com_hub.interface_manager();
                        let interface_manager = interface_manager_borrow.borrow();
                        let interface = interface_manager.get_interface_by_uuid(&interface_uuid);

                        match js_event {
                            Some(event) => {
                                match event {
                                    BaseInterfaceEvent::SendBlock(socket_uuid, data) => {
                                        let dxb_block = DXBBlock::from_bytes(&data).await.unwrap();
                                        let _ = interface.send_block(dxb_block, socket_uuid);
                                    }
                                    BaseInterfaceEvent::AddSocket(endpoint) => {
                                    let direction = interface.properties().direction.clone();
                                    let (uuid, sender) = interface.socket_manager().lock().unwrap().create_and_init_socket_with_optional_endpoint(direction, 1, endpoint);
                                    }
                                    BaseInterfaceEvent::RemoveSocket(socket_uuid) => {
                                        interface.socket_manager().lock().unwrap().remove_socket(socket_uuid);
                                    }
                                }
                            }
                            None => {
                                // destroyed
                                interface.destroy();
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
}
