use std::{
    cell::RefCell,
    rc::Rc,
    sync::{Arc, Mutex},
};

use datex_core::{
    network::{
        com_hub::ComHub,
        com_interfaces::{
            com_interface::{ComInterface, ComInterfaceUUID},
            default_com_interfaces::base_interface::BaseInterface,
        },
    },
    runtime::{self, global_context::get_global_context},
};
use wasm_bindgen::{prelude::wasm_bindgen, JsError};

use crate::{define_registry, network::com_hub::JSComHub};

// define_registry!(BaseJSInterface);

#[wasm_bindgen]
struct BaseJSInterface {
    com_hub: JSComHub,
    interface_uuid: ComInterfaceUUID,
}

#[wasm_bindgen]
impl BaseJSInterface {
    #[wasm_bindgen(constructor)]
    pub async fn new(com_hub: JSComHub, name: &str) -> BaseJSInterface {
        let interface = BaseInterface::new(name);
        let uuid = interface.get_uuid().clone();
        com_hub.add_interface(interface);
        let interface_uuid = uuid.clone();
        BaseJSInterface {
            com_hub,
            interface_uuid,
        }
    }

    pub fn register_socket(&self) {
        let com_hub = self.com_hub;
        let interface_uuid = self.interface_uuid.clone();
        let interface = com_hub.get_interface(&interface_uuid).unwrap();
    }
}
