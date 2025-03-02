#![feature(coroutines)]
#![feature(iter_from_coroutine)]

use std::cell::Ref;
use std::cell::RefCell;
use std::io;
use std::io::Read;
use std::io::Write;
use std::rc::Rc;
use std::sync::Arc;
use std::sync::Mutex;

// use datex_cli_core::CLI;
use datex_core::compiler;
use datex_core::decompiler;

use datex_core::utils::logger::Logger;
use datex_core::utils::logger::LoggerContext;
use lazy_static::lazy_static;
use wasm_bindgen::prelude::*;

use web_sys::console;

mod runtime;
use runtime::JSRuntime;

pub mod jsconsole;
pub(crate) use jsconsole::debug;

pub mod network;
use network::com_interfaces::websocket_client_js;

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
  let ctx = Arc::new(Mutex::new(LoggerContext {
    log_redirect: Some(|s: &str| -> () { console::log_1(&s.into()) }),
  }));
  let runtime = JSRuntime::create(ctx.clone());
  return runtime;
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
  let ctx = Arc::new(Mutex::new(LoggerContext {
    log_redirect: Some(|s: &str| -> () { console::log_1(&s.into()) }),
  }));
  return decompiler::decompile(ctx, dxb, formatted, colorized, resolve_slots);
}

// #[wasm_bindgen]
// pub fn execute(dxb:&[u8]) -> Result<String, JsError> {
//     let result = runtime::execute(&CTX, dxb);
//     match result {
//         Ok(val) => Ok(val.to_string()),
//         Err(err) => Err(JsError::new(&err.message))
//     }
// }

// struct IOWrite {}
// struct IORead {}

// impl Write for IOWrite {
//   fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
//     let logger = Logger::new_for_development(&CTX, "DATEX".to_string());
//     logger.success("...write!");
//     return Ok(buf.len());
//   }

//   fn flush(&mut self) -> io::Result<()> {
//     let logger = Logger::new_for_development(&CTX, "DATEX".to_string());
//     logger.success("...flush!");
//     return Ok(());
//   }
// }

// impl Read for IORead {
//   fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
//     todo!()
//   }
// }

// #[wasm_bindgen]
// pub fn cli() {
//     let cli = CLI::new(IOWrite{}, IORead{});
// }
