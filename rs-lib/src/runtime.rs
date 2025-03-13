use std::cell::RefCell;
use std::rc::Rc;

use datex_core::crypto;
use datex_core::crypto::crypto::Crypto;
use datex_core::datex_values::Pointer;
use datex_core::global::dxb_block::DXBBlock;
use datex_core::runtime::{Context, Runtime};
use datex_core::utils::logger::LoggerContext;
use tokio::sync::futures;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::{Promise, Uint8Array};

use crate::crypto::crypto_js::CryptoJS;
use crate::memory::JSMemory;
use crate::network::com_hub::JSComHub;

#[wasm_bindgen]
pub struct JSRuntime {
    runtime: Runtime,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSRuntime {
    pub fn create(ctx: Context) -> JSRuntime {
        let runtime = Runtime::new(Rc::new(RefCell::new(ctx)));
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
            let pair = crypto
                .new_encryption_key_pair()
                .await
                .map_err(|e| JsValue::from_str(&format!("{:?}", e)))?;
            let js_array = Uint8Array::from(pair.0.as_slice());
            Ok(js_array.into())
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
    pub fn com_hub(&self) -> JSComHub {
        JSComHub::new(Rc::clone(&self.runtime.com_hub))
    }

    #[wasm_bindgen]
    pub fn _create_block(&self, body: Option<Vec<u8>>) -> Vec<u8> {
        DXBBlock {
            body: body.unwrap_or(vec![]),
            ..DXBBlock::default()
        }
        .recalculate_struct()
        .to_bytes()
        .unwrap()
    }
}
