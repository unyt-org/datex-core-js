use std::sync::{Arc, Mutex};

use datex_core::runtime::global_context::GlobalContext;
use datex_core::stdlib::rc::Rc;

use datex_core::crypto::crypto::CryptoTrait;
use datex_core::datex_values::{Endpoint, Pointer};
use datex_core::global::dxb_block::DXBBlock;
use datex_core::runtime::Runtime;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::Promise;

use crate::crypto::crypto_js::CryptoJS;
use crate::js_utils::js_array;
use crate::memory::JSMemory;
use crate::network::com_hub::JSComHub;
use crate::utils::time::TimeJS;

#[wasm_bindgen]
pub struct JSRuntime {
    runtime: Runtime,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSRuntime {
    pub fn create(endpoint: Endpoint) -> JSRuntime {
        let runtime = Runtime::init(
            endpoint,
            GlobalContext {
                crypto: Arc::new(Mutex::new(CryptoJS)),
                time: Arc::new(Mutex::new(TimeJS)),
            },
        );
        runtime.memory.borrow_mut().store_pointer(
            [
                10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
                150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 255,
            ],
            Pointer::from_id(Vec::new()),
        );
        JSRuntime::new(runtime)
    }

    pub fn new(runtime: Runtime) -> JSRuntime {
        JSRuntime { runtime }
    }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSRuntime {
    #[wasm_bindgen]
    pub async fn crypto_test_tmp(&self) -> Promise {
        future_to_promise(async move {
            let crypto = CryptoJS {};

            let sign_key_pair = crypto
                .new_sign_key_pair()
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

            let encryption_key_pair = crypto
                .new_encryption_key_pair()
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

            let encrypted_message = crypto
                .encrypt_rsa(vec![1, 2, 3], encryption_key_pair.0.clone())
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

            let decrypted_message = crypto
                .decrypt_rsa(
                    encrypted_message.clone(),
                    encryption_key_pair.1.clone(),
                )
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

            let signed_message = crypto
                .sign_rsa(vec![1, 2, 3], sign_key_pair.1.clone())
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

            let verified = crypto
                .verify_rsa(
                    vec![1, 2, 3],
                    signed_message.clone(),
                    sign_key_pair.0.clone(),
                )
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;

            if !verified {
                return Err(JsValue::from_str("Verification failed"));
            }

            let js_array = js_array(&[
                encryption_key_pair.0,
                encryption_key_pair.1,
                sign_key_pair.0,
                sign_key_pair.1,
                encrypted_message,
                decrypted_message,
                signed_message,
            ]);
            Ok(js_array)
        })
    }

    #[wasm_bindgen(getter)]
    pub fn version(&self) -> String {
        self.runtime.version.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn memory(&self) -> JSMemory {
        JSMemory::new(Rc::clone(&self.runtime.memory))
    }

    #[wasm_bindgen(getter)]
    pub fn endpoint(&self) -> String {
        self.runtime.endpoint.to_string()
    }

    #[wasm_bindgen(getter)]
    pub fn com_hub(&self) -> JSComHub {
        JSComHub::new(self.runtime.com_hub.clone())
    }

    #[wasm_bindgen]
    pub fn _create_block(
        &self,
        body: Option<Vec<u8>>,
        receivers: Vec<String>,
    ) -> Vec<u8> {
        let mut block = DXBBlock {
            body: body.unwrap_or_default(),
            ..DXBBlock::default()
        };

        block.recalculate_struct();
        block.set_receivers(
            &receivers
                .iter()
                .map(|r| Endpoint::from_string(r))
                .collect::<Result<Vec<Endpoint>, _>>()
                .unwrap(),
        );
        block.to_bytes().unwrap()
    }
}
