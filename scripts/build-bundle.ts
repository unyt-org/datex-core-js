import { encodeBase64 } from "jsr:@std/encoding/base64";

// check if --inline-wasm argument is passed
// if --inline-wasm is passed, the wasm file will be embedded into the bundle
const inlineWASM = Deno.args.includes("--inline-wasm");

const command = new Deno.Command(Deno.execPath(), {
    args: [
        "bundle",
        "--minify",
        "--platform",
        "browser",
        // TODO: enable sourcemaps when deno supports them
        // "--sourcemap",
        // "inline",
        "-o",
        "./datex.js",
        "./src/mod.ts",
    ],
    stdout: "inherit",
    stderr: "inherit",
});
const { code } = await command.output();
if (code !== 0) {
    console.error("Error bundling the script");
    Deno.exit(code);
} else {
    console.log("Script bundled successfully to datex.js");

    if (!inlineWASM) {
        console.log("Skipping WASM embedding, inline flag not set.");
        Deno.exit(0);
    }

    // replace await WebAssembly.instantiateStreaming(fetch(new URL("datex_core_js.wasm",import.meta.url)) with
    // WebAssembly.instantiate inline
    const wasmFile = new URL(
        "../src/datex-core/datex_core_js.wasm",
        import.meta.url,
    );
    const wasmContent = await Deno.readFile(wasmFile);
    const wasmBase64 = encodeBase64(wasmContent);
    const bundleFile = new URL("../datex.js", import.meta.url);
    let bundleContent = await Deno.readTextFile(bundleFile);

    // add Uint8Array.fromBase64 polyfill at the top of the bundle (TODO: remove when supported in all browsers)
    bundleContent =
        `if (!Uint8Array.fromBase64) Uint8Array.fromBase64 = (base64) => {let binaryString = atob(base64);let bytes = new Uint8Array(binaryString.length);for (let i = 0; i < binaryString.length; i++) {bytes[i] = binaryString.charCodeAt(i);}return bytes.buffer;}\n${bundleContent}`;
    bundleContent = bundleContent.replace(
        `WebAssembly.instantiateStreaming(fetch(new URL("datex_core_js.wasm",import.meta.url))`,
        `WebAssembly.instantiate(Uint8Array.fromBase64("${wasmBase64}")`,
    );
    await Deno.writeTextFile(bundleFile, bundleContent);
    console.log("WASM file embedded into datex.js successfully");
}
