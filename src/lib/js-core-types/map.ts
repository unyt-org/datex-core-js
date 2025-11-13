import { CoreTypeAddress } from "../../dif/core.ts";
import type { TypeBindingDefinition } from "../../dif/type-registry.ts";

const ORIGINAL_SET = Symbol("originalSet");
const ORIGINAL_DELETE = Symbol("originalDelete");
const ORIGINAL_CLEAR = Symbol("originalClear");

type MapWithOriginalMethods<K, V> = Map<K, V> & {
    [ORIGINAL_SET]: Map<K, V>["set"];
    [ORIGINAL_DELETE]: Map<K, V>["delete"];
    [ORIGINAL_CLEAR]: Map<K, V>["clear"];
};

export const mapTypeBinding: TypeBindingDefinition<Map<unknown, unknown>> = {
    typeAddress: CoreTypeAddress.map,
    bind(value, pointerAddress, difHandler) {
        const originalSet = value.set;
        const originalDelete = value.delete;
        const originalClear = value.clear;
        Object.defineProperties(value, {
            set: {
                value: (key: unknown, value: unknown) => {
                    difHandler.triggerSet(pointerAddress, key, value);
                    return originalSet.call(this, key, value);
                },
                configurable: true,
                writable: true,
            },
            delete: {
                value: (key: unknown) => {
                    difHandler.triggerDelete(pointerAddress, key);
                    return originalDelete.call(this, key);
                },
                configurable: true,
                writable: true,
            },
            clear: {
                value: () => {
                    difHandler.triggerClear(pointerAddress);
                    return originalClear.call(this);
                },
                configurable: true,
                writable: true,
            },
            [ORIGINAL_SET]: { value: originalSet },
            [ORIGINAL_DELETE]: { value: originalDelete },
            [ORIGINAL_CLEAR]: { value: originalClear },
        });

        return value;
    },
    handleSet(parent, key: unknown, value: unknown) {
        console.log("handleSet called with key:", key, "value:", value);
        const originalSet =
            (parent as MapWithOriginalMethods<unknown, unknown>)[ORIGINAL_SET];
        originalSet.call(parent, key, value);
    },
    handleDelete(parent, key: unknown) {
        const originalDelete =
            (parent as MapWithOriginalMethods<unknown, unknown>)[
                ORIGINAL_DELETE
            ];
        originalDelete.call(parent, key);
    },
    handleClear(parent) {
        const originalClear =
            (parent as MapWithOriginalMethods<unknown, unknown>)[
                ORIGINAL_CLEAR
            ];
        originalClear.call(parent);
    },
    handleReplace(parent, newValue: unknown) {
        // TODO
    },
};
