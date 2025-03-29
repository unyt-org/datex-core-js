import * as imports from "./datex_core_js.internal.js";

const wasm = (await WebAssembly.instantiate(
    //fetch(new URL("datex_core_js.wasm", import.meta.url)),
    Deno.readFileSync(new URL("datex_core_js.wasm", import.meta.url)),
    {
        "./datex_core_js.internal.js": imports,
    },
)).instance;
export * from "./datex_core_js.internal.js";
import { __wbg_set_wasm } from "./datex_core_js.internal.js";
__wbg_set_wasm(wasm.exports);
