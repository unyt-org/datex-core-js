use datex_core::runtime;
use datex_core::runtime::Runtime;
use datex_core::utils::logger::LoggerContext;
use datex_core::utils::logger::Logger;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct JSRuntime {
	version: String,
    runtime: Runtime<'static>,
}

/**
 * Internal impl of the JSRuntime, not exposed to JavaScript
 */
impl JSRuntime {
	pub fn new(ctx: &LoggerContext) -> JSRuntime {
		let logger = Logger::new_for_development(&ctx, "DATEX");
		logger.success("initialized!");
		let runtime = Runtime::new();
		JSRuntime {  runtime, version: env!("CARGO_PKG_VERSION").to_string() }
	}
}

/**
 * Exposed properties and methods for JavaScript
 */
#[wasm_bindgen]
impl JSRuntime {
    #[wasm_bindgen(getter)]
	pub fn version(&self) -> String {
		self.version.clone()
	}
}