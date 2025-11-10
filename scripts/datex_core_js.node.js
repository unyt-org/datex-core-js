import * as imports from "./datex_core_js.internal.js";
import { runtimeInterface, detectRuntime } from "../utils/js-runtime-compat/js-runtime.js";

let wasmUrl;
const isVite = !!import.meta.env?.MODE;
if (detectRuntime() == "browser" && isVite) {
    wasmUrl = (await import("./wasm_url.node.js")).default;
} else {
    wasmUrl = new URL("datex_core_js.wasm", import.meta.url);
}

const wasm = (await runtimeInterface.instantiateWebAssembly(wasmUrl, {
    "./datex_core_js.internal.js": imports,
})).instance;
export * from "./datex_core_js.internal.js";
import { __wbg_set_wasm } from "./datex_core_js.internal.js";
__wbg_set_wasm(wasm.exports);
wasm.exports.__wbindgen_start();