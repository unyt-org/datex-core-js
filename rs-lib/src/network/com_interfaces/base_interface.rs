use std::{cell::RefCell, future::Future, pin::Pin, rc::Rc, str::FromStr};
use datex_core::{
    network::com_interfaces::{
        com_interface::ComInterface,
        com_interface_properties::{InterfaceDirection, InterfaceProperties},
        com_interface_socket::ComInterfaceSocketUUID,
        default_com_interfaces::base_interface::{
            BaseInterface, BaseInterfaceError,
        },
        socket_provider::MultipleSocketProvider,
    },
    utils::uuid::UUID,
};
use datex_core::network::com_interfaces::com_interface::{ComInterfaceError, ComInterfaceFactory};
use datex_core::runtime::Runtime;
use js_sys::Error;
use serde::{Deserialize, Serialize};
use wasm_bindgen::{prelude::wasm_bindgen, JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::js_sys::{Function, Promise, Uint8Array};
use crate::wrap_error_for_js;
use crate::runtime::JSRuntime;

// define_registry!(BaseJSInterface);
wrap_error_for_js!(JsBaseInterfaceError, datex_core::network::com_interfaces::default_com_interfaces::base_interface::BaseInterfaceError);

#[wasm_bindgen]
pub struct BaseJSInterface {
    runtime: Runtime,
    interface: Rc<RefCell<BaseInterface>>,
}

#[wasm_bindgen(typescript_custom_section)]
const INTERFACE_PROPERTIES: &'static str = r#"
type InterfaceProperties = {
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

#[wasm_bindgen]
impl BaseJSInterface {
    #[wasm_bindgen(getter)]
    pub fn properties(&self) -> JSInterfaceProperties {
        let properties = serde_wasm_bindgen::to_value(
            &self.interface.borrow().init_properties(),
        )
        .expect("Failed to convert properties");
        let properties = js_sys::Object::from(properties);
        // Remove the close_timestamp property from the properties object
        // to avoid exposing it to the JS side
        js_sys::Reflect::delete_property(
            &properties,
            &JsValue::from_str("close_timestamp"),
        )
        .unwrap();
        properties.unchecked_into::<JSInterfaceProperties>()
    }

    #[wasm_bindgen(getter)]
    pub fn uuid(&self) -> String {
        self.interface.borrow().get_uuid().0.to_string()
    }

    // test method
    pub async fn test_send_block(
        &self,
        socket_uuid: String,
        data: &[u8],
    ) -> bool {
        self.interface
            .borrow_mut()
            .send_block(
                data,
                ComInterfaceSocketUUID(UUID::from_string(socket_uuid)),
            )
            .await
    }

    pub fn on_send(&mut self, func: Function) {
        let callback = move |block: &[u8],
                             uuid: ComInterfaceSocketUUID|
              -> Pin<Box<dyn Future<Output = bool>>> {
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
        self.interface
            .borrow_mut()
            .set_on_send_callback(Box::new(callback));
    }

    pub fn register_socket(&self, direction: &str) -> Result<String, Error> {
        let direction = InterfaceDirection::from_str(direction)
            .map_err(|_| Error::new("Invalid direction"))?;
        Ok(self
            .interface
            .borrow_mut()
            .register_new_socket(direction)
            .0
            .to_string())
    }

    pub fn destroy_socket(
        &self,
        socket_uuid: String,
    ) -> Result<(), JsBaseInterfaceError> {
        let socket_uuid =
            ComInterfaceSocketUUID(UUID::from_string(socket_uuid));
        if self
            .interface
            .borrow_mut()
            .has_socket_with_uuid(socket_uuid.clone())
        {
            self.interface.borrow_mut().remove_socket(&socket_uuid);
            Ok(())
        } else {
            Err(BaseInterfaceError::SocketNotFound.into())
        }
    }

    pub async fn receive(
        &self,
        socket_uuid: String,
        data: Vec<u8>,
    ) -> Result<(), JsBaseInterfaceError> {
        let socket_uuid =
            ComInterfaceSocketUUID(UUID::from_string(socket_uuid));
        self.interface.borrow_mut().receive(socket_uuid, data)?;
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
struct BaseInterfaceSetupData(InterfaceProperties);

impl ComInterfaceFactory<BaseInterfaceSetupData> for BaseJSInterface {
    fn create(
        setup_data: BaseInterfaceSetupData,
    ) -> Result<BaseInterface, ComInterfaceError> {
        Ok(BaseInterface::new_with_properties(setup_data.0))
    }

    fn get_default_properties() -> InterfaceProperties {
        InterfaceProperties::default()
    }
}