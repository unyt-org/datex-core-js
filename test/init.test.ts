import { assertEquals } from "jsr:@std/assert";
import { Runtime } from "../src/runtime/runtime.ts";

/**
 * Verify that the runtime is initialized correctly and the versions
 * match the expected versions defined in deno.json and Cargo.toml
 */
Deno.test("runtime version", async () => {
    const actual_js_version = await Deno.readTextFile(
        new URL("../deno.json", import.meta.url),
    ).then(JSON.parse).then((data: { version: string }) => data.version);
    
    const actual_version = await Deno.readTextFile(
        new URL("../rs-lib/datex-core/Cargo.toml", import.meta.url),
    ).then((data) => data.match(/version\s*=\s*"?([^"]*)"?$/m)?.[1]);

    const runtime = new Runtime();
    assertEquals(runtime.js_version, actual_js_version);
    assertEquals(runtime.version, actual_version);
    console.log(runtime);
});
