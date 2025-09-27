import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";

const runtime = new Runtime({ endpoint: "@jonas" });

Deno.test("pointer create", () => {
    let p = runtime.createPointer("xxxx");
    console.log("Pointer address:", p);
    assertEquals(typeof p, "string");
});

/**
 * hash(1) ->
 */
Deno.test("core integer", () => {
    const script = "42";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, {
        type: "integer",
        value: "42",
    });
    console.log(result);
});

Deno.test("core boolean", () => {
    const script = "true";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, {
        type: "boolean",
        value: true,
    });
    console.log(result);
});

Deno.test("core null", () => {
    const script = "null";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, {
        type: "null",
        value: null,
    });
    console.log(result);
});

Deno.test("core integer variants", () => {
    const script = "42u8";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, {
        type: ["integer", "u8"],
        value: "42",
    });
    console.log(result);
});
