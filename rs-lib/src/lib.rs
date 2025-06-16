#![feature(let_chains)]
#![feature(coroutines)]
#![feature(iter_from_coroutine)]
// FIXME no-std

use serde_wasm_bindgen::from_value;
// use datex_cli_core::CLI;
use datex_core::compiler;

use wasm_bindgen::prelude::*;
use datex_core::compiler::bytecode::{compile_script, compile_template};
use datex_core::decompiler::{decompile_body, DecompileOptions};
use datex_core::runtime::execution::{execute_dxb, ExecutionOptions};

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

/// Executes a Datex script and returns the result as a string.
#[wasm_bindgen]
pub fn execute(datex_script: &str, formatted: bool) -> String {
    let dxb = compile_script(datex_script, None);
    if let Ok(dxb) = dxb {
        let result = execute_dxb(&dxb, ExecutionOptions {verbose: true, ..ExecutionOptions::default()}).unwrap_or_else(|err| {
            panic!("Failed to execute script: {err:?}");
        }).unwrap();
        let result_dxb = compile_template("?", &[result], None).unwrap();
        let string = decompile_body(&result_dxb, DecompileOptions {
            colorized: formatted,
            formatted,
            json_compat: true,
            ..DecompileOptions::default()
        }).unwrap_or_else(|err| {
            panic!("Failed to decompile result: {err:?}");
        });
        string
    } else {
        panic!("Failed to compile script: {:?}", dxb.err());
    }
}

/// Executes a Datex script and returns true when execution was successful.
/// Does not return the result of the script, but only indicates success or failure.
#[wasm_bindgen]
pub fn execute_internal(datex_script: &str) -> bool {
    let dxb = compile_script(datex_script, None);
    if let Ok(dxb) = dxb {
        let result = execute_dxb(&dxb, ExecutionOptions {verbose: true, ..ExecutionOptions::default()}).unwrap_or_else(|err| {
            panic!("Failed to execute script: {err:?}");
        });
        result.is_some()
    } else {
        panic!("Failed to compile script: {:?}", dxb.err());
    }
}