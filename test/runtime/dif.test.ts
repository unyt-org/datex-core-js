import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertThrows } from "jsr:@std/assert/throws";
import { DIFUpdate, ReferenceMutability } from "../../src/dif/definitions.ts";

const runtime = new Runtime({ endpoint: "@jonas" });

Deno.test("pointer create", () => {
    const ref = runtime.dif.createPointer(
        {
            value: "Hello, Datex!",
        },
        undefined,
        ReferenceMutability.Mutable,
    );
    assertEquals(typeof ref, "string");

    let observed: DIFUpdate | null = null;
    const observerId = runtime.dif.observePointer(ref, (value) => {
        console.log("Observed pointer value:", value);
        try {
            console.log("Unobserving pointer...", ref, observerId);
            // FIXME wtf https://github.com/wasm-bindgen/wasm-bindgen/issues/1578
            // console.log(runtime.executeSync("'xy'"));
            runtime.dif.unobservePointer(ref, observerId);
            observed = value;
        } catch (e) {
            console.error("Failed to unobserve pointer:", e);
        }
    });

    runtime.dif.updateDIF(ref, {
        value: "Hello, Datex!",
        kind: "Replace",
    });

    // if not equal, unobservePointer potentially failed
    assertEquals(observed, {
        value: "Hello, Datex!",
        kind: "Replace",
    });
});

Deno.test("pointer create and resolve", () => {
    assertThrows(
        () => {
            runtime.dif.resolveDIFValueContainerSync<string>("non-existing");
        },
        Error,
        `Invalid`,
    );

    const ptr = runtime.dif.createPointer(
        { value: "unyt.org" },
        undefined,
        ReferenceMutability.Mutable,
    );
    const resolved = runtime.dif.resolveDIFValueContainerSync<string>(
        ptr,
    );
    assertEquals(resolved, "unyt.org");
});

Deno.test("pointer object create and cache", () => {
    const obj = { a: 123, b: 456 };
    const ptr = runtime.dif.createPointer(
        { value: { a: { value: 123 }, b: { value: 456 } } },
        undefined,
        ReferenceMutability.Mutable,
    );
    const resolved = runtime.dif.resolveDIFValueContainerSync<
        Record<string, number>
    >(
        ptr,
    );
});

Deno.test("observer immutable", () => {
    let ref = runtime.dif.createPointer(
        { value: "Immutable" },
        undefined,
        ReferenceMutability.Immutable,
    );
    assertThrows(
        () => {
            runtime.dif.observePointer(ref, (_) => {});
        },
        Error,
        `immutable reference`,
    );

    ref = runtime.dif.createPointer(
        { value: "Immutable" },
        undefined,
        ReferenceMutability.Final,
    );
    assertThrows(
        () => {
            runtime.dif.observePointer(ref, (_) => {});
        },
        Error,
        `immutable reference`,
    );
});

Deno.test("pointer observe unobserve", () => {
    const ref = runtime.dif.createPointer(
        { value: "42" },
        undefined,
        ReferenceMutability.Mutable,
    );
    assertThrows(
        () => {
            runtime.dif.unobservePointer(ref, 42);
        },
        Error,
        `not found`,
    );

    const observerId = runtime.dif.observePointer(ref, (value) => {
        console.log("Observed pointer value:", value);
        runtime.dif.unobservePointer(ref, observerId);
    });
    assertEquals(observerId, 0);
    runtime.dif.unobservePointer(ref, observerId);
    assertThrows(
        () => {
            runtime.dif.unobservePointer(ref, observerId);
        },
        Error,
        `not found`,
    );
});

Deno.test("core text", () => {
    const script = `"Hello, world!"`;
    const result = runtime.dif.executeSyncDIF(script);
    assertEquals(result, { value: "Hello, world!" });
});

Deno.test("core integer", () => {
    const script = "42";
    const result = runtime.dif.executeSyncDIF(script);
    assertEquals(result, {
        type: "$640000",
        value: "42",
    });
});

Deno.test("core boolean", () => {
    const script = "true";
    const result = runtime.dif.executeSyncDIF(script);
    assertEquals(result, { value: true });
});

Deno.test("core null", () => {
    const script = "null";
    const result = runtime.dif.executeSyncDIF(script);
    assertEquals(result, { value: null });
});

Deno.test("core integer variants", () => {
    const script = "42u8";
    const result = runtime.dif.executeSyncDIF(script);
    assertEquals(result, {
        value: "42",
        type: "$640000",
    });
});
