#![feature(coroutines)]
#![feature(iter_from_coroutine)]
// FIXME no-std

extern crate core;

use serde_wasm_bindgen::from_value;
// use datex_cli_core::CLI;
use datex_core::compiler;

use datex_core::compiler::{compile_script, compile_template, CompileOptions};
use datex_core::decompiler::{decompile_body, DecompileOptions};
use datex_core::runtime::execution::{
    execute_dxb_sync, ExecutionInput, ExecutionOptions,
};
use datex_core::values::core_values::endpoint::Endpoint;
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
    let endpoint = Endpoint::new(endpoint);
    JSRuntime::create(endpoint, debug_flags)
}

#[wasm_bindgen]
pub fn compile(datex_script: &str) {
    compiler::compile_block(datex_script);
}

/// Executes a Datex script and returns the result as a string.
#[wasm_bindgen]
pub fn execute(datex_script: &str, formatted: bool) -> String {
    let result = compile_script(datex_script, CompileOptions::default());
    if let Ok((dxb, _)) = result {
        let input = ExecutionInput::new_with_dxb_and_options(
            &dxb,
            ExecutionOptions {
                verbose: true,
                ..ExecutionOptions::default()
            },
        );
        let result = execute_dxb_sync(input).unwrap_or_else(|err| {
            panic!("Failed to execute script: {err:?}");
        });
        let result = result.unwrap();
        let (result_dxb, _) =
            compile_template("?", &[result], CompileOptions::default())
                .unwrap();
        
        decompile_body(
            &result_dxb,
            DecompileOptions {
                colorized: formatted,
                formatted,
                json_compat: true,
                ..DecompileOptions::default()
            },
        )
        .unwrap_or_else(|err| {
            panic!("Failed to decompile result: {err:?}");
        })
    } else {
        panic!("Failed to compile script: {:?}", result.err());
    }
}

/// Executes a Datex script and returns true when execution was successful.
/// Does not return the result of the script, but only indicates success or failure.
#[wasm_bindgen]
pub fn execute_internal(datex_script: &str) -> bool {
    let result = compile_script(datex_script, CompileOptions::default());
    if let Ok((dxb, _)) = result {
        let input = ExecutionInput::new_with_dxb_and_options(
            &dxb,
            ExecutionOptions {
                verbose: true,
                ..ExecutionOptions::default()
            },
        );
        let result = execute_dxb_sync(input).unwrap_or_else(|err| {
            panic!("Failed to execute script: {err:?}");
        });
        result.is_some()
    } else {
        panic!("Failed to compile script: {:?}", result.err());
    }
}
