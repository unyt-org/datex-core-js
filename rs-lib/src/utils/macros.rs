#[macro_export]
macro_rules! define_registry {
    ($name:ident) => {
        #[derive(Clone)]
        #[wasm_bindgen]
        pub struct $name {
            com_hub: std::sync::Arc<
                std::sync::Mutex<datex_core::network::com_hub::ComHub>,
            >,
        }

        impl $name {
            pub fn new(
                com_hub: std::sync::Arc<
                    std::sync::Mutex<datex_core::network::com_hub::ComHub>,
                >,
            ) -> Self {
                Self { com_hub }
            }
        }

        #[wasm_bindgen]
        impl $name {
            pub fn close(&self, interface_uuid: String) -> web_sys::js_sys::Promise {
                let interface_uuid = datex_core::network::com_interfaces::com_interface::ComInterfaceUUID(
                    datex_core::utils::uuid::UUID::from_string(interface_uuid),
                );
                let com_hub = self.com_hub.clone();
                wasm_bindgen_futures::future_to_promise(async move {
                    let com_hub = com_hub.clone();
                    let has_interface = {
                        let com_hub = com_hub.lock().map_err(|_| {
                            JsError::new("Failed to lock ComHub")
                        })?;
                        com_hub.has_interface(&interface_uuid)
                    };
                    if has_interface {
                        let com_hub = com_hub.clone();
                        let mut com_hub_mut = com_hub.lock().map_err(|_| {
                            JsError::new("Failed to lock ComHub")
                        })?;

                        com_hub_mut
                            .remove_interface(interface_uuid.clone())
                            .await
                            .map_err(|e| JsError::new(&format!("{:?}", e)))?;
                        Ok(JsValue::TRUE)
                    } else {
                        error!("Failed to find interface");
                        Err(JsError::new("Failed to find interface").into())
                    }
                })
            }
        }
    };
}
