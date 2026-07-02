import { assertEquals } from "@std/assert/equals";
import { Runtime } from "datex/runtime/runtime.ts";
import { arrayTypeBinding } from "datex/lib/js-core-types/array.ts";
import { Endpoint } from "datex/lib/mod.ts";
import { type PointerAddress, SharedContainerMutability } from "datex/shared-container/mod.ts";
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
            runtime.dif._handle.resolve_pointer_address(address)[0],
        ) as T;
}

function createSharedArray<T extends Array<unknown>, M extends SharedContainerMutability.Mutable>(
    array: T,
    mutability: M = SharedContainerMutability.Mutable as M,
): [SharedRef<T, M>, PointerAddress] {
    const arrayRef = runtime.createSharedValueFromJSValue<T, M>(array, null, mutability) as SharedRef<T, M>;
    const address = runtime.dif.getPointerAddressForValue(arrayRef as CachedSharedContainer)!;
    return [arrayRef, address];
}

Deno.test("array set external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayRef, address] = createSharedArray(array);
    console.log("ptr", address);

    // TODO: property updates are not yet implemented in DATEX Script
    // runtime.executeSync(`${address}.1 = 'newValue'`);
    // fake a remote update from transceiver 42
    performFakeRemoteUpdate(
        runtime,
        address,
        setEntry(
            createDIFProperty(0, DIFPropertyKind.Index),
            runtime.dif.convertJSValueToDIFValueContainer("newValue"),
        ),
    );
    // get current value of array via dif
    const runtimeCurrentValue = getCurrentRuntimeLocalValue<string[]>(address);

    // current runtime value should reflect the update
    assertEquals(runtimeCurrentValue[0], "newValue");
    // the js side value should also be updated
    assertEquals(arrayRef[0], "newValue");
});

Deno.test("array append external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayRef, address] = createSharedArray(array);

    performFakeRemoteUpdate(
        runtime,
        address,
        appendEntry(
            runtime.dif.convertJSValueToDIFValueContainer("newValueEnd"),
        ),
    );
    assertEquals(arrayRef[3], "newValueEnd");
});

Deno.test("array delete external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayRef, address] = createSharedArray(array);

    performFakeRemoteUpdate(runtime, address, deleteEntry(createDIFProperty(0, DIFPropertyKind.Index)));
    assertEquals(arrayRef, ["value2", 123]);
});

Deno.test("array clear external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayRef, address] = createSharedArray(array);

    performFakeRemoteUpdate(runtime, address, clear());

    assertEquals(arrayRef.length, 0);
});

Deno.test("array replace external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123];
    const [arrayRef, address] = createSharedArray(array);

    arrayRef.push("toBeRemoved");
    performFakeRemoteUpdate(runtime, address, replace(runtime.dif.convertJSValueToDIFValueContainer(["a", "b", "c"])));
    assertEquals(arrayRef, ["a", "b", "c"] as SharedRef<string[], SharedContainerMutability.Mutable>);
});

Deno.test("array splice external", () => {
    // create mutable ref to array
    const array = ["value1", "value2", 123, "value4"];
    const [arrayRef, address] = createSharedArray(array);

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
        arrayRef,
        ["value1", "newValueA", "newValueB", "value4"] as SharedRef<string[], SharedContainerMutability.Mutable>,
    );

    performFakeRemoteUpdate(runtime, address, listSplice(2, 2, []));
    assertEquals(arrayRef, ["value1", "newValueA"] as SharedRef<string[], SharedContainerMutability.Mutable>);
});

Deno.test("array set local", () => {
    // create mutable ref to array
    const array = ["a", "b", "c"];
    const [arrayRef, address] = createSharedArray(array);

    arrayRef[1] = "localValue";

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "a",
        "localValue",
        "c",
    ]);
});

Deno.test("array set length local", () => {
    // create mutable ref to array
    const array = ["a", "b", "c"];
    const [arrayRef, address] = createSharedArray(array);

    arrayRef.length = 5;

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
    const [arrayRef, address] = createSharedArray(array);

    arrayRef.push("localValue1", "localValue2");

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
    const [arrayRef, address] = createSharedArray([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayRef.splice(1, 2, "newValueA", "newValueB");

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "newValueA",
        "newValueB",
        "value4",
    ]);

    arrayRef.splice(2, 1);

    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "newValueA",
        "value4",
    ]);
});

Deno.test("array reverse local", () => {
    // create mutable ref to array
    const [arrayRef, address] = createSharedArray([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayRef.reverse();
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value4",
        123,
        "value2",
        "value1",
    ]);
});

Deno.test("array sort local", () => {
    // create mutable ref to array
    const [arrayRef, address] = createSharedArray([
        "banana",
        "apple",
        "cherry",
    ]);

    arrayRef.sort();
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "apple",
        "banana",
        "cherry",
    ]);
});

Deno.test("array pop local", () => {
    // create mutable ref to array
    const [arrayRef, address] = createSharedArray([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    const popped = arrayRef.pop();
    assertEquals(popped, "value4");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "value2",
        123,
    ]);
});

Deno.test("array shift local", () => {
    // create mutable ref to array
    const [arrayRef, address] = createSharedArray([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    const shifted = arrayRef.shift();
    assertEquals(shifted, "value1");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value2",
        123,
        "value4",
    ]);
});

Deno.test("array unshift local", () => {
    // create mutable ref to array
    const [arrayRef, address] = createSharedArray([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayRef.unshift("newValue1", "newValue2");
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
    const [arrayRef, address] = createSharedArray([
        "value1",
        "value2",
        123,
        "value4",
    ]);

    arrayRef.fill("filledValue", 1, 6);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "value1",
        "filledValue",
        "filledValue",
        "filledValue",
    ]);

    arrayRef.fill("allFilled");
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "allFilled",
        "allFilled",
        "allFilled",
        "allFilled",
    ]);

    arrayRef.fill("noChange", 0, 0);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "allFilled",
        "allFilled",
        "allFilled",
        "allFilled",
    ]);

    arrayRef.fill("excludeLast", 0, -1);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "excludeLast",
        "excludeLast",
        "excludeLast",
        "allFilled",
    ]);

    arrayRef.fill("excludeFirst", 1);
    assertEquals(getCurrentRuntimeLocalValue(address), [
        "excludeLast",
        "excludeFirst",
        "excludeFirst",
        "excludeFirst",
    ]);
});
