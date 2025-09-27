import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertThrows } from "jsr:@std/assert/throws";
import { ReferenceMutability } from "../../src/dif/definitions.ts";

const runtime = new Runtime({ endpoint: "@jonas" });

Deno.test("pointer create", () => {
    const ref = runtime.dif.createPointerSync(
        "Hello, world!",
        undefined,
        ReferenceMutability.Mutable,
    );
    assertEquals(typeof ref, "string");
    const observerId = runtime.dif.observePointer(ref, (value) => {
        console.log("Observed pointer value:", value);
        runtime.dif.unobservePointer(ref, observerId);
    });

    runtime.dif.updateDIF(ref, {
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

    const ptr = runtime.dif.createPointerSync(
        "unyt.org",
        undefined,
        ReferenceMutability.Mutable,
    );
    const resolved = runtime.dif.resolveDIFValueContainerSync<string>(
        ptr,
    );
    assertEquals(resolved, "unyt.org");
});

Deno.test("observer immutable", () => {
    let ref = runtime.dif.createPointerSync(
        "Immutable",
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

    ref = runtime.dif.createPointerSync(
        "Immutable",
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
    const ref = runtime.dif.createPointerSync(
        "42",
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
