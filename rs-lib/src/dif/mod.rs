use crate::js_utils::{from_dif_js_value, from_js_value, js_error, optional_value_container_to_optional_js_dif_value, to_dif_js_value, to_js_value, unwrap_or_report_js_error_debug};
use datex_core::{
    dif::{
        dif_interface::DIFInterface, error::DIFUpdateError,
        pointer_address::PointerAddressWithOwnership,
    },
    runtime::cache::shared_values_cache::SharedValuesCache,
    shared_values::{
        PointerAddress, SharedContainer, SharedContainerOwnership,
        base_shared_value_container::{
            BaseSharedValueContainer,
            observers::{ObserveOptions, ObserverId, TransceiverId},
        },
        traits::SharedContainerCommon,
    },
    value_updates::{update_data::Update, update_handler::UpdateHandler},
    values::value_container::ValueContainer,
};
use js_sys::{Array, Function};
use std::{
    cell::{RefCell, RefMut},
    ops::DerefMut,
    rc::Rc,
};
use datex_core::runtime::Runtime;
use datex_core::types::type_definition::callable::{CallableKind, CallableTypeDefinition};
use wasm_bindgen::{JsError, JsValue, prelude::*};

#[wasm_bindgen]
#[derive(Clone)]
pub struct JSDIFInterface {
    #[wasm_bindgen(skip)]
    dif_interface: Rc<RefCell<DIFInterface>>,
    #[wasm_bindgen(skip)]
    runtime: Runtime,
}

impl JSDIFInterface {
    pub fn new(runtime: Runtime, dif_interface: DIFInterface) -> Self {
        Self {
            dif_interface: Rc::new(RefCell::new(dif_interface)),
            runtime,
        }
    }
    pub fn cache(&'_ self) -> RefMut<'_, SharedValuesCache> {
        RefMut::map(self.dif_interface.borrow_mut(), |interface| {
            &mut interface.cache
        })
    }

    /// Get a clone of the Rc<RefCell<DIFInterface>> to allow sharing the DIFInterface across multiple JS objects.
    pub fn dif_interface_rc(&self) -> Rc<RefCell<DIFInterface>> {
        self.dif_interface.clone()
    }
}

#[wasm_bindgen]
impl JSDIFInterface {
    pub fn observe_pointer(
        &self,
        address: &str,
        observe_options: JsValue,
        callback: &Function,
    ) -> Result<u32, JsError> {
        let address = PointerAddress::try_from(address).map_err(js_error)?;
        let cb = callback.clone();
        let observe_options: ObserveOptions =
            from_js_value(observe_options, self.cache().deref_mut())?;
        let self_clone = self.clone();
        let observer = move |update: &Update| {
            let value = to_js_value(update, &mut self_clone.cache());
            let _ = unwrap_or_report_js_error_debug(
                cb.call1(&JsValue::NULL, &value),
            );
        };
        self.dif_interface
            .borrow_mut()
            .observe_pointer(address, observe_options, observer)
            .map_err(js_error)
            .map(|id| id.0)
    }

    pub fn unobserve_pointer(
        &self,
        address: &str,
        observer_id: u32,
    ) -> Result<(), JsError> {
        let address = PointerAddress::try_from(address).map_err(js_error)?;
        self.dif_interface
            .borrow_mut()
            .unobserve_pointer(address, ObserverId(observer_id))
            .map_err(js_error)
    }

    pub fn update_observer_options(
        &self,
        address: &str,
        observer_id: u32,
        observe_options: JsValue,
    ) -> Result<(), JsError> {
        let address = PointerAddress::try_from(address).map_err(js_error)?;
        let observe_options: ObserveOptions =
            from_js_value(observe_options, &mut *self.cache())?;
        self.dif_interface
            .borrow_mut()
            .update_observer_options(
                address,
                ObserverId(observer_id),
                observe_options,
            )
            .map_err(js_error)
    }

