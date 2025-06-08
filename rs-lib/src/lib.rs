#![feature(let_chains)]
#![feature(coroutines)]
#![feature(iter_from_coroutine)]
// FIXME no-std

use serde_wasm_bindgen::from_value;
// use datex_cli_core::CLI;
use datex_core::compiler;
use datex_core::decompiler;

use datex_core::decompiler::DecompileOptions;
use wasm_bindgen::prelude::*;

mod runtime;
use crate::runtime::JSDebugFlags;
use runtime::JSRuntime;

pub mod network;

pub mod crypto;
pub mod js_utils;
pub mod memory;
pub mod pointer;
pub mod utils;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// console.log
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, final)]
    pub fn log(s: &str);
}

// export compiler/runtime functions to JavaScript
#[wasm_bindgen]
pub fn init_runtime(endpoint: &str, debug_flags: JsValue) -> JSRuntime {
    let debug_flags: Option<JSDebugFlags> =
        from_value(debug_flags).unwrap_or_default();
    JSRuntime::create(endpoint, debug_flags)
}

#[wasm_bindgen]
pub fn compile(datex_script: &str) {
    compiler::compile_block(datex_script);
}

#[wasm_bindgen]
pub fn decompile(
    dxb: &[u8],
    formatted: bool,
    colorized: bool,
    resolve_slots: bool,
    json_compat: bool,
) -> String {
    decompiler::decompile(
        dxb,
        DecompileOptions {
            json_compat,
            colorized,
            formatted,
            resolve_slots,
        },
    )
}
