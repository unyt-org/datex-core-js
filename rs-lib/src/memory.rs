use std::{cell::RefCell, rc::Rc};

use wasm_bindgen::prelude::*;
use datex_core::runtime::memory::Memory;
use web_sys::js_sys::Uint8Array;

use crate::pointer::JSPointer;

#[wasm_bindgen]
pub struct JSMemory {
    memory: Rc<RefCell<Memory>>,
}
/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSMemory {
	pub fn new(memory: Rc<RefCell<Memory>>) -> JSMemory {
		JSMemory { memory }
	}
}

/**
 * Exposed properties and methods for JavaScript
 */                       
#[wasm_bindgen]
impl JSMemory {
	#[wasm_bindgen]
	pub fn get_pointer_by_id(&mut self, address: Uint8Array) -> Option<JSPointer> {
		let mut binding = self.memory.borrow_mut();
		let pointer = binding.get_pointer_by_id_vec(address.to_vec());
		match pointer {
			Some(p) => None,//Some(JSPointer::new(p)),
			None => None
		}		
	}

	#[wasm_bindgen]
	pub fn get_pointer_ids(&self) -> Vec<Uint8Array> {
		let binding = self.memory.borrow_mut();
		let mut ids: Vec<Uint8Array> = Vec::new();
		for id in binding.get_pointer_ids() {
			ids.push(Uint8Array::from(&id[..]));
		}
		ids
	}

	// pub fn store_pointer(&mut self, address: [i8; 26], pointer: Pointer) {
	// 	self.pointers.insert(address, pointer);
	// }
}