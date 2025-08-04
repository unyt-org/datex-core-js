use std::{future::Future, pin::Pin, str::FromStr};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use datex_core::{delegate_com_interface_info, network::com_interfaces::{
    com_interface::ComInterface,
    com_interface_properties::{InterfaceDirection, InterfaceProperties},
    com_interface_socket::ComInterfaceSocketUUID,
    default_com_interfaces::base_interface::{
        BaseInterfaceError,
    },
    socket_provider::MultipleSocketProvider,
}, set_sync_opener, utils::uuid::UUID};
use datex_core::macros::{com_interface, create_opener};
use datex_core::network::com_hub::ComHubError;
use datex_core::network::com_interfaces::com_interface::{ComInterfaceError, ComInterfaceFactory, ComInterfaceInfo, ComInterfaceSockets};
use datex_core::network::com_interfaces::com_interface_socket::ComInterfaceSocket;
use datex_core::network::com_interfaces::default_com_interfaces::base_interface::{BaseInterfaceSetupData, OnSendCallback};
use datex_core::values::core_values::endpoint::Endpoint;
use log::error;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::js_sys::{Function, Promise, Uint8Array};
use crate::wrap_error_for_js;
use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use crate::network::com_hub::JSComHub;

// define_registry!(BaseJSInterface);
wrap_error_for_js!(JsBaseInterfaceError, datex_core::network::com_interfaces::default_com_interfaces::base_interface::BaseInterfaceError);

impl From<ComHubError> for JsBaseInterfaceError {
    fn from(err: ComHubError) -> Self {
        BaseInterfaceError::ComHubError(err).into()
    }
}

#[wasm_bindgen]
pub struct BaseJSInterface {
    info: ComInterfaceInfo,
    on_send: Option<Box<OnSendCallback>>,
    properties: InterfaceProperties,
}

#[wasm_bindgen(typescript_custom_section)]
const BASE_INTERFACE_SETUP_DATA: &'static str = r#"
type BaseInterfaceSetupData = {
    name?: string;
    interface_type: string;
    channel: string;
    direction: "In" | "Out" | "InOut";
    round_trip_time: number;
    max_bandwidth: number;
    continuous_connection: boolean;
    allow_redirects: boolean;
    is_secure_channel: boolean;
    reconnect_attempts?: number;
    reconnection_config: 
        "NoReconnect" | 
        "InstantReconnect" | 
        {
            ReconnectWithTimeout: {
                timeout: number;
            }
        } | 
        {
            ReconnectWithTimeoutAndAttempts: {
                timeout: number;
                attempts: number;
            }
        };
};
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "InterfaceProperties | string")]
    pub type JSInterfacePropertiesOrName;

    #[wasm_bindgen(typescript_type = "InterfaceProperties")]
    pub type JSInterfaceProperties;
}

impl Default for BaseJSInterface {
    fn default() -> Self {
        Self::new_with_name("unknown")
    }
}


#[com_interface]
impl BaseJSInterface {
    pub fn new_with_single_socket(
        name: &str,
        direction: InterfaceDirection,
    ) -> BaseJSInterface {
        let interface = BaseJSInterface::new_with_name(name);
        let socket =
            ComInterfaceSocket::new(interface.get_uuid().clone(), direction, 1);
        let socket_uuid = socket.uuid.clone();
        let socket = Arc::new(Mutex::new(socket));
        interface.add_socket(socket);
        interface
            .register_socket_endpoint(socket_uuid, Endpoint::default(), 1)
            .unwrap();
        interface
    }

    pub fn new() -> BaseJSInterface {
        Self::new_with_name("unknown")
    }

    pub fn new_with_name(name: &str) -> BaseJSInterface {
        Self::new_with_properties(InterfaceProperties {
            interface_type: name.to_string(),
            round_trip_time: Duration::from_millis(0),
            max_bandwidth: u32::MAX,
            ..InterfaceProperties::default()
        })
    }
    pub fn new_with_properties(
        properties: InterfaceProperties,
    ) -> BaseJSInterface {
        BaseJSInterface {
            info: ComInterfaceInfo::default(),
            properties,
            on_send: None,
        }
    }

    #[create_opener]
    fn open(&mut self) -> Result<(), ()> {
        Ok(())
    }

    pub fn register_new_socket(
        &mut self,
        direction: InterfaceDirection,
    ) -> ComInterfaceSocketUUID {
        let socket =
            ComInterfaceSocket::new(self.get_uuid().clone(), direction, 1);
        let socket_uuid = socket.uuid.clone();
        let socket = Arc::new(Mutex::new(socket));
        self.add_socket(socket);
        socket_uuid
    }
    pub fn register_new_socket_with_endpoint(
        &mut self,
        direction: InterfaceDirection,
        endpoint: Endpoint,
    ) -> ComInterfaceSocketUUID {
        let socket_uuid = self.register_new_socket(direction);
        self.register_socket_endpoint(socket_uuid.clone(), endpoint, 1)
            .unwrap();
        socket_uuid
    }

