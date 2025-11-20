import { assertEquals } from "@std/assert/equals";
import { Runtime } from "datex-core-js/runtime/runtime.ts";
import { DIFUpdateKind } from "datex-core-js/dif/definitions.ts";
import { arrayTypeBinding } from "datex-core-js/lib/js-core-types/array.ts";

const runtime = new Runtime({ endpoint: "@test" });
runtime.dif.type_registry.registerTypeBinding(arrayTypeBinding);

function getCurrentRuntimeLocalValue<T>(address: string) {
    return runtime.dif
        .resolveDIFValueContainerSync(
            runtime.dif._handle.resolve_pointer_address_sync(address).value,
        ) as T;
}

function createArrayReference<T>(array: T[]): [T[], string] {
    const arrayPtr = runtime.createTransparentReference(array);
    const address = runtime.dif.getPointerAddressForValue(arrayPtr)!;
    return [arrayPtr, address];
}

Deno.test("array set external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    // TODO: property updates are not yet implemented in DATEX Script
    // runtime.executeSync(`${mapPtr}.test = 'newValue'`);
    // fake a remote update from transceiver 42
    // SET inner
    runtime.dif._handle.update(42, address, {
        key: { kind: "index", value: 0 },
        value: { value: "newValue" },
        kind: DIFUpdateKind.Set,
    });
    assertEquals(arrayPtr[0], "newValue");
});

Deno.test("array append external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    runtime.dif._handle.update(42, address, {
        value: { value: "newValueEnd" },
        kind: DIFUpdateKind.Append,
    });
    assertEquals(arrayPtr[3], "newValueEnd");
});

Deno.test("array delete external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    runtime.dif._handle.update(42, address, {
        kind: DIFUpdateKind.Delete,
        key: { kind: "index", value: 0 },
    });
    assertEquals(arrayPtr, ["value2", 123]);
});

Deno.test("array clear external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    runtime.dif._handle.update(42, address, {
        kind: DIFUpdateKind.Clear,
    });
    assertEquals(arrayPtr.length, 0);
});

Deno.test("array replace external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    arrayPtr.push("toBeRemoved");
    runtime.dif._handle.update(42, address, {
        value: runtime.dif.convertJSValueToDIFValueContainer(["a", "b", "c"]),
        kind: DIFUpdateKind.Replace,
    });
    assertEquals(arrayPtr, ["a", "b", "c"]);
});

Deno.test("array push local", () => {
    // create mutable ref to array
    const array = ["a", "b", "c"];
    const [arrayPtr, address] = createArrayReference(array);

    arrayPtr.push("localValue1", "localValue2");

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "a",
        "b",
        "c",
        "localValue1",
        "localValue2",
    ]);
});

Deno.test("array set length local", () => {
    // create mutable ref to array
    const array = ["a", "b", "c"];
    const [arrayPtr, address] = createArrayReference(array);
    // 2. local update

    arrayPtr.length = 5;

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "a",
        "b",
        "c",
        null,
        null,
    ]);
});
