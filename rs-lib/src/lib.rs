#![feature(coroutines)]
#![feature(iter_from_coroutine)]

use std::io;
use std::io::Write;
use std::io::Read;

// use datex_cli_core::CLI;
use datex_core::compiler;
use datex_core::decompiler;

use datex_core::utils::logger::LoggerContext;
use datex_core::utils::logger::Logger;
use lazy_static::lazy_static;
use wasm_bindgen::prelude::*;

use web_sys::console;

mod runtime;
use runtime::JSRuntime;

pub mod memory;
pub mod pointer;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;


lazy_static! {
    static ref CTX:LoggerContext = LoggerContext {
        log_redirect: Some(|s:&str| -> () {console::log_1(&s.into())})
    };
}



// console.log
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console, final)]
    pub fn log(s: &str);
}



// export compiler/runtime functions to JavaScript
#[wasm_bindgen]
pub fn init_runtime() -> JSRuntime {
    let runtime = JSRuntime::new(&CTX);
    return runtime;
}


#[wasm_bindgen]
pub fn compile(datex_script:&str) {
    compiler::compile(datex_script);
}

#[wasm_bindgen]
pub fn decompile(dxb:&[u8], formatted: bool, colorized:bool, resolve_slots:bool) -> String {
    return decompiler::decompile(&CTX, dxb, formatted, colorized, resolve_slots);
}

// #[wasm_bindgen]
// pub fn execute(dxb:&[u8]) -> Result<String, JsError> {
//     let result = runtime::execute(&CTX, dxb);
//     match result {
//         Ok(val) => Ok(val.to_string()),
//         Err(err) => Err(JsError::new(&err.message))
//     }
// }

struct IOWrite {}
struct IORead {}

impl Write for IOWrite {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let logger = Logger::new_for_development(&CTX, "DATEX");
        logger.success("...write!");
        return Ok(buf.len());
    }

    fn flush(&mut self) -> io::Result<()> {
        let logger = Logger::new_for_development(&CTX, "DATEX");
        logger.success("...flush!");
        return Ok(());
    }
}

impl Read for IORead {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        todo!()
    }
}

// #[wasm_bindgen]
// pub fn cli() {
//     let cli = CLI::new(IOWrite{}, IORead{});
// }