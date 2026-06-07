use crate::js_utils::{
    from_dif_js_value, from_js_value, js_error, to_js_value,
    unwrap_or_report_js_error_debug,
};
use datex_core::{
    dif::{
        cache::DIFSharedContainerCache, dif_interface::DIFInterface,
        error::DIFUpdateError, pointer_address::PointerAddressWithOwnership,
    },
    shared_values::{
        PointerAddress, SharedContainerOwnership,
        base_shared_value_container::{
            BaseSharedValueContainer,
            observers::{ObserveOptions, ObserverId, TransceiverId},
        },
    },
    value_updates::{update_data::Update, update_handler::UpdateHandler},
    values::value_container::ValueContainer,
};
use js_sys::Function;
use std::{
    cell::{RefCell, RefMut},
    ops::DerefMut,
    rc::Rc,
};
use wasm_bindgen::{JsError, JsValue, prelude::wasm_bindgen};
use web_sys::console::info;

#[wasm_bindgen]
#[derive(Clone)]
pub struct JSDIFInterface {
    #[wasm_bindgen(skip)]
    dif_interface: Rc<RefCell<DIFInterface>>,
}

impl JSDIFInterface {
    pub fn new(dif_interface: DIFInterface) -> Self {
        Self {
            dif_interface: Rc::new(RefCell::new(dif_interface)),
        }
    }
    pub fn cache(&self) -> RefMut<DIFSharedContainerCache> {
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
        transceiver_id: u32,
        address: &str,
        observe_options: JsValue,
        callback: &Function,
    ) -> Result<u32, JsError> {
        let transceiver_id = TransceiverId(transceiver_id);
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
    /// TODO: Can we optimize this, by not returning the update result data back to JS, as it adds unnecesarry overhead, as
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
            .try_get_shared_container_mutable_reference(&address)
            .map_err(js_error)?;
        let mut base_container = shared_container.base_shared_container_mut();

        let result = base_container
            .update(update)
            .map_err(DIFUpdateError::UpdateError)
            .map_err(js_error)?;

        Ok(to_js_value(&result, &mut self.cache()))
    }

    pub fn apply(
        &mut self,
        callee: JsValue,
        value: JsValue,
    ) -> Result<Option<JsValue>, JsError> {
        let callee: ValueContainer =
            from_dif_js_value(callee, &mut self.cache())?;
        let value: ValueContainer =
            from_dif_js_value(value, &mut self.cache())?;
        Ok(self
            .dif_interface
            .borrow_mut()
            .apply(callee, value)
            .map_err(js_error)?
            .map(|res| to_js_value(&res, &mut self.cache())))
    }

    pub fn create_pointer(&self, value: JsValue) -> Result<String, JsError> {
        let value: BaseSharedValueContainer =
            from_js_value(value, &mut self.cache())?;
        Ok(self
            .dif_interface
            .borrow_mut()
            .create_pointer(value)
            .to_string())
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
