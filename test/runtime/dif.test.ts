import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import { assertThrows } from "jsr:@std/assert/throws";
import {
    CoreTypeAddress,
    type DIFRepresentationValue,
    type DIFUpdate,
    DIFUpdateKind,
    ReferenceMutability,
} from "../../src/dif/definitions.ts";
import { assertStrictEquals } from "jsr:@std/assert/strict-equals";
import { Ref } from "../../src/refs/ref.ts";

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

    runtime.dif.updatePointer(ref, {
        value: "Hello, Datex!",
        kind: DIFUpdateKind.Replace,
    });

    // if not equal, unobservePointer potentially failed
    assertEquals(observed, {
        value: "Hello, Datex!",
        kind: DIFUpdateKind.Replace,
    });
});

Deno.test("pointer create and resolve", () => {
    // TODO: reenable, currently panics because async resolution is not yet implemented
    // assertThrows(
    //     () => {
    //         runtime.dif.resolveDIFValueContainerSync<string>("abcdef");
    //     },
    //     Error,
    //     `Invalid`,
    // );

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

Deno.test("pointer object create and resolve", () => {
    const initialDIFValue: DIFRepresentationValue = [
        [{ value: "a" }, { value: 123 }],
        [{ value: "b" }, { value: 456 }],
    ];
    const ptr = runtime.dif.createPointer(
        {
            value: initialDIFValue,
        },
        undefined,
        ReferenceMutability.Mutable,
    );
    console.log("ptr address", ptr);
    const loadedDIFValue = runtime.dif.resolvePointerAddress(ptr);
    console.log("loadedObj", loadedDIFValue);

    assertEquals(loadedDIFValue, initialDIFValue);
});

Deno.test("pointer object create and cache", () => {
    const val = { a: 123, b: 456 };
    const ptrObj = runtime.createPointer(val);
    console.log("ptrObj", ptrObj);
    assertEquals(ptrObj, val);

    const ptrId = runtime.dif.getPointerAddressForValue(val);
    console.log("ptrId", ptrId);
    if (!ptrId) {
        throw new Error("Pointer ID not found for value");
    }

    // check if cache is used when resolving the pointer again
    const loadedObj = runtime.dif.resolvePointerAddress(ptrId);
    console.log("loadedObj", loadedObj);
    // identical object reference
    assertStrictEquals(loadedObj, val);
});

Deno.test("pointer primitive ref create and cache", () => {
    const val = 123;
    const ptrObj = runtime.createPointer(val);
    if (!(ptrObj instanceof Ref)) {
        throw new Error("Pointer object is not a Ref");
    }
    console.log("ptrObj", ptrObj);
    assertEquals(ptrObj.value, val);

    const ptrId = ptrObj.pointerAddress;

    // check if cache is used when resolving the pointer again
    const loadedObj = runtime.dif.resolvePointerAddress(ptrId) as number;
    console.log("loadedObj", loadedObj);
    // identical primitive value
    assertStrictEquals(loadedObj, ptrObj);
});

Deno.test("pointer primitive ref update", () => {
    const val = 123;
    const ptrObj = runtime.createPointer(val as number);
    if (!(ptrObj instanceof Ref)) {
        throw new Error("Pointer object is not a Ref");
    }
    console.log("ptrObj", ptrObj);
    assertEquals(ptrObj.value, val);

    // get value of ptrObj from DATEX execution
    let result = runtime.executeSyncWithStringResult(
        "$" + ptrObj.pointerAddress,
    );
    assertEquals(result, "&mut 123");

    // update the ref value
    ptrObj.value = 456;

    // get value of ptrObj from DATEX execution
    result = runtime.executeSyncWithStringResult(
        "$" + ptrObj.pointerAddress,
    );
    assertEquals(result, "&mut 456");
});

Deno.test("pointer primitive ref immutable update", () => {
    const val = 123;
    const ptrObj = runtime.createPointer(
        val as number,
        undefined,
        ReferenceMutability.Immutable,
    );
    if (!(ptrObj instanceof Ref)) {
        throw new Error("Pointer object is not a Ref");
    }
    console.log("ptrObj", ptrObj);
    assertEquals(ptrObj.value, val);

    // get value of ptrObj from DATEX execution
    const result = runtime.executeSyncWithStringResult(
        "$" + ptrObj.pointerAddress,
    );
    assertEquals(result, "&123");

    // update the ref value
    assertThrows(
        () => {
            ptrObj.value = 456;
        },
        Error,
        `immutable reference`,
    );
});

Deno.test("pointer primitive ref final update", () => {
    const val = 123;
    const ptrObj = runtime.createPointer(
        val as number,
        undefined,
        ReferenceMutability.Final,
    );
    if (!(ptrObj instanceof Ref)) {
        throw new Error("Pointer object is not a Ref");
    }
    console.log("ptrObj", ptrObj);
    assertEquals(ptrObj.value, val);

    // get value of ptrObj from DATEX execution
    const result = runtime.executeSyncWithStringResult(
        "$" + ptrObj.pointerAddress,
    );
    assertEquals(result, "&final 123");

    // update the ref value
    assertThrows(
        () => {
            ptrObj.value = 456;
        },
        Error,
        `immutable reference`,
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
        type: CoreTypeAddress.integer,
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
        type: CoreTypeAddress.integer, // TODO: this must be changed to integer_u8, but type information is currently lost in compilation
    });
});
