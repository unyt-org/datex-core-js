import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

// get version from deno.json
const VERSION: string = await Deno.readTextFile(
    new URL("../deno.json", import.meta.url),
).then(JSON.parse).then((data: { version: string }) => data.version);

await build({
    entryPoints: [
        {
            name: ".",
            path: "./src/mod.ts",
        },
        {
            name: "./default",
            path: "./src/default.ts",
        },
        // interface impls
        {
            name: "./interface-impls/base",
            path: "./src/network/interface-impls/base.ts",
        },
        {
            name: "./interface-impls/websocket-client",
            path: "./src/network/interface-impls/websocket-client.ts",
        },
        {
            name: "./interface-impls/websocket-server-deno",
            path: "./src/network/interface-impls/websocket-server-deno.ts",
        },
        {
            name: "./interface-impls/serial",
            path: "./src/network/interface-impls/serial.ts",
        },
        {
            name: "./interface-impls/webrtc",
            path: "./src/network/interface-impls/webrtc.ts",
        },
    ],
    outDir: "./npm",
    shims: {
        deno: true,
        timers: true,
        prompts: true,
        undici: true,
        crypto: true,
        weakRef: true,
        webSocket: true,
    },
    typeCheck: false, // TODO: enable, currently fails because of ts errors
    scriptModule: false,
    test: false, // TODO: enable, currently fails, see https://github.com/denoland/dnt/issues/249

    package: {
        // package.json properties
        name: "@unyt/datex",
        version: VERSION,
        license: "MIT",
        repository: {
            type: "git",
            url: "git+https://github.com/unyt-org/datex-core-js.git",
        },
        bugs: {
            url: "https://github.com/unyt-org/datex-core-js/issues",
        },
    },
    // steps to run after building and before running the tests
    postBuild() {
        // replace import.meta because dnt-shim-ignore does not work here
        const datexCoreJSInternalPath = new URL(
            "../npm/esm/datex-core/datex_core_js.js",
            import.meta.url,
        );
        const fileContent = Deno.readTextFileSync(datexCoreJSInternalPath);
        const updatedContent = fileContent.replace(
            `globalThis[Symbol.for("import-meta-ponyfill-esmodule")](import.meta).url`,
            `import.meta.url`,
        );
        Deno.writeTextFileSync(datexCoreJSInternalPath, updatedContent);

        Deno.copyFileSync("README.md", "npm/README.md");
        Deno.copyFileSync(
            "src/datex-core/datex_core_js.wasm",
            "npm/esm/datex-core/datex_core_js.wasm",
        );

        // currently required for version tests
        Deno.copyFileSync("deno.json", "npm/esm/deno.json");
    },
});
