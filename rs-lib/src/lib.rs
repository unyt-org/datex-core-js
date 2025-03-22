#![feature(coroutines)]
#![feature(iter_from_coroutine)]

use std::sync::Mutex; // FIXME no-std

use crypto::crypto_js::CryptoJS;
use datex_core::stdlib::cell::RefCell;
use datex_core::stdlib::rc::Rc;
use datex_core::stdlib::sync::Arc;
// use datex_cli_core::CLI;
use datex_core::compiler;
use datex_core::decompiler;

use datex_core::runtime::Context;
use wasm_bindgen::prelude::*;

use datex_core::runtime::global_context::{set_global_context, GlobalContext};

mod runtime;
use runtime::JSRuntime;

pub mod network;

pub mod crypto;
pub mod js_utils;
pub mod memory;
pub mod pointer;

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
pub fn init_runtime() -> JSRuntime {
    let ctx = Context::default();

    let global_ctx = GlobalContext {
        crypto: Arc::new(Mutex::new(CryptoJS)),
    };

    set_global_context(global_ctx);
    
    JSRuntime::create(ctx)
}

#[wasm_bindgen]
pub fn compile(datex_script: &str) {
    compiler::compile(datex_script);
}

#[wasm_bindgen]
pub fn decompile(
    dxb: &[u8],
    formatted: bool,
    colorized: bool,
    resolve_slots: bool,
) -> String {
    let context = Rc::new(RefCell::new(Context::default()));
    decompiler::decompile(
        context,
        dxb,
        formatted,
        colorized,
        resolve_slots,
    )
}
