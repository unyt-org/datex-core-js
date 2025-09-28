use crate::crypto::crypto_js::CryptoJS;
use crate::js_utils::{js_array, js_error};
use crate::network::com_hub::JSComHub;
use crate::utils::time::TimeJS;
use datex_core::crypto::crypto::CryptoTrait;
use datex_core::decompiler::{DecompileOptions, decompile_value};
use datex_core::dif::DIFUpdate;
use datex_core::dif::interface::{DIFApplyError, DIFCreatePointerError, DIFFreeError, DIFInterface, DIFObserveError, DIFResolveReferenceError, DIFUpdateError};
use datex_core::dif::r#type::DIFTypeContainer;
use datex_core::dif::value::DIFValueContainer;
use datex_core::global::dxb_block::DXBBlock;
use datex_core::global::protocol_structures::block_header::{
    BlockHeader, FlagsAndTimestamp,
};
use datex_core::references::observers::ReferenceObserver;
use datex_core::references::reference::ReferenceMutability;
use datex_core::runtime::execution::ExecutionError;
#[cfg(feature = "debug")]
use datex_core::runtime::global_context::DebugFlags;
use datex_core::runtime::global_context::GlobalContext;
use datex_core::runtime::{Runtime, RuntimeConfig, RuntimeInternal};
use datex_core::values::core_values::endpoint::Endpoint;
use datex_core::values::pointer::PointerAddress;
use datex_core::values::serde::deserializer::DatexDeserializer;
use datex_core::values::value_container::ValueContainer;
use futures::FutureExt;
use js_sys::Function;
use log::{info, warn};
use serde::{Deserialize, Serialize};
use serde_wasm_bindgen::from_value;
use std::fmt::Display;
use std::pin::Pin;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use tsify::JsValueSerdeExt;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;
use web_sys::console::info;
use web_sys::js_sys::Promise;

#[wasm_bindgen(getter_with_clone)]
pub struct JSRuntime {
    runtime: Runtime,
    pub com_hub: JSComHub,
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

#[derive(Debug, PartialEq)]
enum ConversionError {
    InvalidValue,
}
impl Display for ConversionError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConversionError::InvalidValue => write!(f, "Invalid value"),
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
        JSRuntime {
            runtime,
            com_hub,
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
        let val = &self
            .js_values_to_value_containers(dif_values)
            .map_err(js_error)?;
        let result = self
            .runtime
            .execute(script, val, None)
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
                &self
                    .js_values_to_value_containers(dif_values)
                    .map_err(js_error)?,
                None,
            )
            .await
            .map_err(js_error)?;
        Ok(self.maybe_value_container_to_dif(result))
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
                &self
                    .js_values_to_value_containers(dif_values)
                    .map_err(js_error)?,
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
                &self
                    .js_values_to_value_containers(dif_values)
                    .map_err(js_error)?,
                None,
            )
            .map_err(js_error)?;
        Ok(self.maybe_value_container_to_dif(result))
    }

    pub fn value_to_string(
        &self,
        dif_value: JsValue,
        decompile_options: JsValue,
    ) -> Result<String, JsError> {
        let value_container = self
            .js_value_to_value_container(dif_value)
            .map_err(js_error)?;
        Ok(decompile_value(
            &value_container,
            Self::decompile_options_from_js_value(decompile_options),
        ))
    }

    fn maybe_value_container_to_dif(
        &self,
        maybe_value_container: Option<ValueContainer>,
    ) -> JsValue {
        match maybe_value_container {
            None => JsValue::NULL,
            Some(value_container) => {
                let dif_value_container =
                    DIFValueContainer::try_from(&value_container)
                        .expect("Conversion to DIFValue failed");
                dif_value_container
                    .serialize(
                        &serde_wasm_bindgen::Serializer::json_compatible(),
                    )
                    .unwrap()
            }
        }
    }

    fn js_values_to_value_containers(
        &self,
        js_values: Option<Vec<JsValue>>,
    ) -> Result<Vec<ValueContainer>, ConversionError> {
        js_values
            .unwrap_or_default()
            .into_iter()
            .map(|js_value| self.js_value_to_value_container(js_value))
            .collect()
    }

    /// Convert a JsValue (DIFValue) to a ValueContainer
    /// Returns Err(()) if the conversion fails (invalid json or ref not found)
    fn js_value_to_value_container(
        &self,
        js_value: JsValue,
    ) -> Result<ValueContainer, ConversionError> {
        // convert JsValue to DIFValue
        let dif_value: DIFValueContainer = from_value(js_value).unwrap();
        // convert DIFValue to ValueContainer
        if let Ok(value_container) = dif_value.to_value_container(
            &self.runtime.memory().borrow()
        )
        {
            Ok(value_container)
        } else {
            // ref not found
            Err(ConversionError::InvalidValue)
        }
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

    fn js_value_to_pointer_address(
        address: &str,
    ) -> Result<PointerAddress, JsError> {
        PointerAddress::try_from(address)
            .map_err(|_| js_error(ConversionError::InvalidValue))
    }
}

