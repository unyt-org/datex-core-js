// @ts-ignore no-slow-types
import * as imports from "./datex_core_js.internal.js";
import {__wbg_set_wasm} from "./datex_core_js.internal.js";

export * from "./datex_core_js.internal.js";

const wasm = (await WebAssembly.instantiateStreaming(
    fetch(new URL("datex_core_js.wasm", import.meta.url)),
    {
        "./datex_core_js.internal.js": imports,
    },
)).instance;

__wbg_set_wasm(wasm.exports);
