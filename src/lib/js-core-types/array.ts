import { CoreTypeAddress } from "../../dif/core.ts";
import {
    type DIFHandler,
    IS_PROXY_ACCESS,
    type ReferenceMetadata,
} from "../../dif/dif-handler.ts";
import type { TypeBindingDefinition } from "../../dif/type-registry.ts";
import { interceptAccessors } from "../../dif/utils.ts";
import { DEBUG_MODE } from "../../global.ts";
import { Option } from "../../utils/option.ts";

type ArrayMethods<V> = {
    push: Array<V>["push"];
};

export const arrayTypeBinding: TypeBindingDefinition<Array<unknown>> = {
    typeAddress: CoreTypeAddress.list,
    bind(target, pointerAddress) {
        const metadata: ReferenceMetadata = {};
        const arrayMethods = getArrayMethods(
            target,
            pointerAddress,
            this.difHandler,
        );
        if (DEBUG_MODE) {
            interceptAccessors(
                target,
                () => {
                    if (!metadata[IS_PROXY_ACCESS]) {
                        throw new Error(
                            "Invalid access to original array value that was moved to a reference",
                        );
                    }
                    return Option.None();
                },
                () => {
                    if (!metadata[IS_PROXY_ACCESS]) {
                        throw new Error(
                            "Invalid access to original array value that was moved to a reference",
                        );
                    }
                },
            );
        }
        // deno-lint-ignore no-this-alias
        const self = this;
        const proxy: unknown[] = new Proxy(target, {
            get(_target, key) {
                return self.allowOriginalValueAccess(proxy, () => {
                    return arrayMethods[key as keyof ArrayMethods<unknown>] ??
                        Reflect.get(target, key);
                });
            },
            set(_target, prop, value, receiver) {
                return self.allowOriginalValueAccess(proxy, () => {
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

                        self.difHandler.triggerIndexSet(
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
        target.push(value);
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
        target.push(...newValue);
    },
};

function getArrayMethods<V>(
    array: V[],
    pointerAddress: string,
    difHandler: DIFHandler,
): ArrayMethods<V> {
    const originalPush = array.push.bind(array);

    return {
        push: generateInterceptedArrayPush(
            array,
            originalPush,
            pointerAddress,
            difHandler,
        ),
    };
}

function generateInterceptedArrayPush<V>(
    array: V[],
    originalPush: (...items: V[]) => number,
    pointerAddress: string,
    difHandler: DIFHandler,
) {
    return (...items: V[]) => {
        for (const item of items) {
            difHandler.triggerAppend(pointerAddress, item);
            originalPush(item);
        }
        return array.length;
    };
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
