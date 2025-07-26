use datex_core::values::core_values::endpoint::Endpoint;
#[cfg(feature = "debug")]
use datex_core::runtime::global_context::DebugFlags;
use datex_core::runtime::global_context::GlobalContext;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use log::info;
use crate::crypto::crypto_js::CryptoJS;
use crate::js_utils::js_array;
use crate::utils::time::TimeJS;
use datex_core::crypto::crypto::CryptoTrait;
use datex_core::decompiler::{decompile_value, DecompileOptions};
use datex_core::global::dxb_block::DXBBlock;
use datex_core::global::protocol_structures::block_header::{
    BlockHeader, FlagsAndTimestamp,
};
use datex_core::runtime::{Runtime, RuntimeInternal};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::Promise;
use crate::memory::JSMemory;
use crate::network::com_hub::JSComHub;

#[wasm_bindgen(getter_with_clone)]
pub struct JSRuntime {
    runtime: Runtime,
    pub com_hub: JSComHub,
    pub memory: JSMemory
}

#[derive(Serialize, Deserialize, Default)]
pub struct JSDebugFlags {
    pub allow_unsigned_blocks: Option<bool>,
    pub enable_deterministic_behavior: Option<bool>,
}

#[cfg(feature = "debug")]
impl From<JSDebugFlags> for DebugFlags {
    fn from(val: JSDebugFlags) -> Self {
        DebugFlags {
            allow_unsigned_blocks: val.allow_unsigned_blocks.unwrap_or(false),
            enable_deterministic_behavior: val
                .enable_deterministic_behavior
                .unwrap_or(false),
        }
    }
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSRuntime {

    pub fn runtime(&self) -> &Runtime {
        &self.runtime
    }

    pub fn create(
        endpoint: Endpoint,
        debug_flags: Option<JSDebugFlags>,
    ) -> JSRuntime {
        let runtime = Runtime::init(
            endpoint,
            GlobalContext {
                crypto: Arc::new(Mutex::new(CryptoJS)),
                time: Arc::new(Mutex::new(TimeJS)),

                #[cfg(feature = "debug")]
                debug_flags: debug_flags.unwrap_or_default().into(),
            },
        );
        // runtime.memory.borrow_mut().store_pointer(
        //     [
        //         10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140,
        //         150, 160, 170, 180, 190, 200, 210, 220, 230, 240, 250, 255,
        //     ],
        //     Pointer::from_id(Vec::new()),
        // );
        let runtime = JSRuntime::new(runtime);
        runtime.com_hub.register_default_interface_factories();
        runtime
    }


    pub fn new(runtime: Runtime) -> JSRuntime {
        let com_hub = JSComHub::new(runtime.clone());
        let memory = JSMemory::new(runtime.clone());
        JSRuntime {
            runtime,
            com_hub,
            memory
        }
    }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSRuntime {

    pub async fn crypto_test_tmp(&self) -> Promise {
        future_to_promise(async move {
            let crypto = CryptoJS {};

            let sign_key_pair = crypto
                .new_sign_key_pair()
                .await
                .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;

            info!("#1");

            let encryption_key_pair = crypto
                .new_encryption_key_pair()
                .await
                .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
            info!("#2");

            let encrypted_message = crypto
                .encrypt_rsa(vec![1, 2, 3], encryption_key_pair.0.clone())
                .await
                .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
            info!("#3");

            let decrypted_message = crypto
                .decrypt_rsa(
                    encrypted_message.clone(),
                    encryption_key_pair.1.clone(),
                )
                .await
                .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
            info!("#4");

            let signed_message = crypto
                .sign_rsa(vec![1, 2, 3], sign_key_pair.1.clone())
                .await
                .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
            info!("#5");

            let verified = crypto
                .verify_rsa(
                    vec![1, 2, 3],
                    signed_message.clone(),
                    sign_key_pair.0.clone(),
                )
                .await
                .map_err(|e| JsValue::from_str(&format!("{e:?}")))?;
            info!("#6");

            if !verified {
                return Err(JsValue::from_str("Verification failed"));
            }
            info!("#7");

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
    pub fn endpoint(&self) -> String {
        self.runtime.endpoint().to_string()
    }

    pub fn _create_block(
        &self,
        body: Option<Vec<u8>>,
        receivers: Vec<String>,
    ) -> Vec<u8> {
        let mut block = DXBBlock {
            block_header: BlockHeader {
                flags_and_timestamp: FlagsAndTimestamp::default()
                    .with_is_end_of_context(true)
                    .with_is_end_of_section(true),
                ..BlockHeader::default()
            },
            body: body.unwrap_or_default(),
            ..DXBBlock::default()
        };

        block.recalculate_struct();
        block.set_receivers(
            &receivers
                .iter()
                .map(|r| Endpoint::from_str(r))
                .collect::<Result<Vec<Endpoint>, _>>()
                .unwrap(),
        );
        block.to_bytes().unwrap()
    }

    pub async fn start(&self) {
        self.runtime.start().await;
    }

    pub async fn _stop(&self) {
        RuntimeInternal::stop_update_loop(self.runtime.internal.clone()).await
    }

    pub async fn execute(
        &self,
        script: &str,
        formatted: bool,
    ) -> String {
        let input = self.runtime.execute(script, &[], None).await.unwrap();
        match input {
            None => {
                "".to_string()
            }
            Some(result) => {
                decompile_value(
                    &result,
                    DecompileOptions {
                        formatted,
                        ..DecompileOptions::default()
                    },
                )
            }
        }
    }

    pub fn execute_sync(
        &self,
        script: &str,
        formatted: bool,
    ) -> String {
        let input = self.runtime.execute_sync(script, &[], None).unwrap();
        match input {
            None => {
                "".to_string()
            }
            Some(result) => {
                decompile_value(
                    &result,
                    DecompileOptions {
                        formatted,
                        ..DecompileOptions::default()
                    },
                )
            }
        }
    }
}
