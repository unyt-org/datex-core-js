import { mapTypeBinding } from "../../src/lib/js-core-types/map.ts";
import { Runtime } from "../../src/runtime/runtime.ts";

Deno.test("test map", () => {
    const runtime = new Runtime({ endpoint: "@test" });
    runtime.dif.type_registry.registerTypeBinding(mapTypeBinding);

    const map = new Map<string | number, string>([["key1", "value1"], [
        2,
        "value2",
    ]]);
    // create mutable pointer to map
    const mapPtr = runtime.createPointer(map);
    const address = runtime.dif.getPointerAddressForValue(mapPtr);
    console.log("Map pointer created:", mapPtr, "at address:", address);

    // TODO: property updates are not yet implemented
    runtime.executeSync(`${mapPtr}.test = 'newValue'`);
    // TODO: check if update was propagated to JS value
});