    pub fn set_on_send_callback(
        &mut self,
        on_send: Box<OnSendCallback>,
    ) -> &mut Self {
        self.on_send = Some(on_send);
        self
    }

    pub fn receive(
        &mut self,
        receiver_socket_uuid: ComInterfaceSocketUUID,
        data: Vec<u8>,
    ) -> Result<(), BaseInterfaceError> {
        match self.get_socket_with_uuid(receiver_socket_uuid) { Some(socket) => {
            let socket = socket.lock().unwrap();
            let receive_queue = socket.get_receive_queue();
            receive_queue.lock().unwrap().extend(data);
            Ok(())
        } _ => {
            error!("Socket not found");
            Err(BaseInterfaceError::SocketNotFound)
        }}
    }
}

impl MultipleSocketProvider for BaseJSInterface {
    fn provide_sockets(&self) -> Arc<Mutex<ComInterfaceSockets>> {
        self.get_sockets().clone()
    }
}

impl ComInterface for BaseJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        socket_uuid: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        if !self.has_socket_with_uuid(socket_uuid.clone()) {
            return Box::pin(async move { false });
        }
        if let Some(on_send) = &self.on_send {
            on_send(block, socket_uuid)
        } else {
            Box::pin(async move { false })
        }
    }

    fn init_properties(&self) -> InterfaceProperties {
        self.properties.clone()
    }
    fn handle_close<'a>(
        &'a mut self,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move { true })
    }
    delegate_com_interface_info!();
    set_sync_opener!(open);
}

impl ComInterfaceFactory<BaseInterfaceSetupData> for BaseJSInterface {
    fn create(
        setup_data: BaseInterfaceSetupData,
    ) -> Result<BaseJSInterface, ComInterfaceError> {
        Ok(BaseJSInterface::new_with_properties(setup_data.0))
    }

    fn get_default_properties() -> InterfaceProperties {
        InterfaceProperties::default()
    }
}

#[wasm_bindgen]
impl JSComHub {
    pub fn base_interface_register_socket(&self, uuid: String, direction: String) -> Result<String, JsBaseInterfaceError> {
        let interface_direction = InterfaceDirection::from_str(&direction).map_err(|_| {
            BaseInterfaceError::InvalidInput("Invalid direction".to_string())
        })?;
        let base_interface = self.get_interface_for_uuid::<BaseJSInterface>(uuid)?;
        Ok(base_interface.borrow_mut().register_new_socket(interface_direction).0.to_string())
    }

    pub fn base_interface_receive(&self, uuid: String, socket_uuid: String, data: Vec<u8>) -> Result<(), JsBaseInterfaceError> {
        let base_interface = self.get_interface_for_uuid::<BaseJSInterface>(uuid)?;
        let socket_uuid = ComInterfaceSocketUUID::from_string(socket_uuid);
        Ok(base_interface
            .borrow_mut()
            .receive(socket_uuid, data)?)
    }

    pub fn base_interface_destroy_socket(
        &self,
        uuid: String,
        socket_uuid: String,
    ) -> Result<(), JsBaseInterfaceError> {
        let base_interface = self.get_interface_for_uuid::<BaseJSInterface>(uuid)?;
        let socket_uuid =
            ComInterfaceSocketUUID::from_string(socket_uuid);
        if base_interface
            .borrow()
            .has_socket_with_uuid(socket_uuid.clone())
        {
            base_interface.borrow_mut().remove_socket(&socket_uuid);
            Ok(())
        } else {
            Err(BaseInterfaceError::SocketNotFound.into())
        }
    }

    pub fn base_interface_on_send(
        &mut self,
        uuid: String,
        func: Function
    ) -> Result<(), JsBaseInterfaceError> {
        let base_interface = self.get_interface_for_uuid::<BaseJSInterface>(uuid)?;
        let callback = move | block: &[u8], uuid: ComInterfaceSocketUUID| -> Pin<Box<dyn Future<Output = bool>>> {
            let block = Uint8Array::from(block);
            let socket_uuid = JsValue::from(uuid.0.to_string());
            let result = func
                .call2(&JsValue::NULL, &block.into(), &socket_uuid)
                .expect("Callback threw");
            let future = async move {
                match JsFuture::from(Promise::from(result)).await {
                    Ok(val) => val.as_bool().unwrap_or(false),
                    Err(_) => false,
                }
            };
            Box::pin(future)
        };
        base_interface
            .borrow_mut()
            .set_on_send_callback(Box::new(callback));
        Ok(())
    }

    pub async fn base_interface_test_send_block(
        &self,
        uuid: String,
        socket_uuid: String,
        data: &[u8],
    ) -> Result<bool, JsBaseInterfaceError> {
        let base_interface = self.get_interface_for_uuid::<BaseJSInterface>(uuid)?;
        Ok(
            base_interface
            .borrow_mut()
            .send_block(
                data,
                ComInterfaceSocketUUID(UUID::from_string(socket_uuid)),
            )
            .await
        )
    }
}