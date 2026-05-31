import { assertEquals } from "@std/assert/equals";
import { mapTypeBinding } from "datex/lib/js-core-types/map.ts";
import { Runtime } from "datex/runtime/runtime.ts";
import { CoreLibTypeId } from "datex/dif/core.ts";
import { Endpoint } from "datex/lib/mod.ts";
import { DIFUpdateKind } from "datex/dif/types/mod.ts";
import { performFakeRemoteUpdate } from "../utils.ts";
import { SharedContainerMutability } from "datex/shared-container/base-shared-container.ts";
import { CachedSharedContainer } from "datex/dif/dif-handler.ts";
import { PointerAddress, SharedRef } from "datex/shared-container/mod.ts";
import { clear, createDIFProperty, deleteEntry, DIFPropertyKind, replace, setEntry } from "datex/dif/update.ts";
const runtime = await Runtime.create({ endpoint: Endpoint.get("@test") });
runtime.dif.type_registry.registerTypeBinding(mapTypeBinding);

function getCurrentRuntimeLocalValue<T>(address: string) {
    return runtime.dif
        .resolveDIFValueContainer(
            runtime.dif._handle.resolve_pointer_address(address).value,
        ) as T;
}

function createMapReference<T extends Map<unknown, unknown>, M extends SharedContainerMutability.Mutable>(
    array: T,
    mutability: M = SharedContainerMutability.Mutable as M,
): [SharedRef<T, M>, PointerAddress] {
    const arrayPtr = runtime.createSharedValueFromJSValue<T, M>(array, null, mutability) as SharedRef<T, M>;
    const address = runtime.dif.getPointerAddressForValue(arrayPtr as CachedSharedContainer)!;
    return [arrayPtr, address];
}

Deno.test("map set external", () => {
    // create mutable pointer to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
        ]),
    );

    // fake a remote update from transceiver 42
    performFakeRemoteUpdate(
        runtime,
        address,
        setEntry(
            createDIFProperty("externalKey", DIFPropertyKind.Text),
            runtime.dif.convertJSValueToDIFValueContainer("newValue"),
        ),
    );
    assertEquals(map.get("externalKey"), "newValue");
});

Deno.test("map delete external", () => {
    // create mutable ref to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
        ]),
    );
    performFakeRemoteUpdate(runtime, address, deleteEntry(createDIFProperty("key1", DIFPropertyKind.Text)));
    assertEquals(map.has("key1"), false);
});

Deno.test("map clear external", () => {
    // create mutable ref to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
        ]),
    );

    performFakeRemoteUpdate(runtime, address, clear());
    assertEquals(map.size, 0);
});

Deno.test("map replace external", () => {
    // create mutable ref to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
        ]),
    );

    performFakeRemoteUpdate(
        runtime,
        address,
        replace(
            runtime.dif.convertJSValueToDIFValueContainer(
                new Map<string, string>([
                    ["a", "valueA"],
                    ["b", "valueB"],
                ]),
            ),
        ),
    );
    assertEquals(
        map,
        new Map<string, string>([
            ["a", "valueA"],
            ["b", "valueB"],
        ]) as SharedRef<Map<string, string>, SharedContainerMutability.Mutable>,
    );
});

Deno.test("map set local", () => {
    // create mutable ref to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
        ]),
    );

    // 2. local update
    map.set("localKey", "localValue");
    assertEquals(map.get("localKey"), "localValue");
    assertEquals(
        getCurrentRuntimeLocalValue<Map<unknown, unknown>>(address).get(
            "localKey",
        ),
        "localValue",
    );
});

Deno.test("map delete local", () => {
    // create mutable ref to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
            ["toBeDeleted", "value3"],
        ]),
    );

    // 2. local update
    map.delete("toBeDeleted");
    assertEquals(map.has("toBeDeleted"), false);
    assertEquals(
        getCurrentRuntimeLocalValue<Map<unknown, unknown>>(address).has(
            "toBeDeleted",
        ),
        false,
    );
});

Deno.test("map clear local", () => {
    // create mutable ref to map
    const [map, address] = createMapReference(
        new Map<string | number, string>([
            ["key1", "value1"],
            [2, "value2"],
        ]),
    );
    // 2. local update
    map.clear();
    assertEquals(map.size, 0);
    assertEquals(
        getCurrentRuntimeLocalValue<Map<unknown, unknown>>(address).size,
        0,
    );
});

Deno.test("structural map from datex", () => {
    const map = runtime.executeSync<Record<string, unknown>>("{}", []);
    assertEquals(map instanceof Map, false);
    assertEquals(Object.keys(map).length, 0);
});

Deno.test("map from datex", () => {
    const mapDif = runtime.dif.executeSyncDIF("{(1): 2}");
    assertEquals(mapDif, [CoreLibTypeId.Map, [
        [
            [CoreLibTypeId.integer, 1],
            [CoreLibTypeId.integer, 2],
        ],
    ]]);

    const map = runtime.executeSync<Map<number, number>>("{(1): 2}", []);

    assertEquals(map instanceof Map, true);
    assertEquals(map.size, 1);
    assertEquals(map.get(1), 2);
});
