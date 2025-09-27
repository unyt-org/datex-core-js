import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertThrows } from "jsr:@std/assert/throws";

const runtime = new Runtime({ endpoint: "@jonas" });

Deno.test("pointer create", () => {
    const ref = runtime.createPointer("Hello, world!", undefined, "Mutable");
    assertEquals(typeof ref, "string");
    const observerId = runtime.observePointer(ref, (value) => {
        console.log("Observed pointer value:", value);
        runtime.unobservePointer(ref, observerId);
    });

    runtime.updateDIF(ref, {
        value: "Hello, Datex!",
        kind: "Replace",
    });
});

Deno.test("observer immutable", () => {
    let ref = runtime.createPointer("Immutable", undefined, "Immutable");
    assertThrows(
        () => {
            runtime.observePointer(ref, (_) => {});
        },
        Error,
        `immutable reference`,
    );

    ref = runtime.createPointer("Immutable", undefined, "Final");
    assertThrows(
        () => {
            runtime.observePointer(ref, (_) => {});
        },
        Error,
        `immutable reference`,
    );
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

Deno.test("core text", () => {
    const script = `"Hello, world!"`;
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, { value: "Hello, world!" });
});

Deno.test("core integer", () => {
    const script = "42";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, {
        type: "$640000",
        value: "42",
    });
});

Deno.test("core boolean", () => {
    const script = "true";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, { value: true });
});

Deno.test("core null", () => {
    const script = "null";
    const result = runtime.executeSyncDIF(script);
    console.log(result); // FIXME
    assertEquals(result, { value: null });
});

Deno.test("core integer variants", () => {
    const script = "42u8";
    const result = runtime.executeSyncDIF(script);
    assertEquals(result, {
        value: "42",
        type: "$640000",
    });
});
