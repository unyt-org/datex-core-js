use crate::crypto::crypto_js::CryptoJS;
use crate::js_utils::{js_array, js_error};
use crate::memory::JSMemory;
use crate::network::com_hub::JSComHub;
use crate::utils::time::TimeJS;
use datex_core::crypto::crypto::CryptoTrait;
use datex_core::decompiler::{DecompileOptions, decompile_value};
use datex_core::dif::DIFValue;
use datex_core::global::dxb_block::DXBBlock;
use datex_core::global::protocol_structures::block_header::{
    BlockHeader, FlagsAndTimestamp,
};
#[cfg(feature = "debug")]
use datex_core::runtime::global_context::DebugFlags;
use datex_core::runtime::global_context::GlobalContext;
use datex_core::runtime::{Runtime, RuntimeConfig, RuntimeInternal};
use datex_core::values::core_values::endpoint::Endpoint;
use datex_core::values::serde::deserializer::DatexDeserializer;
use datex_core::values::value_container::ValueContainer;
use log::info;
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::from_value;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::js_sys::Promise;

#[wasm_bindgen(getter_with_clone)]
pub struct JSRuntime {
    runtime: Runtime,
    pub com_hub: JSComHub,
    pub memory: JSMemory,
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

#[derive(Serialize, Deserialize, Default)]
struct JSDecompileOptions {
    pub formatted: Option<bool>,
    pub colorized: Option<bool>,
    pub resolve_slots: Option<bool>,
    pub json_compat: Option<bool>,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSRuntime {
    pub fn runtime(&self) -> &Runtime {
        &self.runtime
    }

    pub fn create(
        config: &str,
        debug_flags: Option<JSDebugFlags>,
    ) -> JSRuntime {
        let deserializer = DatexDeserializer::from_script(config).unwrap();
        let config: RuntimeConfig =
            Deserialize::deserialize(deserializer).unwrap();
        let runtime = Runtime::init(
            config,
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
            memory,
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

    pub async fn execute_with_string_result(
        &self,
        script: &str,
        dif_values: Option<Vec<JsValue>>,
        decompile_options: JsValue,
    ) -> Result<String, JsError> {
        let result = self
            .runtime
            .execute(
                script,
                &Self::js_values_to_value_containers(dif_values),
                None,
            )
            .await
            .map_err(js_error)?;
        match result {
            None => Ok("".to_string()),
            Some(result) => Ok(decompile_value(
                &result,
                Self::decompile_options_from_js_value(decompile_options),
            )),
        }
    }

    pub async fn execute(
        &self,
        script: &str,
        dif_values: Option<Vec<JsValue>>,
    ) -> Result<JsValue, JsValue> {
        let result = self
            .runtime
            .execute(
                script,
                &Self::js_values_to_value_containers(dif_values),
                None,
            )
            .await
            .map_err(js_error)?;
        Ok(Self::maybe_value_container_to_dif(result))
    }

    pub fn execute_sync_with_string_result(
        &self,
        script: &str,
        dif_values: Option<Vec<JsValue>>,
        decompile_options: JsValue,
    ) -> Result<String, JsValue> {
        let input = self
            .runtime
            .execute_sync(
                script,
                &Self::js_values_to_value_containers(dif_values),
                None,
            )
            .map_err(js_error)?;
        match input {
            None => Ok("".to_string()),
            Some(result) => Ok(decompile_value(
                &result,
                Self::decompile_options_from_js_value(decompile_options),
            )),
        }
    }

    pub fn execute_sync(
        &self,
        script: &str,
        dif_values: Option<Vec<JsValue>>,
    ) -> Result<JsValue, JsValue> {
        let result = self
            .runtime
            .execute_sync(
                script,
                &Self::js_values_to_value_containers(dif_values),
                None,
            )
            .map_err(js_error)?;
        Ok(Self::maybe_value_container_to_dif(result))
    }

    pub fn value_to_string(
        dif_value: JsValue,
        decompile_options: JsValue,
    ) -> String {
        let value_container: ValueContainer =
            Self::js_value_to_value_container(dif_value);
        decompile_value(
            &value_container,
            Self::decompile_options_from_js_value(decompile_options),
        )
    }

    fn maybe_value_container_to_dif(
        maybe_value_container: Option<ValueContainer>,
    ) -> JsValue {
        match maybe_value_container {
            None => JsValue::NULL,
            Some(value_container) => {
                let dif_value = DIFValue::from(&value_container);
                serde_wasm_bindgen::to_value(&dif_value).unwrap()
            }
        }
    }

    fn js_values_to_value_containers(
        js_values: Option<Vec<JsValue>>,
    ) -> Vec<ValueContainer> {
        js_values
            .map(|values| {
                values
                    .into_iter()
                    .map(Self::js_value_to_value_container)
                    .collect()
            })
            .unwrap_or_default()
    }

    fn js_value_to_value_container(js_value: JsValue) -> ValueContainer {
        // convert JsValue to DIFValue
        let dif_value: DIFValue =
            serde_wasm_bindgen::from_value(js_value).unwrap();
        // convert DIFValue to ValueContainer
        ValueContainer::from(&dif_value)
    }

    fn decompile_options_from_js_value(
        decompile_options: JsValue,
    ) -> DecompileOptions {
        // if null, return default options
        if decompile_options.is_null() {
            DecompileOptions::default()
        }
        // if not null, try to deserialize
        else {
            let js_decompile_options: JSDecompileOptions =
                from_value(decompile_options).unwrap_or_default();
            DecompileOptions {
                formatting: Default::default(),
                colorized: js_decompile_options.colorized.unwrap_or(false),
                resolve_slots: js_decompile_options
                    .resolve_slots
                    .unwrap_or(false),
                json_compat: js_decompile_options.json_compat.unwrap_or(false),
            }
        }
    }
}
