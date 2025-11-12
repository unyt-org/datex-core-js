use futures::StreamExt;
use wasm_bindgen::{JsCast, JsValue, prelude::Closure};
mod io;
use datex_core::{runtime::Runtime, task::spawn_local};
use futures_channel::mpsc;
use js_sys::Uint8Array;

use crate::lsp::io::{Reader, Writer};

pub fn start_lsp(
    runtime: Runtime,
    send_to_js: js_sys::Function,
) -> js_sys::Function {
    let (tx_to_lsp, rx_from_js) = mpsc::unbounded::<Vec<u8>>();
    let (tx_to_js, mut rx_from_lsp) = mpsc::unbounded::<Vec<u8>>();

    let reader = Reader::new(rx_from_js);
    let writer = Writer::new(tx_to_js);

    spawn_local(async move {
        use datex_core::lsp::create_lsp;
        create_lsp(runtime, reader, writer).await;
    });

    spawn_local(async move {
        while let Some(bytes) = rx_from_lsp.next().await {
            let js_array = Uint8Array::from(bytes.as_slice());
            let _ = send_to_js.call1(&JsValue::NULL, &js_array);
        }
    });

    let send_to_rust_closure =
        Closure::wrap(Box::new(move |data: Uint8Array| {
            let vec = data.to_vec();
            let _ = tx_to_lsp.unbounded_send(vec);
        }) as Box<dyn FnMut(Uint8Array)>);

    send_to_rust_closure.into_js_value().unchecked_into()
}
