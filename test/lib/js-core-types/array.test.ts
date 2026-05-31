import { assertEquals } from "@std/assert/equals";
import { Runtime } from "datex/runtime/runtime.ts";
import { arrayTypeBinding } from "datex/lib/js-core-types/array.ts";
import { Endpoint } from "datex/lib/mod.ts";
import type { DIFUpdateKind } from "datex/dif/types/mod.ts";
import { type AsShared, type PointerAddress, SharedContainerMutability } from "datex/shared-container/mod.ts";
import type { CachedSharedContainer } from "datex/dif/dif-handler.ts";
import type { SharedRef } from "datex/shared-container/mod.ts";
import { performFakeRemoteUpdate } from "../utils.ts";
import {
    appendEntry,
    clear,
    createDIFProperty,
    deleteEntry,
    DIFPropertyKind,
    listSplice,
    replace,
    setEntry,
} from "datex/dif/update.ts";

const runtime = await Runtime.create({ endpoint: Endpoint.get("@test") });
runtime.dif.type_registry.registerTypeBinding(arrayTypeBinding);

function getCurrentRuntimeLocalValue<T>(address: string) {
    return runtime.dif
        .resolveDIFValueContainer(
            runtime.dif._handle.resolve_pointer_address(address).value,
        ) as T;
}

function createArrayReference<T extends Array<unknown>, M extends SharedContainerMutability.Mutable>(
    array: T,
    mutability: M = SharedContainerMutability.Mutable as M,
): [SharedRef<T, M>, PointerAddress] {
    const arrayPtr = runtime.createSharedValueFromJSValue<T, M>(array, null, mutability) as SharedRef<T, M>;
    const address = runtime.dif.getPointerAddressForValue(arrayPtr as CachedSharedContainer)!;
    return [arrayPtr, address];
}

Deno.test("array set external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    // TODO: property updates are not yet implemented in DATEX Script
    // runtime.executeSync(`${mapPtr}.test = 'newValue'`);
    // fake a remote update from transceiver 42
    performFakeRemoteUpdate(
        runtime,
        address,
        setEntry(
            createDIFProperty(0, DIFPropertyKind.Index),
            runtime.dif.convertJSValueToDIFValueContainer("newValue"),
        ),
    );
    assertEquals(arrayPtr[0], "newValue");
});

Deno.test("array append external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    performFakeRemoteUpdate(
        runtime,
        address,
        appendEntry(
            runtime.dif.convertJSValueToDIFValueContainer("newValueEnd"),
        ),
    );
    assertEquals(arrayPtr[3], "newValueEnd");
});

Deno.test("array delete external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    performFakeRemoteUpdate(runtime, address, deleteEntry(createDIFProperty(0, DIFPropertyKind.Index)));
    assertEquals(arrayPtr, ["value2", 123]);
});

Deno.test("array clear external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    performFakeRemoteUpdate(runtime, address, clear());

    assertEquals(arrayPtr.length, 0);
});

Deno.test("array replace external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayPtr, address] = createArrayReference(array);

    arrayPtr.push("toBeRemoved");
    performFakeRemoteUpdate(runtime, address, replace(runtime.dif.convertJSValueToDIFValueContainer(["a", "b", "c"])));
    assertEquals(arrayPtr, ["a", "b", "c"] as SharedRef<string[], SharedContainerMutability.Mutable>);
});

Deno.test("array splice external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123, "value4"];
    const [arrayPtr, address] = createArrayReference(array);

    performFakeRemoteUpdate(
        runtime,
        address,
        listSplice(
            1,
            2,
            [
                runtime.dif.convertJSValueToDIFValueContainer("newValueA"),
                runtime.dif.convertJSValueToDIFValueContainer("newValueB"),
            ],
        ),
    );

    assertEquals(
        arrayPtr,
        ["value1", "newValueA", "newValueB", "value4"] as SharedRef<string[], SharedContainerMutability.Mutable>,
    );

    performFakeRemoteUpdate(runtime, address, listSplice(2, 2, []));
    assertEquals(arrayPtr, ["value1", "newValueA"] as SharedRef<string[], SharedContainerMutability.Mutable>);
});

Deno.test("array set local", () => {
    // create mutable ref to array
    const array = ["a", "b", "c"];
    const [arrayPtr, address] = createArrayReference(array);

    arrayPtr[1] = "localValue";

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "a",
        "localValue",
        "c",
    ]);
});

Deno.test("array set length local", () => {
    // create mutable ref to array
    const array = ["a", "b", "c"];
    const [arrayPtr, address] = createArrayReference(array);

    arrayPtr.length = 5;

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "a",
        "b",
        "c",
        null,
        null,
    ]);
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

Deno.test("array splice local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayPtr.splice(1, 2, "newValueA", "newValueB");

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "newValueA",
        "newValueB",
        "value4",
    ]);

    arrayPtr.splice(2, 1);

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "newValueA",
        "value4",
    ]);
});

Deno.test("array reverse local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayPtr.reverse();
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value4",
        123,
        "value2",
        "value1",
    ]);
});

Deno.test("array sort local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "banana",
        "apple",
        "cherry",
    ]);

    arrayPtr.sort();
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "apple",
        "banana",
        "cherry",
    ]);
});

Deno.test("array pop local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    const popped = arrayPtr.pop();
    assertEquals(popped, "value4");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "value2",
        123,
    ]);
});

Deno.test("array shift local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    const shifted = arrayPtr.shift();
    assertEquals(shifted, "value1");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value2",
        123,
        "value4",
    ]);
});

Deno.test("array unshift local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayPtr.unshift("newValue1", "newValue2");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "newValue1",
        "newValue2",
        "value1",
        "value2",
        123,
        "value4",
    ]);
});

Deno.test("array fill local", () => {
    // create mutable ref to array
    const [arrayPtr, address] = createArrayReference([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayPtr.fill("filledValue", 1, 6);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "filledValue",
        "filledValue",
        "filledValue",
    ]);

    arrayPtr.fill("allFilled");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "allFilled",
        "allFilled",
        "allFilled",
        "allFilled",
    ]);

    arrayPtr.fill("noChange", 0, 0);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "allFilled",
        "allFilled",
        "allFilled",
        "allFilled",
    ]);

    arrayPtr.fill("excludeLast", 0, -1);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "excludeLast",
        "excludeLast",
        "excludeLast",
        "allFilled",
    ]);

    arrayPtr.fill("excludeFirst", 1);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "excludeLast",
        "excludeFirst",
        "excludeFirst",
        "excludeFirst",
    ]);
});
