import { JSRuntime } from "../datex-core.ts";
import { Endpoint } from "../runtime/special-core-types.ts";
import {
    CoreTypeAddress,
    CoreTypeAddressRanges,
    type DIFArray,
    type DIFContainer,
    type DIFObject,
    type DIFPointerAddress,
    type DIFType,
    type DIFTypeContainer,
    type DIFUpdate,
    type DIFValue,
    type DIFValueContainer,
    type ReferenceMutability,
} from "./definitions.ts";

export class DIFHandler {
    #runtime: JSRuntime;
    constructor(
        runtime: JSRuntime,
    ) {
        this.#runtime = runtime;
    }

    public executeDIF(
        datexScript: string,
        values: unknown[] | null = [],
    ): Promise<DIFContainer> {
        return this.#runtime.execute(
            datexScript,
            this.convertToDIFValues(values),
        );
    }

    public executeSyncDIF(
        datexScript: string,
        values: unknown[] | null = [],
    ): DIFContainer {
        return this.#runtime.execute_sync(
            datexScript,
            this.convertToDIFValues(values),
        );
    }

    public createPointer(
        value: unknown,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): Promise<string> {
        const difValue = this.convertToDIFValue(value);
        return this.#runtime.create_pointer(
            difValue,
            allowedType,
            mutability,
        );
    }

    public createPointerSync(
        value: unknown,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): string {
        const difValue = this.convertToDIFValue(value);
        return this.#runtime.create_pointer_sync(
            difValue,
            allowedType,
            mutability,
        );
    }

    public createRefPointer(
        address: string,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): Promise<string> {
        return this.#runtime.create_pointer(
            address,
            allowedType,
            mutability,
        );
    }
    public createRefPointerSync(
        address: string,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): string {
        return this.#runtime.create_pointer_sync(
            address,
            allowedType,
            mutability,
        );
    }

    public updateDIF(address: string, dif: DIFUpdate) {
        this.#runtime.update(address, dif);
    }

    public observePointer(
        address: string,
        callback: (value: DIFUpdate) => void,
    ): number {
        return this.#runtime.observe_pointer(address, callback);
    }

    public unobservePointer(address: string, observerId: number) {
        this.#runtime.unobserve_pointer(address, observerId);
    }

    /**
     * Resolves a DIFValue to its corresponding JS value.
     * This function handles core types and custom types (not yet implemented).
     * It returns the resolved value as the specified type T.
     * @param value
     */
    public resolveDIFValue<T extends unknown>(
        value: DIFValue,
    ): T | Promise<T> {
        if (value.type === undefined) {
            return value.value as T;
        }

        // boolean and text types values are just returned as is
        if (
            value.type === CoreTypeAddress.boolean ||
            value.type == CoreTypeAddress.text
        ) {
            return value.value as T;
        } // small integers are interpreted as JS numbers
        else if (
            typeof value.type === "string" && (
                value.type == CoreTypeAddress.integer ||
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.small_signed_integers,
                ) ||
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.small_unsigned_integers,
                )
            )
        ) {
            return Number(value.value as number) as T;
        } // big integers are interpreted as JS BigInt
        else if (
            typeof value.type === "string" && (
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.big_signed_integers,
                ) ||
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.big_unsigned_integers,
                )
            )
        ) {
            return BigInt(value.value as number) as T;
        } // decimal types are interpreted as JS numbers
        else if (
            typeof value.type === "string" &&
            isPointerAddressInRange(value.type, CoreTypeAddressRanges.decimals)
        ) {
            return (Number(value.value) as number) as T;
        } // TODO: wasm_bindgen returns undefined here, although it should be null. So we just return null for now.
        else if (value.type === CoreTypeAddress.null) {
            return null as T;
        } // endpoint types are resolved to Endpoint instances
        else if (value.type === CoreTypeAddress.endpoint) {
            return Endpoint.get(value.value as string) as T;
        } // array types are resolved to arrays of DIFValues
        else if (value.type === CoreTypeAddress.array) {
            return this.promiseAllOrSync(
                (value.value as DIFArray).map((v) =>
                    this.resolveDIFValueContainer(v)
                ),
            ) as T | Promise<T>;
        } else if (value.type === CoreTypeAddress.list) {
            return this.promiseAllOrSync(
                (value.value as DIFArray).map((v) =>
                    this.resolveDIFValueContainer(v)
                ),
            ) as T | Promise<T>;
        } // object types are resolved to objects with string keys and DIFValues
        else if (value.type === CoreTypeAddress.struct) {
            const resolvedObj: { [key: string]: unknown } = {};
            for (const [key, val] of (value.value as DIFObject).entries()) {
                resolvedObj[key] = this.resolveDIFValueContainer(val);
            }
            return this.promiseFromObjectOrSync(resolvedObj) as T | Promise<T>;
        } else {
            // custom types not implemented yet
            throw new Error("Custom type resolution not implemented yet");
        }
    }

    promiseAllOrSync<T>(values: (T | Promise<T>)[]): Promise<T[]> | T[] {
        if (values.some((v) => v instanceof Promise)) {
            return Promise.all(values);
        } else {
            return values as T[];
        }
    }

    public promiseFromObjectOrSync<T>(
        values: { [key: string]: T | Promise<T> },
    ): Promise<{ [key: string]: T }> | { [key: string]: T } {
        const valueArray = Object.values(values);
        if (valueArray.some((v) => v instanceof Promise)) {
            return Promise.all(valueArray).then((resolvedValues) => {
                const resolvedObj: { [key: string]: T } = {};
                let i = 0;
                for (const key of Object.keys(values)) {
                    resolvedObj[key] = resolvedValues[i++];
                }
                return resolvedObj;
            });
        } else {
            return values as { [key: string]: T };
        }
    }

    public resolveDIFValueContainer<T extends unknown>(
        value: DIFValueContainer,
    ): T | Promise<T> {
        if (typeof value !== "string") {
            return this.resolveDIFValue(value);
        } else {
            return this.resolvePointerAddress(value);
        }
    }
    public resolveDIFValueContainerSync<T extends unknown>(
        value: DIFValueContainer,
    ): T {
        const result = this.resolveDIFValueContainer(value);
        if (result instanceof Promise) {
            throw new Error(
                "resolveDIFValueContainerSync cannot return a Promise. Use resolveDIFValueContainer() instead.",
            );
        }
        return result as T;
    }

    public resolvePointerAddress<T extends unknown>(
        address: string,
    ): Promise<T> | T {
        const entry = this.#runtime.resolve_pointer_address(address);
        if (entry instanceof Promise) {
            return entry.then((e) => this.resolveDIFValueContainer(e) as T);
        }
        return this.resolveDIFValueContainer(
            entry,
        );
    }

    /**
     * Converts a given JS value to its DIFValue representation.
     */
    public convertToDIFValue<T extends unknown>(
        value: T,
    ): DIFValue {
        // assuming core values
        // TODO: handle custom types
        if (value === null) {
            return {
                type: CoreTypeAddress.null,
                value: null,
            };
        } else if (typeof value === "boolean") {
            return {
                type: CoreTypeAddress.boolean,
                value,
            };
        } else if (typeof value === "number") {
            return {
                type: CoreTypeAddress.decimal_f64,
                value,
            };
        } else if (typeof value === "bigint") {
            return {
                type: CoreTypeAddress.integer_big,
                value: value.toString(), // convert bigint to string for DIFValue
            };
        } else if (typeof value === "string") {
            return {
                value,
            };
        } else if (value instanceof Endpoint) {
            return {
                type: CoreTypeAddress.endpoint,
                value: value.toString(),
            };
        } else if (Array.isArray(value)) {
            return {
                type: CoreTypeAddress.array,
                value: value.map((v) => this.convertToDIFValue(v)),
            };
        } else if (typeof value === "object") {
            const map = new Map<string, DIFValue>();
            for (const [key, val] of Object.entries(value)) {
                map.set(key, this.convertToDIFValue(val));
            }
            return {
                type: CoreTypeAddress.struct,
                value: map,
            };
        }
        throw new Error("Unsupported type for conversion to DIFValue");
    }

    /**
     * Converts an array of JS values to an array of DIFValues.
     * If the input is null, it returns null.
     * @param values
     */
    public convertToDIFValues<T extends unknown[]>(
        values: T | null,
    ): DIFValue[] | null {
        return values?.map((value) => this.convertToDIFValue(value)) || null;
    }
}

/**
 * Returns true if the given address is within the specified address range.
 */
function isPointerAddressInRange(
    address: DIFPointerAddress,
    range: readonly [number, number],
): boolean {
    const addressNum = parseInt(address, 16);
    return addressNum >= range[0] && addressNum < range[1];
}
