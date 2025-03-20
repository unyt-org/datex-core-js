// @generated file from wasmbuild -- do not edit
// @ts-nocheck: generated
// deno-lint-ignore-file
// deno-fmt-ignore-file
// @ts-self-types="./datex_core_js.d.ts"

// source-hash: 8a980cfa016dfa0bc621f23160ef0d9ede111ccf
import * as imports from "./datex_core_js.internal.js";
const wasm = (await WebAssembly.instantiateStreaming(fetch(new URL("datex_core_js.wasm", import.meta.url)), {
    "./datex_core_js.internal.js": imports,
})).instance;
export * from "./datex_core_js.internal.js";
import { __wbg_set_wasm } from "./datex_core_js.internal.js";
__wbg_set_wasm(wasm.exports);
