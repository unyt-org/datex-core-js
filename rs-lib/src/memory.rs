use datex_core::stdlib::{cell::RefCell, rc::Rc};

use datex_core::runtime::memory::Memory;
use datex_core::runtime::Runtime;
use wasm_bindgen::prelude::*;
use web_sys::js_sys::Uint8Array;

use crate::pointer::JSPointer;

#[wasm_bindgen]
pub struct JSMemory {
    runtime: Runtime
}
/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSMemory {
    pub fn new(runtime: Runtime) -> JSMemory {
        JSMemory { runtime }
    }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSMemory {
    pub fn get_pointer_by_id(
        &mut self,
        address: Uint8Array,
    ) -> Option<JSPointer> {
        let mut memory = self.memory().borrow_mut();
        let pointer = memory.get_pointer_by_id_vec(address.to_vec());
        match pointer {
            Some(p) => None, //Some(JSPointer::new(p)),
            None => None,
        }
    }

    fn memory(&self) -> &RefCell<Memory> {
        self.runtime.memory()
    }

    pub fn get_pointer_ids(&self) -> Vec<Uint8Array> {
        let memory = self.memory().borrow_mut();
        let mut ids: Vec<Uint8Array> = Vec::new();
        for id in memory.get_pointer_ids() {
            ids.push(Uint8Array::from(&id[..]));
        }
        ids
    }

    // pub fn store_pointer(&mut self, address: [i8; 26], pointer: Pointer) {
    // 	self.pointers.insert(address, pointer);
    // }
}
