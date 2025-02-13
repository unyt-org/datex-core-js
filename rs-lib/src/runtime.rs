use std::rc::Rc;

use datex_core::datex_values::Pointer;
use datex_core::runtime::Runtime;
use datex_core::utils::logger::Logger;
use datex_core::utils::logger::LoggerContext;
use wasm_bindgen::prelude::*;

use crate::memory::JSMemory;
use crate::network::com_hub::JSComHub;

#[wasm_bindgen]
pub struct JSRuntime {
  runtime: Runtime<'static>,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSRuntime {
  pub fn create(ctx: &LoggerContext) -> JSRuntime {
    let logger = Logger::new_for_development(&ctx, "DATEX");
    logger.success("JSRuntime initialized");
    let runtime = Runtime::new();
    runtime.memory.borrow_mut().store_pointer(
      [
        10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
        170, 180, 190, 200, 210, 220, 230, 240, 250, 255,
      ],
      Pointer::from_id(Vec::new()),
    );

    JSRuntime::new(runtime)
  }

  pub fn new(runtime: Runtime<'static>) -> JSRuntime {
    JSRuntime { 
      runtime
    }
  }
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSRuntime {
  #[wasm_bindgen(getter)]
  pub fn version(&self) -> String {
    self.runtime.version.clone()
  }

  #[wasm_bindgen(getter)]
  pub fn memory(&self) -> JSMemory {
    JSMemory::new(Rc::clone(&self.runtime.memory))
  }

  #[wasm_bindgen(getter)]
  pub fn com_hub(&self) -> JSComHub {
    JSComHub::new(Rc::clone(&self.runtime.com_hub))
  }
}