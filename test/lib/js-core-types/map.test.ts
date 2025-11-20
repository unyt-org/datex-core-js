import { assertEquals } from "@std/assert/equals";
import { mapTypeBinding } from "datex-core-js/lib/js-core-types/map.ts";
import { Runtime } from "datex-core-js/runtime/runtime.ts";
import { DIFUpdateKind } from "datex-core-js/dif/definitions.ts";

Deno.test("map", () => {
    const runtime = new Runtime({ endpoint: "@test" });
    runtime.dif.type_registry.registerTypeBinding(mapTypeBinding);

    const map = new Map<string | number, string>([
        ["key1", "value1"],
        [2, "value2"],
    ]);
    // create mutable pointer to map
    const mapPtr = runtime.createTransparentReference(map);
    const address = runtime.dif.getPointerAddressForValue(mapPtr)!;

    // 1. external update
    // TODO: property updates are not yet implemented in DATEX Script
    // runtime.executeSync(`${mapPtr}.test = 'newValue'`);
    // fake a remote update from transceiver 42
    // SET
    runtime.dif._handle.update(42, address, {
        key: { kind: "text", value: "externalKey" },
        value: { value: "newValue" },
        kind: DIFUpdateKind.Set,
    });
    assertEquals(map.get("externalKey"), "newValue");

    // DELETE (no effect since map is already empty)
    runtime.dif._handle.update(42, address, {
        kind: DIFUpdateKind.Delete,
        key: { kind: "text", value: "externalKey" },
    });
    assertEquals(map.has("externalKey"), false);

    // CLEAR
    runtime.dif._handle.update(42, address, {
        kind: DIFUpdateKind.Clear,
    });
    assertEquals(map.size, 0);

    // 2. local update
    map.set("localKey", "localValue");
    assertEquals(map.get("localKey"), "localValue");
    const runtimeLocalValue: Map<unknown, unknown> = runtime.dif
        .resolveDIFValueContainerSync(
            runtime.dif._handle.resolve_pointer_address_sync(address).value,
        );
    assertEquals(
        (runtimeLocalValue as Map<unknown, unknown>).get("localKey"),
        "localValue",
    );
});
