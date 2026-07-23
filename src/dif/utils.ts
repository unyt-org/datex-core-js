/**
 * Utility functions DIF
 */
import type { PointerAddressWithOwnership } from "../shared-container/mod.ts";
import type { Option } from "../utils/option.ts";
import type { DIFCoreLibTypeDefinition, DIFTypeDefinition } from "./types/mod.ts";
import { Endpoint, Range } from "../lib/mod.ts";
import { CoreLibTypeId } from "./core.ts";

export function getAllKeys(obj: object): Set<(string | symbol)> {
    const keys = new Set<string | symbol>();

    let currentObj: object | null = obj;
    while (currentObj && currentObj !== Object.prototype) {
        for (const key of Reflect.ownKeys(currentObj)) {
            keys.add(key);
        }
        currentObj = Object.getPrototypeOf(currentObj);
    }

    return keys;
}

export function getOwnPropertyDescriptorInPrototypeChain(
    obj: object,
    key: string | symbol,
): PropertyDescriptor | undefined {
    let currentObj: object | null = obj;
    while (currentObj && currentObj !== Object.prototype) {
        const descriptor = Object.getOwnPropertyDescriptor(currentObj, key);
        if (descriptor) {
            return descriptor;
        }
        currentObj = Object.getPrototypeOf(currentObj);
    }
    return undefined;
}

export function interceptAccessors(
    originalObject: object,
    getHandler?: ((key: string | symbol) => Option<unknown>) | null,
    setHandler?: ((key: string | symbol, value: unknown) => void) | null,
    keys: Iterable<string | symbol> = getAllKeys(originalObject),
) {
    const shadowObject = Array.isArray(originalObject) ? [] : {};

    function addPropertyInterceptor(
        originalDescriptor: PropertyDescriptor | undefined,
        key: string | symbol,
    ) {
        return {
            get() {
                if (getHandler) {
                    const result = getHandler(key);
                    if (result.isSome()) {
                        return result.unwrap();
                    }
                }
                return (shadowObject as unknown as Record<
                    string | symbol,
                    unknown
                >)[
                    key as unknown as string | symbol
                ];
            },
            set(value: unknown) {
                if (setHandler) {
                    setHandler(key, value);
                }
                (shadowObject as unknown as Record<string | symbol, unknown>)[
                    key as unknown as string | symbol
                ] = value;
            },
            enumerable: originalDescriptor?.enumerable,
            configurable: true,
        } as const;
    }
    for (const key of keys) {
        const originalDescriptor = getOwnPropertyDescriptorInPrototypeChain(
            originalObject,
            key,
        );

        // assign property directly to shadow object if non-configurable and no getter/setter
        if (
            originalDescriptor && (
                ("value" in originalDescriptor &&
                    originalDescriptor.writable) ||
                !originalDescriptor.configurable
            )
        ) {
            (shadowObject as Record<string, unknown>)[
                key as unknown as string
            ] = (originalObject as Record<string, unknown>)[
                key as unknown as string
            ];
        } // bind original getter/setter to shadow object
        else if (originalDescriptor?.get || originalDescriptor?.set) {
            Object.defineProperty(
                shadowObject,
                key,
                {
                    get: originalDescriptor.get ? originalDescriptor.get.bind(originalObject) : undefined,
                    set: originalDescriptor.set ? originalDescriptor.set.bind(originalObject) : undefined,
                    enumerable: originalDescriptor.enumerable,
                    configurable: true,
                },
            );
        }

        // only define interceptor if property is configurable
        if (!originalDescriptor || originalDescriptor.configurable) {
            Object.defineProperty(
                originalObject,
                key,
                addPropertyInterceptor(originalDescriptor, key),
            );
        }
    }
}

export function isCoreLibType(type: DIFTypeDefinition): type is DIFCoreLibTypeDefinition {
    return typeof type === "number";
}
export function isSharedContainerType(type: DIFTypeDefinition): type is { shared: PointerAddressWithOwnership } {
    return typeof type === "object" && type != null && "shared" in type;
}

/**
 * Gets the core library type id for a given JavaScript value.
 * @param value The JavaScript value to get the core library type id for.
 * @returns The core library type id corresponding to the JavaScript value.
 */
export function getCoreLibTypeIdForJSValue(value: unknown): CoreLibTypeId | null {
    if (value === null) {
        return CoreLibTypeId.null;
    } else if (typeof value === "string") {
        return CoreLibTypeId.text;
    } else if (typeof value === "boolean") {
        return CoreLibTypeId.boolean;
    } else if (typeof value === "number") {
        return CoreLibTypeId.decimal_f64;
    } else if (typeof value === "bigint") {
        return CoreLibTypeId.integer_ibig;
    } else if (value instanceof Endpoint) {
        return CoreLibTypeId.endpoint;
    } else if (value instanceof Range) {
        return CoreLibTypeId.Range;
    } else if (Array.isArray(value)) {
        return CoreLibTypeId.List;
    } else if (value instanceof Map) {
        return CoreLibTypeId.Map;
    } else if (typeof value === "object") {
        return CoreLibTypeId.Map;
    }
    return null;
}
