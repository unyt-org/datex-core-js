import { CoreTypeAddress } from "../../dif/core.ts";
import type { TypeBindingDefinition } from "../../dif/type-registry.ts";

const ORIGINAL_SET = Symbol("originalSet");
const ORIGINAL_DELETE = Symbol("originalDelete");
const ORIGINAL_CLEAR = Symbol("originalClear");

type MapWithOriginalMethods<K = unknown, V = unknown> = Map<K, V> & {
    [ORIGINAL_SET]: Map<K, V>["set"];
    [ORIGINAL_DELETE]: Map<K, V>["delete"];
    [ORIGINAL_CLEAR]: Map<K, V>["clear"];
};

export const mapTypeBinding: TypeBindingDefinition<Map<unknown, unknown>> = {
    typeAddress: CoreTypeAddress.map,
    bind(parent, pointerAddress, difHandler) {
        const originalSet = parent.set;
        const originalDelete = parent.delete;
        const originalClear = parent.clear;
        Object.defineProperties(parent, {
            set: {
                value: (key: unknown, value: unknown) => {
                    difHandler.triggerSet(pointerAddress, key, value);
                    return originalSet.call(parent, key, value);
                },
                configurable: true,
                writable: true,
            },
            delete: {
                value: (key: unknown) => {
                    difHandler.triggerDelete(pointerAddress, key);
                    return originalDelete.call(parent, key);
                },
                configurable: true,
                writable: true,
            },
            clear: {
                value: () => {
                    difHandler.triggerClear(pointerAddress);
                    return originalClear.call(parent);
                },
                configurable: true,
                writable: true,
            },
            [ORIGINAL_SET]: { value: originalSet },
            [ORIGINAL_DELETE]: { value: originalDelete },
            [ORIGINAL_CLEAR]: { value: originalClear },
        });

        return parent;
    },
    handleSet(parent, key: unknown, value: unknown) {
        const set = (parent as MapWithOriginalMethods)[ORIGINAL_SET];
        set.call(parent, key, value);
    },
    handleDelete(parent, key: unknown) {
        const del = (parent as MapWithOriginalMethods)[ORIGINAL_DELETE];
        del.call(parent, key);
    },
    handleClear(parent) {
        const clear = (parent as MapWithOriginalMethods)[ORIGINAL_CLEAR];
        clear.call(parent);
    },
    handleReplace(parent, newValue: unknown) {
        // TODO: replace all map entries
    },
};
