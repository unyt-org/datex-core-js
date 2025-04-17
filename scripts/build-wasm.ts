import { runBuildCommand } from "https://jsr.io/@deno/wasmbuild/0.19.1/lib/commands/build_command.ts";
import { Path } from "jsr:@david/path@^0.2.0";
import { format } from "https://deno.land/std@0.224.0/fmt/bytes.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse } from "https://deno.land/std@0.224.0/toml/mod.ts";

const DEFAULT_FLAGS: string[] = [];
const configText = await Deno.readTextFile(".cargo/config.toml");
const RUST_FLAGS =
    (parse(configText).build as { rustflags?: string[] })?.rustflags ?? [];
const PREVIOUS_RUSTFLAGS = Deno.env.has("RUSTFLAGS")
    ? Deno.env.get("RUSTFLAGS")
    : null;
Deno.env.set("RUSTFLAGS", RUST_FLAGS.join(" "));

const flags = parseArgs(Deno.args, {
    boolean: ["opt"],
    string: ["profile"],
    default: { "opt": true, profile: "release" },
    negatable: ["opt"],
});

const NAME = "datex_core_js";
const outDir = new Path("./src/datex-core");
try {
    await runBuildCommand({
        isOpt: flags.opt,
        outDir,
        profile: flags.profile === "release" ? "release" : "debug",
        kind: "build",
        inline: false,
        bindingJsFileExt: "js",
        project: "datex-core-js",
        cargoFlags: DEFAULT_FLAGS,
    });
} catch (e) {
    console.error(`❌ Build failed:`, e);
    Deno.exit(1);
} finally {
    if (PREVIOUS_RUSTFLAGS === null) {
        Deno.env.delete("RUSTFLAGS");
    } else {
        Deno.env.set("RUSTFLAGS", PREVIOUS_RUSTFLAGS ?? "");
    }
}

const jsFile = `import * as imports from "./${NAME}.internal.js";
const wasm = (await WebAssembly.instantiateStreaming(
    fetch(new URL("${NAME}.wasm", import.meta.url)),
    {
        "./${NAME}.internal.js": imports,
    },
)).instance;
export * from "./${NAME}.internal.js";
import { __wbg_set_wasm } from "./${NAME}.internal.js";
__wbg_set_wasm(wasm.exports);
`;

await outDir.resolve(`${NAME}.js`).writeText(jsFile);
const fileSize = (await outDir.resolve(`${NAME}.wasm`).stat())!.size;
console.info(`✅ Build complete: (${format(fileSize)})`);
