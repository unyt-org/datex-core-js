use std::io::{self, Write};
use wasm_bindgen::prelude::*;
use web_sys::console;

struct ConsoleWriter;

macro_rules! debug {
    ($($rest:tt)+) => {
        console::log_1(&"test".into());
    }
}

pub(crate) use debug;

// #[macro_use]
// pub mod macroconsole {
//     #[macro_export]
//     macro_rules! println {
//         ($($arg:tt)*) => {{
//             let output = format!($($arg)*);
//             // Modify or log the output
//             if let Ok(s) = std::str::from_utf8(output.as_bytes()) {
//                 console::log_1(&s.into());
//             } else {
//                 console::log_1(&"test".into());
//             }
//         }};
//     }
// }

// #[macro_export]
// macro_rules! println {
//     ($($arg:tt)*) => {{
        
//     }};
// }


impl Write for ConsoleWriter {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if let Ok(s) = std::str::from_utf8(buf) {
            console::log_1(&s.into());
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> io::Result<()> {
        Ok(())
    }
}

// #[wasm_bindgen]
// pub fn init_console_log() {
//     let console_writer = ConsoleWriter;
//     let prev_stdout = io::set_print(Box::new(CaptureWriter));

    
//     let _ = io::set(Box::new(console_writer));
//     let _ = io::set_boxed_stderr(Box::new(ConsoleWriter));

//     std::panic::set_hook(Box::new(|info| {
//         console::error_1(&format!("Panic: {}", info).into());
//     }));
// }