    /// Applies a DIF update on a shared container at the given address, using the provided update data.
    /// TODO: Can we optimize this, by not returning the update result data back to JS, as it adds unnecessary overhead, as
    /// we can access the values in JS before update.
    pub fn update(
        &mut self,
        address: &str,
        update: JsValue,
    ) -> Result<JsValue, JsError> {
        let address = PointerAddress::try_from(address).map_err(js_error)?;
        let update: Update = from_js_value(update, &mut self.cache())?;

        let shared_container = self
            .dif_interface
            .borrow()
            .cache
            .try_get_shared_container_mutable_reference(&address)
            .map_err(js_error)?;

        let result = SharedContainer::Referenced(shared_container)
            .try_handle_update(update)
            .map_err(DIFUpdateError::UpdateError)
            .map_err(js_error)?;

        Ok(to_js_value(&result, &mut self.cache()))
    }

    pub fn register_callable(
        &mut self,
        callable: &Function,
        is_method: bool, // TODO
    ) -> Result<String, JsError> {
        let callable_clone = callable.clone();
        let self_clone = self.clone();
        let native_callable = move |args: Vec<ValueContainer>| {
            let js_args = args.into_iter().map(|v| to_dif_js_value(v, &mut self_clone.cache())).collect::<Array>();
            let result = unwrap_or_report_js_error_debug(
                callable_clone.call1(&JsValue::NULL, &js_args),
            );
            Ok(result
                .map(|res| from_dif_js_value::<ValueContainer>(res, &mut self_clone.cache()).unwrap()))
        };

        let signature = CallableTypeDefinition {
            kind: CallableKind::Procedure,
            parameters: vec![],
            rest_parameter: None,
            return_type: None,
            yeet_type: None,
        };

        Ok(self
            .dif_interface
            .borrow_mut()
            .register_callable(native_callable, signature)
            .to_address_string()
        )
    }

    pub fn apply(
        &mut self,
        callee: JsValue,
        args: JsValue,
    ) -> Result<JsValue, JsError> {
        let callee: ValueContainer =
            from_dif_js_value(callee, &mut self.cache())?;
        let js_array: Array = args.into();
        let args = js_array.to_vec().into_iter().map(|v| {
            from_dif_js_value(v, &mut self.cache())
        }).collect::<Result<Vec<ValueContainer>, _>>()?;

        let res = self
            .dif_interface
            .borrow_mut()
            .apply(&self.runtime, callee, args)
            .map_err(js_error)?;

        Ok(optional_value_container_to_optional_js_dif_value(
            res,
            &mut self.cache()
        ))
    }

    pub fn create_pointer(&self, value: JsValue) -> Result<String, JsError> {
        let value: BaseSharedValueContainer =
            from_js_value(value, &mut self.cache())?;
        Ok(self
            .dif_interface
            .borrow_mut()
            .create_pointer(value)
            .to_address_string())
    }

    /// Resolve a pointer address synchronously if it's in memory, otherwise return an error
    pub fn resolve_pointer_address(
        &self,
        address: &str,
    ) -> Result<JsValue, JsError> {
        let address = PointerAddress::try_from(address).map_err(js_error)?;
        let result = self
            .dif_interface
            .borrow_mut()
            .resolve_pointer_address(address)
            .map_err(js_error)?;
        Ok(to_js_value(
            &*result.base_shared_container(),
            &mut self.cache(),
        ))
    }

    pub fn has_address_with_ownership(
        &self,
        address: &str,
        ownership: Option<u8>,
    ) -> Result<bool, JsError> {
        let pointer_address =
            PointerAddress::try_from(address).map_err(js_error)?;
        let ownership: SharedContainerOwnership =
            SharedContainerOwnership::try_from(ownership)
                .map_err(|_| js_error("Invalid ownership value"))?;
        Ok(self
            .dif_interface
            .borrow()
            .has_address_with_ownership(&pointer_address, ownership))
    }
}
