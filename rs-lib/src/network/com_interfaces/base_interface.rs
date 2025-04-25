use std::{
    cell::RefCell,
    future::Future,
    pin::Pin,
    rc::Rc,
    str::FromStr,
    sync::{Arc, Mutex},
};

use datex_core::{
    network::{
        com_hub::ComHub,
        com_interfaces::{
            com_interface::{ComInterface, ComInterfaceUUID},
            com_interface_properties::InterfaceDirection,
            com_interface_socket::ComInterfaceSocketUUID,
            default_com_interfaces::base_interface::{
                self, BaseInterface, OnSendCallback,
            },
        },
    },
    runtime::{self, global_context::get_global_context},
    utils::uuid::UUID,
};
use log::info;
use wasm_bindgen::{prelude::wasm_bindgen, JsCast, JsError, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    console::info,
    js_sys::{Function, Promise, Uint8Array},
};

use crate::{define_registry, network::com_hub::JSComHub, wrap_error_for_js};

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
    #[wasm_bindgen(js_name = _testSendBlock)]
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

        let x = JsValue::TRUE;
        info!("Result1: {:?}", x);
        info!("Result2: {:?}", JsValue::as_bool(&x));
        info!("Result3: {:?}", JsValue::from_bool(false));

        let x = JsValue::from(JsValue::as_bool(&JsValue::FALSE));
        info!("Result1: {:?}", x);
        info!("Result2: {:?}", JsValue::as_bool(&x));
        info!("Result3: {:?}", JsValue::from_bool(false));

        true
    }

    #[wasm_bindgen(js_name = setCallback)]
    pub fn set_callback(&mut self, func: Function) {
        let callback = move |block: &[u8],
                             uuid: ComInterfaceSocketUUID|
              -> Pin<Box<dyn Future<Output = bool>>> {
            let block = Uint8Array::from(block);
            let socket_val = JsValue::from(uuid.0.to_string());

            let result = func
                .call2(&JsValue::NULL, &block.into(), &socket_val)
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

    pub fn register_socket(&self, direction: &str) -> String {
        self.interface
            .borrow_mut()
            .register_new_socket(
                InterfaceDirection::from_str(direction).unwrap(),
            )
            .0
            .to_string()
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
