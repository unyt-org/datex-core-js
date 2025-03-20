import * as build from "https://jsr.io/@deno/wasmbuild/0.19.1/lib/commands/build_command.ts";
import { Path } from "jsr:@david/path@^0.2.0";

await build.runBuildCommand({
    profile: "release",
    kind: "build",
    inline: false,
    outDir: new Path("./src/datex-core"),
    bindingJsFileExt: "js",
    isOpt: true, // set false to skip wasm-opt
    project: "datex-core-js",
    cargoFlags: ["--no-default-features"],
});

const jsFile = `
import * as imports from "./datex_core_js.internal.js";
const wasm = (await WebAssembly.instantiateStreaming(fetch(new URL("datex_core_js.wasm", import.meta.url)), {
    "./datex_core_js.internal.js": imports,
})).instance;
export * from "./datex_core_js.internal.js";
import { __wbg_set_wasm } from "./datex_core_js.internal.js";
__wbg_set_wasm(wasm.exports);
`;
