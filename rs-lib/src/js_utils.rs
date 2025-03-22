use wasm_bindgen::JsValue;
use web_sys::js_sys::{self, Array, Object, Reflect};

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

pub fn js_object<T: Into<JsValue>>(values: Vec<(&str, T)>) -> Object {
    let obj = Object::new();
    for (key, value) in values {
        let js_value: JsValue = value.into();
        let _ = Reflect::set(&obj, &key.into(), &js_value);
    }
    obj
}

pub fn js_array<T>(values: &[T]) -> JsValue
where
    T: Into<JsValue> + Clone,
{
    // FIXME TODO can we avoid clone here?
    let js_array = values
        .iter()
        .map(|x| <T as Into<JsValue>>::into(x.clone()))
        .collect::<Array>();

    JsValue::from(js_array)
}

// pub fn js_array(values: &[&str]) -> JsValue {
//     return JsValue::from(
//         values
//             .iter()
//             .map(|x| JsValue::from_str(x))
//             .collect::<js_sys::Array>(),
//     );
// }

// pub fn js_array<T>(values: &[T]) -> JsValue
// where
//     T: Into<JsValue> + ?Sized + JsCast, // Allow the generic T to handle references too
// {
//     let js_array = values
//         .iter()
//         .map(|x| JsValue::from(x)) // Use the Into trait on the reference
//         .collect::<Array>();

//     JsValue::from(js_array)
// }

// pub fn js_array<T>(values: &[T]) -> JsValue
// where
//     T: Into<JsValue> + 'static, // T must be convertible into JsValue and can be passed to JS
// {
//     let js_array = values
//         .iter()
//         .map(|x| Into::<JsValue>::into(x.clone())) // Use Into<JsValue> to convert references
//         .collect::<Array>();

//     JsValue::from(js_array)
// }
