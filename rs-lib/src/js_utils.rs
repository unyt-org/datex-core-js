use wasm_bindgen::JsValue;
use web_sys::js_sys::{self, Object, Reflect};

pub enum JsError {
    ConversionError,
}

pub trait AsByteSlice {
    fn as_u8_slice(&self) -> Result<Vec<u8>, JsError>;
}

impl AsByteSlice for JsValue {
    fn as_u8_slice(&self) -> Result<Vec<u8>, JsError> {
        let buffer: js_sys::ArrayBuffer = self
            .clone()
            .try_into()
            .map_err(|_| JsError::ConversionError)?;

        let uint8_array = js_sys::Uint8Array::new(&buffer);
        let mut bytes = vec![0; uint8_array.length() as usize];
        uint8_array.copy_to(&mut bytes);
        Ok(bytes)
    }
}

pub fn js_object(values: Vec<(&str, JsValue)>) -> Object {
    let obj = Object::new();
    for (key, value) in values {
        let _ = Reflect::set(&obj, &key.into(), &value);
    }
    obj
}

pub fn js_array(values: &[&str]) -> JsValue {
    return JsValue::from(
        values
            .iter()
            .map(|x| JsValue::from_str(x))
            .collect::<js_sys::Array>(),
    );
}
