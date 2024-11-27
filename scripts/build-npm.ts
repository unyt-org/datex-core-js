import { build, emptyDir } from "@deno/dnt";

await emptyDir("./npm");

// get version from deno.json
const VERSION: string = await Deno.readTextFile(
    new URL("../deno.json", import.meta.url),
).then(JSON.parse).then((data: { version: string }) => data.version);

await build({
    entryPoints: ["./src/mod.ts"],
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
    postBuild() {
        // steps to run after building and before running the tests
        Deno.copyFileSync("README.md", "npm/README.md");
        Deno.copyFileSync(
            "src/datex-core/datex_core_js_bg.wasm",
            "npm/esm/src/datex-core/datex_core_js_bg.wasm",
        );

        // currently required for version tests
        Deno.copyFileSync("deno.json", "npm/esm/deno.json");
        Deno.mkdirSync("npm/esm/rs-lib/datex-core", { recursive: true });
        Deno.copyFileSync(
            "rs-lib/datex-core/Cargo.toml",
            "npm/esm/rs-lib/datex-core/Cargo.toml",
        );
    },
});