// DIF
#[wasm_bindgen]
impl JSRuntime {
    pub fn observe_pointer(
        &self,
        address: &str,
        callback: &Function,
    ) -> Result<u32, JsError> {
        let address = JSRuntime::js_value_to_pointer_address(address)?;
        let cb = callback.clone();
        let observer = move |update: &DIFUpdate| {
            let dif_value = serde_wasm_bindgen::to_value(update).unwrap();
            let _ = cb.call1(&JsValue::NULL, &dif_value);
        };
        DIFInterface::observe_pointer(self, address.into(), observer)
            .map_err(|e| js_error(e))
    }

    pub fn unobserve_pointer(
        &self,
        address: &str,
        observer_id: u32,
    ) -> Result<(), JsError> {
        let address = Self::js_value_to_pointer_address(address)?;
        DIFInterface::unobserve_pointer(self, address.into(), observer_id)
            .map_err(|e| js_error(e))
    }

    pub fn update(
        &mut self,
        address: &str,
        update: JsValue,
    ) -> Result<(), JsError> {
        let address = Self::js_value_to_pointer_address(address)?;
        let dif_update: DIFUpdate =
            serde_wasm_bindgen::from_value(update).map_err(js_error)?;
        DIFInterface::update(self, address.into(), dif_update)
            .map_err(|e| js_error(e))
    }

    pub fn apply(
        &mut self,
        callee: JsValue,
        value: JsValue,
    ) -> Result<JsValue, JsError> {
        let dif_callee: DIFValueContainer =
            serde_wasm_bindgen::from_value(callee).map_err(js_error)?;
        let dif_value: DIFValueContainer =
            serde_wasm_bindgen::from_value(value).map_err(js_error)?;
        let result = DIFInterface::apply(self, dif_callee, dif_value)
            .map_err(|e| js_error(e))?;
        serde_wasm_bindgen::to_value(&result).map_err(js_error)
    }

    pub fn create_pointer(
        &self,
        value: JsValue,
        allowed_type: JsValue,
        mutability: u8,
    ) -> Result<String, JsError> {
        let dif_value: DIFValueContainer =
            serde_wasm_bindgen::from_value(value).map_err(js_error)?;
        let dif_allowed_type: Option<DIFTypeContainer> =
            if allowed_type.is_null() || allowed_type.is_undefined() {
                None
            } else {
                Some(
                    serde_wasm_bindgen::from_value(allowed_type)
                        .map_err(js_error)?,
                )
            };
        let dif_mutability = ReferenceMutability::try_from(mutability)
            .map_err(|_| js_error(ConversionError::InvalidValue))?;
        let address = DIFInterface::create_pointer(
            self,
            dif_value,
            dif_allowed_type,
            dif_mutability,
        )
        .map_err(|e| js_error(e))?;
        Ok(address.to_address_string())
    }

