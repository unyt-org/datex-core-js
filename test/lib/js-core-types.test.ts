import { assertEquals } from "@std/assert/equals";
import { mapTypeBinding } from "../../src/lib/js-core-types/map.ts";
import { Runtime } from "../../src/runtime/runtime.ts";
import { DIFUpdateKind } from "../../src/dif/definitions.ts";

Deno.test("map", () => {
    const runtime = new Runtime({ endpoint: "@test" });
    runtime.dif.type_registry.registerTypeBinding(mapTypeBinding);

    const map = new Map<string | number, string>([
        ["key1", "value1"],
        [2, "value2"],
    ]);
    // create mutable pointer to map
    const mapPtr = runtime.createPointer(map);
    const address = runtime.dif.getPointerAddressForValue(mapPtr)!;
    console.log("Map pointer created:", mapPtr, "at address:", address);

    // 1. external update
    // TODO: property updates are not yet implemented in DATEX Script
    // runtime.executeSync(`${mapPtr}.test = 'newValue'`);
    // fake a remote update from transceiver 42
    runtime.dif._handle.update(42, address, {
        key: { kind: "text", value: "externalKey" },
        value: { value: "newValue" },
        kind: DIFUpdateKind.Set,
    });
    assertEquals(map.get("externalKey"), "newValue");

    // 2. local update
    map.set("localKey", "localValue");
    assertEquals(map.get("localKey"), "localValue");
});
