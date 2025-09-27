import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertThrows } from "jsr:@std/assert/throws";

const runtime = new Runtime({ endpoint: "@jonas" });

Deno.test("pointer create", () => {
    const ref = runtime.createPointer("Hello, world!", undefined, "Mutable");
    assertEquals(typeof ref, "string");
    console.log(ref);
    const observerId = runtime.observePointer(ref, (value) => {
        console.log("Observed pointer value:", value);
        runtime.unobservePointer(ref, observerId);
    });

    runtime.updateDIF(ref, {
        value: "Hello, Datex!",
        kind: "Replace",
    });
});

Deno.test("pointer observe unobserve", () => {
    const ref = runtime.createPointer("42", undefined, "Mutable");
    assertThrows(
        () => {
            runtime.unobservePointer(ref, 42);
        },
        Error,
        `not found`,
    );

    const observerId = runtime.observePointer(ref, (value) => {
        console.log("Observed pointer value:", value);
        runtime.unobservePointer(ref, observerId);
    });
    assertEquals(observerId, 0);
    runtime.unobservePointer(ref, observerId);
    assertThrows(
        () => {
            runtime.unobservePointer(ref, observerId);
        },
        Error,
        `not found`,
    );
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
