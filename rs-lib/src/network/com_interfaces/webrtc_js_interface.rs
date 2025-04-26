use std::{cell::RefCell, rc::Rc};

use datex_core::network::com_interfaces::{
    com_interface::ComInterface,
    default_com_interfaces::webrtc::webrtc_client_interface::WebRTCClientInterface,
};
use log::error;
use wasm_bindgen::{prelude::wasm_bindgen, JsError, JsValue};
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::Promise;

use crate::define_registry;

define_registry!(WebRTCClientRegistry);

#[wasm_bindgen]
impl WebRTCClientRegistry {
    pub async fn register(&self, address: String) -> Promise {
        let com_hub = self.com_hub.clone();
        let address_clone = address.clone();
        future_to_promise(async move {
            let webrtc_interface =
                WebRTCClientInterface::open_reliable(&address_clone, None)
                    .await
                    .map_err(|e| JsError::new(&format!("{e:?}")))?;
            let interface_uuid = webrtc_interface.get_uuid().clone();
            com_hub
                .lock()
                .unwrap()
                .add_interface(Rc::new(RefCell::new(webrtc_interface)))
                .map_err(|e| JsError::new(&format!("{e:?}")))?;
            Ok(JsValue::from_str(&interface_uuid.0.to_string()))
        })
    }
}
