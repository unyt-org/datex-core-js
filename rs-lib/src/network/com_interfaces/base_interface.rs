use std::{cell::RefCell, future::Future, pin::Pin, rc::Rc, str::FromStr};

use datex_core::{
    network::com_interfaces::{
        com_interface::ComInterface,
        com_interface_properties::InterfaceDirection,
        com_interface_socket::ComInterfaceSocketUUID,
        default_com_interfaces::base_interface::BaseInterface,
    },
    utils::uuid::UUID,
};
use js_sys::Error;
use log::info;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    console,
    js_sys::{Function, Promise, Uint8Array},
};

use crate::{network::com_hub::JSComHub, wrap_error_for_js};

// define_registry!(BaseJSInterface);
wrap_error_for_js!(JsBaseInterfaceError, datex_core::network::com_interfaces::default_com_interfaces::base_interface::BaseInterfaceError);

#[wasm_bindgen]
pub struct BaseJSInterface {
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
        let result = self
            .interface
            .borrow_mut()
            .send_block(
                data,
                ComInterfaceSocketUUID(UUID::from_string(socket_uuid)),
            )
            .await;

        let x = JsValue::from(true);
        info!("Result1: {x:?}");
        info!("Result2: {:?}", JsValue::as_bool(&x));
        console::log_1(&x);

        let x = JsValue::from(JsValue::as_bool(&JsValue::FALSE));
        info!("Result1: {x:?}");
        info!("Result2: {:?}", JsValue::as_bool(&x));
        info!("Result3: {:?}", JsValue::from_bool(false));

        true
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
        info!("Registering socket with direction: {:?}", direction);
        Ok(self
            .interface
            .borrow_mut()
            .register_new_socket(direction)
            .0
            .to_string())
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

    // #[wasm_bindgen]
    // pub fn register_socket(&self, direction: &str) {
    //     let interface_uuid = self.interface_uuid.clone();
    //     let interface =
    //         self.com_hub.get_interface_by_uuid(&interface_uuid).unwrap();
    //     let interface = interface.clone();
    //     let mut interface = interface.borrow_mut();
    //     let base_interface = interface
    //         .as_any_mut()
    //         .downcast_mut::<BaseInterface>()
    //         .unwrap();
    //     base_interface.register_new_socket(
    //         InterfaceDirection::from_str(direction).unwrap(),
    //     );
    // }
}
