import { runBuildCommand } from "https://jsr.io/@deno/wasmbuild/0.19.2/lib/commands/build_command.ts";
import { Path } from "jsr:@david/path@^0.2.0";
import { format } from "https://deno.land/std@0.224.0/fmt/bytes.ts";
import { parseArgs } from "jsr:@std/cli/parse-args";
import { parse } from "https://deno.land/std@0.224.0/toml/mod.ts";
import { dedent } from "jsr:@qnighy/dedent";

const configText = await Deno.readTextFile(".cargo/config.toml");
const RUST_FLAGS =
    (parse(configText).build as { rustflags?: string[] })?.rustflags ?? [];
const PREVIOUS_RUSTFLAGS = Deno.env.has("RUSTFLAGS")
    ? Deno.env.get("RUSTFLAGS")
    : null;
Deno.env.set("RUSTFLAGS", RUST_FLAGS.join(" "));

const flags = parseArgs(Deno.args, {
    boolean: ["opt", "inline"],
    string: ["profile"],
    default: { "opt": true, "inline": false, "profile": "release" },
    negatable: ["opt"],
});
const DEFAULT_FLAGS: string[] = flags.profile === "debug"
    ? ["--features", "debug"]
    : []; // "--no-default-features"

const NAME = "datex_core_js";
const outDir = new Path("./src/datex-core");
try {
    await runBuildCommand({
        isOpt: flags.opt,
        outDir,
        profile: flags.profile === "release" ? "release" : "debug",
        kind: "build",
        inline: flags.inline,
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

if (!flags.inline) {
    const jsFile = dedent`
        import * as imports from "./${NAME}.internal.js";
        // for deno-to-node builds, fetch does not support streaming webassembly instantiation
        const isDntBuild = !!globalThis[Symbol.for("import-meta-ponyfill-commonjs")];
        const isBrowser = !globalThis.navigator?.userAgent.startsWith("Deno") &&
            !globalThis.navigator?.userAgent.startsWith("Node.js") &&
            !globalThis.navigator?.userAgent.startsWith("Bun");
        const wasm = (
            isBrowser // TODO: Deno should also do instantiateStreaming (globalThis.Deno && !isDntBuild)
                ? await WebAssembly.instantiateStreaming(
                    // dnt-shim-ignore
                    fetch(new URL("${NAME}.wasm", import.meta.url)),
                    {
                        "./${NAME}.internal.js": imports,
                    },
                )
                : await WebAssembly.instantiate(
                    await Deno.readFile(new URL("${NAME}.wasm", import.meta.url)),
                    {
                        "./${NAME}.internal.js": imports,
                    },
                )
        ).instance;
        export * from "./${NAME}.internal.js";
        import { __wbg_set_wasm } from "./${NAME}.internal.js";
        __wbg_set_wasm(wasm.exports);
        wasm.exports.__wbindgen_start();
    `.trimStart();

    await outDir.resolve(`${NAME}.js`).writeText(jsFile);
}
const fileSize = (await outDir.resolve(`${NAME}.wasm`).stat())!.size;
console.info(`✅ Build complete: (${format(fileSize)})`);
