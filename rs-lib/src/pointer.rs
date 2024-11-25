use wasm_bindgen::prelude::*;
use datex_core::datex_values::Pointer;

#[wasm_bindgen]
pub struct JSPointer {
    pointer: Pointer
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSPointer {
	pub fn new(pointer: Pointer) -> JSPointer {
		JSPointer { pointer }
	}
}

/**
 * Exposed properties and methods for JavaScript
 */                       
#[wasm_bindgen]
impl JSPointer {
}