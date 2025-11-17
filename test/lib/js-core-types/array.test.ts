import { assertEquals } from "@std/assert/equals";
import { Runtime } from "datex-core-js/runtime/runtime.ts";
import { DIFUpdateKind } from "datex-core-js/dif/definitions.ts";
import { arrayTypeBinding } from "datex-core-js/lib/js-core-types/array.ts";

Deno.test("array", () => {
    const runtime = new Runtime({ endpoint: "@test" });
    runtime.dif.type_registry.registerTypeBinding(arrayTypeBinding);

    const array = new Array<string | number>("value1", "value2", 123);
    // create mutable pointer to array
    const arrayPtr = runtime.createOrGetTransparentReference(array);
    const address = runtime.dif.getPointerAddressForValue(arrayPtr)!;

    function getCurrentRuntimeLocalValue() {
        return runtime.dif
            .resolveDIFValueContainerSync(
                runtime.dif._handle.resolve_pointer_address_sync(address).value,
            ) as typeof array;
    }

    // 1. external update
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

    // APPEND
    runtime.dif._handle.update(42, address, {
        value: { value: "newValueEnd" },
        kind: DIFUpdateKind.Append,
    });
    assertEquals(arrayPtr[3], "newValueEnd");

    // DELETE
    runtime.dif._handle.update(42, address, {
        kind: DIFUpdateKind.Delete,
        key: { kind: "index", value: 0 },
    });
    assertEquals(arrayPtr, ["value2", 123, "newValueEnd"]);

    // CLEAR
    runtime.dif._handle.update(42, address, {
        kind: DIFUpdateKind.Clear,
    });
    assertEquals(arrayPtr.length, 0);

    // REPLACE
    arrayPtr.push("toBeRemoved");
    runtime.dif._handle.update(42, address, {
        value: runtime.dif.convertJSValueToDIFValue(["a", "b", "c"]),
        kind: DIFUpdateKind.Replace,
    });
    assertEquals(arrayPtr, ["a", "b", "c"]);

    // 2. local update
    arrayPtr.push("localValue1", "localValue2");

    assertEquals(getCurrentRuntimeLocalValue(), [
        "a",
        "b",
        "c",
        "localValue1",
        "localValue2",
    ]);

    arrayPtr.length = 10;

    assertEquals(getCurrentRuntimeLocalValue(), [
        "a",
        "b",
        "c",
        "localValue1",
        "localValue2",
        null,
        null,
        null,
        null,
        null,
    ] as any[]);
});
