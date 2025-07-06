import * as imports from "./datex_core_js.internal.js";
// for deno-to-node builds, fetch does not support streaming webassembly instantiation
const isDntBuild = !!globalThis[Symbol.for("import-meta-ponyfill-commonjs")];
const isBrowser = !globalThis.navigator.userAgent.startsWith("Deno") &&
    !globalThis.navigator.userAgent.startsWith("Node.js") &&
    !globalThis.navigator.userAgent.startsWith("Bun");
const wasm = (
    isBrowser // TODO: Deno should also do instantiateStreaming (globalThis.Deno && !isDntBuild)
        ? await WebAssembly.instantiateStreaming(
            // dnt-shim-ignore
            fetch(new URL("datex_core_js.wasm", import.meta.url)),
            {
                "./datex_core_js.internal.js": imports,
            },
        )
        : await WebAssembly.instantiate(
            await Deno.readFile(new URL("datex_core_js.wasm", import.meta.url)),
            {
                "./datex_core_js.internal.js": imports,
            },
        )
).instance;
export * from "./datex_core_js.internal.js";
import { __wbg_set_wasm } from "./datex_core_js.internal.js";
__wbg_set_wasm(wasm.exports);
wasm.exports.__wbindgen_start();
