use std::{
    cell::RefCell,
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
            default_com_interfaces::base_interface::{self, BaseInterface},
        },
    },
    runtime::{self, global_context::get_global_context},
    utils::uuid::UUID,
};
use wasm_bindgen::{prelude::wasm_bindgen, JsError};

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
    pub async fn new(com_hub: JSComHub, name: &str) -> BaseJSInterface {
        let interface = BaseInterface::new(name);
        let interface = Rc::new(RefCell::new(interface));
        com_hub.add_interface(interface.clone());
        BaseJSInterface { com_hub, interface }
    }

    pub fn register_socket(&self, direction: &str) {
        self.interface.borrow_mut().register_new_socket(
            InterfaceDirection::from_str(direction).unwrap(),
        );
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
