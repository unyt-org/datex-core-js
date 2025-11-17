import { CoreTypeAddress } from "../../dif/core.ts";
import type { DIFHandler } from "../../dif/dif-handler.ts";
import {
    ORIGINAL_VALUE,
    type TypeBindingDefinition,
} from "../../dif/type-registry.ts";

const ORIGINAL_PUSH = Symbol("ORIGINAL_PUSH");

type ArrayMetadata<V = unknown> = {
    [ORIGINAL_VALUE]: Array<V>;
    [ORIGINAL_PUSH]: Array<V>["push"];
};

export const arrayTypeBinding: TypeBindingDefinition<
    Array<unknown>,
    ArrayMetadata
> = {
    typeAddress: CoreTypeAddress.list,
    bind(parent, pointerAddress) {
        const metadata = bindArrayMethods(
            parent,
            pointerAddress,
            this.difHandler,
        );
        const difHandler = this.difHandler;
        const proxy = new Proxy(parent, {
            set(target, prop, value, receiver) {
                console.log("SET", prop, value);

                const index = Number(prop);
                if (typeof prop === "string" && !isNaN(index) && index >= 0) {
                    // check if out of bounds - fill with null&js.empty
                    if (index >= target.length) {
                        triggerArrayFillEmpty(
                            target,
                            target.length,
                            index,
                            pointerAddress,
                            difHandler,
                        );
                    }

                    difHandler.triggerSet(pointerAddress, index, value);
                } else if (prop === "length") {
                    // if length is reduced, trigger delete for removed items
                    const newLength = Number(value);
                    if (newLength < target.length) {
                        triggerArraySplice(
                            newLength,
                            target.length - newLength,
                            [],
                            pointerAddress,
                            difHandler,
                        );
                    } // if length is increased, trigger set for new empty items
                    else if (newLength > target.length) {
                        triggerArrayFillEmpty(
                            target,
                            target.length,
                            newLength,
                            pointerAddress,
                            difHandler,
                        );
                    }
                }
                // x[1..4] = js:empty
                return Reflect.set(target, prop, value, receiver);
            },
        });
        return {
            value: proxy,
            metadata,
        };
    },
    handleAppend(parent, value) {
        this.getReferenceMetadata(parent)[ORIGINAL_PUSH](value);
    },
    handleSet(parent, key: unknown, value: unknown) {
        this.getReferenceMetadata(parent)[ORIGINAL_VALUE][key as number] =
            value;
    },
    handleDelete(parent, key: number) {
        // remove key (splice)
        this.getReferenceMetadata(parent)[ORIGINAL_VALUE].splice(key, 1);
    },
    handleClear(parent) {
        this.getReferenceMetadata(parent)[ORIGINAL_VALUE].length = 0;
    },
    handleReplace(parent, newValue: unknown[]) {
        const metadata = this.getReferenceMetadata(parent);
        metadata[ORIGINAL_VALUE].length = 0;
        metadata[ORIGINAL_PUSH](...newValue);
    },
};

function bindArrayMethods(
    array: unknown[],
    pointerAddress: string,
    difHandler: DIFHandler,
): ArrayMetadata {
    const originalPush = array.push.bind(array);

    Object.defineProperty(array, "push", {
        value: (...items: unknown[]) => {
            return handleArrayPush(
                array,
                items,
                originalPush,
                pointerAddress,
                difHandler,
            );
        },
        enumerable: false,
    });

    return {
        [ORIGINAL_VALUE]: array,
        [ORIGINAL_PUSH]: originalPush,
    };
}

function handleArrayPush(
    array: unknown[],
    items: unknown[],
    originalPush: (...items: unknown[]) => number,
    pointerAddress: string,
    difHandler: DIFHandler,
) {
    for (const item of items) {
        difHandler.triggerAppend(pointerAddress, item);
        originalPush(item);
    }
    return array.length;
}

/**
 * Sends DIF updates that correspond to filling an array up to a certain index with
 * empty values.
 */
function triggerArrayFillEmpty(
    array: unknown[],
    from: number,
    to: number,
    pointerAddress: string,
    difHandler: DIFHandler,
) {
    const originalLength = array.length;
    for (let i = from; i < to; i++) {
        console.log(i, originalLength);
        if (i < originalLength) {
            difHandler.triggerSet(pointerAddress, i, null); // TODO: special js empty value
        } else {
            difHandler.triggerAppend(pointerAddress, null); // TODO: special js empty value
        }
    }
}

function triggerArraySplice(
    start: number,
    deleteCount: number,
    items: unknown[],
    pointerAddress: string,
    difHandler: DIFHandler,
) {
    for (let i = 0; i < deleteCount; i++) {
        difHandler.triggerDelete(pointerAddress, start + i);
    }
    for (let i = 0; i < items.length; i++) {
        difHandler.triggerSet(pointerAddress, start + i, items[i]);
    }
}
