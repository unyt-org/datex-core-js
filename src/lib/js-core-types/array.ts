import { CoreTypeAddress } from "../../dif/core.ts";
import {
    type DIFHandler,
    IS_PROXY_ACCESS,
    type ReferenceMetadata,
} from "../../dif/dif-handler.ts";
import type { TypeBindingDefinition } from "../../dif/type-registry.ts";
import { DEBUG_MODE } from "../../global.ts";

const ORIGINAL_PUSH = Symbol("ORIGINAL_PUSH");

type ArrayMetadata<V = unknown> = {
    [ORIGINAL_PUSH]: Array<V>["push"];
} & ReferenceMetadata;

export const arrayTypeBinding: TypeBindingDefinition<
    Array<unknown>,
    ArrayMetadata
> = {
    typeAddress: CoreTypeAddress.list,
    bind(target, pointerAddress) {
        const metadata = bindArrayMethods(
            target,
            pointerAddress,
            this.difHandler,
        );
        if (DEBUG_MODE) {
            invalidateOriginalValue(target, metadata);
        }
        // deno-lint-ignore no-this-alias
        const self = this;
        const proxy = new Proxy(target, {
            set(target, prop, value, receiver) {
                return self.allowOriginalValueAccess(target, () => {
                    const index = Number(prop);
                    if (
                        typeof prop === "string" && !isNaN(index) && index >= 0
                    ) {
                        // check if out of bounds - fill with null&js.empty
                        if (index >= target.length) {
                            triggerArrayFillEmpty(
                                target,
                                target.length,
                                index,
                                pointerAddress,
                                self.difHandler,
                            );
                        }

                        self.difHandler.triggerSet(
                            pointerAddress,
                            index,
                            value,
                        );
                    } else if (prop === "length") {
                        // if length is reduced, trigger delete for removed items
                        const newLength = Number(value);
                        if (newLength < target.length) {
                            triggerArraySplice(
                                newLength,
                                target.length - newLength,
                                [],
                                pointerAddress,
                                self.difHandler,
                            );
                        } // if length is increased, trigger set for new empty items
                        else if (newLength > target.length) {
                            triggerArrayFillEmpty(
                                target,
                                target.length,
                                newLength,
                                pointerAddress,
                                self.difHandler,
                            );
                        }
                    }
                    // x[1..4] = js:empty
                    return Reflect.set(target, prop, value, receiver);
                });
            },
        });
        return {
            value: proxy,
            metadata,
        };
    },
    handleAppend(target, value) {
        this.getReferenceMetadata(target)[ORIGINAL_PUSH](value);
    },
    handleSet(target, key: unknown, value: unknown) {
        this.difHandler.getOriginalValueFromProxy(target)![key as number] =
            value;
    },
    handleDelete(target, key: number) {
        // remove key (splice)
        this.difHandler.getOriginalValueFromProxy(target)!.splice(key, 1);
    },
    handleClear(target) {
        this.difHandler.getOriginalValueFromProxy(target)!.length = 0;
    },
    handleReplace(target, newValue: unknown[]) {
        this.difHandler.getOriginalValueFromProxy(target)!.length = 0;
        this.getReferenceMetadata(target)[ORIGINAL_PUSH](...newValue);
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
        configurable: true,
    });

    return {
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

function invalidateOriginalValue(array: unknown[], metadata: ArrayMetadata) {
    const shadowArray = [...array];
    array.length = 0;

    function getLockedPointerDefinition(
        originalDescriptor: PropertyDescriptor | undefined,
        key: string | symbol,
    ) {
        return {
            get() {
                if (!metadata[IS_PROXY_ACCESS]) {
                    throw new Error(
                        "Invalid access to original array value that was moved to a reference",
                    );
                }
                return shadowArray[key as keyof typeof array];
            },
            set(value: unknown) {
                if (!metadata[IS_PROXY_ACCESS]) {
                    throw new Error(
                        "Invalid access to original array value that was moved to a reference",
                    );
                }
                shadowArray[key as unknown as number] = value;
            },
            enumerable: originalDescriptor?.enumerable,
            configurable: false,
        } as const;
    }
    for (const key of Reflect.ownKeys(array)) {
        if (key == "length") {
            continue;
        }
        console.log("ownkey", key);
        const originalDescriptor = Object.getOwnPropertyDescriptor(array, key);
        Object.defineProperty(
            array,
            key,
            getLockedPointerDefinition(originalDescriptor, key),
        );
    }
    for (const key of Reflect.ownKeys(Object.getPrototypeOf(array))) {
        if (key == "length" || key == "constructor") {
            continue;
        }
        // array[key as keyof typeof array] = function () {
        // Object.defineProperty(
        //     array,
        //     key,
        //     getLockedPointerDefinition(originalDescriptor, key),
        // );
    }

    Object.seal(array);
}