    /// Resolve a pointer address synchronously if it's in memory, otherwise return an error
    /// When this method succeeds, it automatically marks the pointer as non-garbage-collectable
    /// until free_pointer is called
    pub fn resolve_pointer_address_sync(
        &self,
        address: &str,
    ) -> Result<JsValue, JsError> {
        let address = Self::js_value_to_pointer_address(address)?;
        let result = DIFInterface::resolve_pointer_address_in_memory(
            self,
            address.into(),
        )
        .map_err(|e| js_error(e))?;
        serde_wasm_bindgen::to_value(&result).map_err(js_error)
    }

    /// Resolve a pointer address, returning a Promise
    /// If the pointer is in memory, the promise resolves immediately
    /// If the pointer is not in memory, it will be loaded first
    /// When this method succeeds, it automatically marks the pointer as non-garbage-collectable
    pub fn resolve_pointer_address(
        &self,
        address: &str,
    ) -> Result<JsValue, JsError> {
        if let Ok(sync) = self.resolve_pointer_address_sync(address) {
            return Ok(sync.into());
        }
        let address = Self::js_value_to_pointer_address(address)?;
        let runtime = self.runtime.clone();
        Ok(future_to_promise(async move {
            let result = runtime
                .resolve_pointer_address_external(address)
                .await
                .map_err(|e| js_error(e))?;
            Ok(serde_wasm_bindgen::to_value(&result).map_err(js_error)?)
        })
        .unchecked_into())
    }

    pub fn free_pointer(&self, address: &str) -> Result<(), JsError> {
        let address = Self::js_value_to_pointer_address(address)?;
        DIFInterface::free_pointer(self, address.into())
            .map_err(|e| js_error(e))
    }
}

impl DIFInterface for JSRuntime {
    fn update(
        &self,
        address: PointerAddress,
        update: DIFUpdate,
    ) -> Result<(), DIFUpdateError> {
        self.runtime.update(address, update)
    }

    async fn resolve_pointer_address_external(
        &self,
        address: PointerAddress,
    ) -> Result<DIFValueContainer, DIFResolveReferenceError> {
        self.runtime.resolve_pointer_address_external(address).await
    }

    fn resolve_pointer_address_in_memory(
        &self,
        address: PointerAddress,
    ) -> Result<DIFValueContainer, DIFResolveReferenceError> {
        self.runtime.resolve_pointer_address_in_memory(address)
    }

    fn apply(
        &self,
        callee: DIFValueContainer,
        value: DIFValueContainer,
    ) -> Result<DIFValueContainer, DIFApplyError> {
        self.runtime.apply(callee, value)
    }

    fn create_pointer(
        &self,
        value: DIFValueContainer,
        allowed_type: Option<DIFTypeContainer>,
        mutability: ReferenceMutability,
    ) -> Result<PointerAddress, DIFCreatePointerError> {
        self.runtime
            .create_pointer(value, allowed_type, mutability)
    }

    fn observe_pointer<F: Fn(&DIFUpdate) + 'static>(
        &self,
        address: PointerAddress,
        observer: F,
    ) -> Result<u32, DIFObserveError> {
        self.runtime.observe_pointer(address, observer)
    }

    fn unobserve_pointer(
        &self,
        address: PointerAddress,
        observer_id: u32,
    ) -> Result<(), DIFObserveError> {
        self.runtime.unobserve_pointer(address, observer_id)
    }

    fn free_pointer(&self, address: PointerAddress) -> Result<(), DIFFreeError> {
        self.runtime.free_pointer(address)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_execute_sync() {
        let config = r#"{"endpoint": "@jonas"}"#;
        let deserializer = DatexDeserializer::from_script(config).unwrap();
        let val: ValueContainer =
            Deserialize::deserialize(deserializer).unwrap();
        println!("{}", config);

        let deserializer = DatexDeserializer::from_script(config).unwrap();
        let val: RuntimeConfig =
            Deserialize::deserialize(deserializer).unwrap();
    }
}
