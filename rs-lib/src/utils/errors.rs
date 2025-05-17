#[macro_export]
macro_rules! wrap_error_for_js {
    ($wrapper:ident, $source:path) => {
        pub struct $wrapper(pub $source);

        impl From<$source> for $wrapper {
            fn from(err: $source) -> Self {
                $wrapper(err)
            }
        }

        impl From<$wrapper> for wasm_bindgen::JsValue {
            fn from(err: $wrapper) -> wasm_bindgen::JsValue {
                wasm_bindgen::JsValue::from_str(&err.0.to_string())
            }
        }
        impl From<$wrapper> for wasm_bindgen::JsError {
            fn from(err: $wrapper) -> wasm_bindgen::JsError {
                wasm_bindgen::JsError::new(&err.0.to_string())
            }
        }
    };
}
