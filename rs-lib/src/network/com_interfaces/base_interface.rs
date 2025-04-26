use std::{cell::RefCell, future::Future, pin::Pin, rc::Rc, str::FromStr};

use datex_core::{
    network::com_interfaces::{
        com_interface::ComInterface,
        com_interface_properties::InterfaceDirection,
        com_interface_socket::ComInterfaceSocketUUID,
        default_com_interfaces::base_interface::{
            BaseInterface, BaseInterfaceError,
        },
        socket_provider::MultipleSocketProvider,
    },
    utils::uuid::UUID,
};
use js_sys::Error;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::js_sys::{Function, Promise, Uint8Array};

use crate::{network::com_hub::JSComHub, wrap_error_for_js};

// define_registry!(BaseJSInterface);
wrap_error_for_js!(JsBaseInterfaceError, datex_core::network::com_interfaces::default_com_interfaces::base_interface::BaseInterfaceError);

#[wasm_bindgen]
struct BaseJSInterface {
    com_hub: JSComHub,
    interface: Rc<RefCell<BaseInterface>>,
}

#[wasm_bindgen]
impl BaseJSInterface {
    #[wasm_bindgen(constructor)]
    pub fn new(com_hub: JSComHub, name: &str) -> BaseJSInterface {
        let interface = BaseInterface::new(name);
        let interface = Rc::new(RefCell::new(interface));
        com_hub.add_interface(interface.clone());
        BaseJSInterface { com_hub, interface }
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
