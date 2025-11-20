import { CoreTypeAddress } from "../../dif/core.ts";
import type { TypeBindingDefinition } from "../../dif/type-registry.ts";

const ORIGINAL_SET = Symbol("ORIGINAL_SET");
const ORIGINAL_DELETE = Symbol("ORIGINAL_DELETE");
const ORIGINAL_CLEAR = Symbol("ORIGINAL_CLEAR");

type MapMetadata<K = unknown, V = unknown> = {
    [ORIGINAL_SET]: Map<K, V>["set"];
    [ORIGINAL_DELETE]: Map<K, V>["delete"];
    [ORIGINAL_CLEAR]: Map<K, V>["clear"];
};

export const mapTypeBinding: TypeBindingDefinition<
    Map<unknown, unknown>,
    MapMetadata
> = {
    typeAddress: CoreTypeAddress.map,
    bind(value, pointerAddress) {
        const originalSet = value.set.bind(value);
        const originalDelete = value.delete.bind(value);
        const originalClear = value.clear.bind(value);
        Object.defineProperties(value, {
            set: {
                value: (key: unknown, value: unknown) => {
                    this.difHandler.triggerSet(pointerAddress, key, value);
                    return originalSet.call(value, key, value);
                },
                configurable: true,
                writable: true,
            },
            delete: {
                value: (key: unknown) => {
                    this.difHandler.triggerDelete(pointerAddress, key);
                    return originalDelete.call(value, key);
                },
                configurable: true,
                writable: true,
            },
            clear: {
                value: () => {
                    this.difHandler.triggerClear(pointerAddress);
                    return originalClear.call(value);
                },
                configurable: true,
                writable: true,
            },
        });

        return {
            value,
            metadata: {
                [ORIGINAL_SET]: originalSet,
                [ORIGINAL_DELETE]: originalDelete,
                [ORIGINAL_CLEAR]: originalClear,
            },
        };
    },
    handleSet(target, key: unknown, value: unknown) {
        const set = this.getCustomReferenceMetadata(target)[ORIGINAL_SET];
        set.call(target, key, value);
    },
    handleDelete(target, key: unknown) {
        const del = this.getCustomReferenceMetadata(target)[ORIGINAL_DELETE];
        del.call(target, key);
    },
    handleClear(target) {
        const clear = this.getCustomReferenceMetadata(target)[ORIGINAL_CLEAR];
        clear.call(target);
    },
    handleReplace(target, newValue: unknown) {
        const metadata = this.getCustomReferenceMetadata(target);
        metadata[ORIGINAL_CLEAR].call(target);
        for (
            const [key, value] of (newValue as Map<unknown, unknown>).entries()
        ) {
            metadata[ORIGINAL_SET].call(
                target,
                key,
                value,
            );
        }
    },
};
