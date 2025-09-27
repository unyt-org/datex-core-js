import type { JSRuntime } from "../datex-core.ts";
import { Endpoint } from "../runtime/special-core-types.ts";
import {
    CoreTypeAddress,
    CoreTypeAddressRanges,
    type DIFArray,
    type DIFContainer,
    type DIFObject,
    type DIFPointerAddress,
    type DIFTypeContainer,
    type DIFUpdate,
    type DIFValue,
    type DIFValueContainer,
    type ReferenceMutability,
} from "./definitions.ts";
import { PointerCache } from "./pointer-cache.ts";

export class DIFHandler {
    /** The JSRuntime interface for the underlying Datex Core runtime */
    #runtime: JSRuntime;
    /** The pointer cache for storing and reusing object instances on the JS side */
    #pointerCache: PointerCache;

    /**
     * Creates a new DIFHandler instance.
     * @param runtime - The JSRuntime instance for executing Datex scripts.
     * @param pointerCache - The PointerCache instance for managing object pointers. If not provided, a new PointerCache will be created.
     */
    constructor(
        runtime: JSRuntime,
        pointerCache: PointerCache = new PointerCache(),
    ) {
        this.#runtime = runtime;
        this.#pointerCache = pointerCache;
    }

    /**
     * Executes a Datex script asynchronously and returns a Promise that resolves to a DIFContainer.
     * @param datexScript - The Datex script source code to execute.
     * @param values - An optional array of values to inject into the script.
     * @returns A Promise that resolves to the execution result as a DIFContainer.
     * @throws If an error occurs during execution.
     */
    public executeDIF(
        datexScript: string,
        values: unknown[] | null = [],
    ): Promise<DIFContainer> {
        return this.#runtime.execute(
            datexScript,
            this.convertToDIFValues(values),
        );
    }

    /**
     * Executes a Datex script synchronously and returns the result as a DIFContainer.
     * @param datexScript - The Datex script source code to execute.
     * @param values - An optional array of values to inject into the script.
     * @returns The execution result as a DIFContainer.
     * @throws If an error occurs during execution.
     */
    public executeSyncDIF(
        datexScript: string,
        values: unknown[] | null = [],
    ): DIFContainer {
        return this.#runtime.execute_sync(
            datexScript,
            this.convertToDIFValues(values),
        );
    }

    /**
     * Creates a new pointer for the specified value.
     * @param value - The DIFValue value to create a pointer for.
     * @param allowedType - The allowed type for the pointer.
     * @param mutability - The mutability of the pointer.
     * @returns A Promise that resolves to the created pointer address.
     */
    public createPointer(
        difValue: DIFValue,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): Promise<string> {
        return this.#runtime.create_pointer(
            difValue,
            allowedType,
            mutability,
        );
    }

    /**
     * Creates a new pointer for the specified value synchronously.
     * This method can only be used if the difValue only contains pointer addresses that are already loaded in memory -
     * otherwise, use the asynchronous `createPointer` method instead.
     * @param value - The DIFValue value to create a pointer for.
     * @param allowedType - The allowed type for the pointer.
     * @param mutability - The mutability of the pointer.
     * @returns The created pointer address.
     */
    public createPointerSync(
        difValue: DIFValue,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): string {
        return this.#runtime.create_pointer_sync(
            difValue,
            allowedType,
            mutability,
        );
    }

    /**
     * Creates a new pointer that points to an existing address.
     * @param address - The address to create a reference pointer for.
     * @param allowedType - The allowed type for the pointer.
     * @param mutability - The mutability of the pointer.
     * @returns A Promise that resolves to the created pointer address.
     */
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

    /**
     * Creates a new pointer that points to an existing address synchronously.
     * This method can only be used if the pointer for the address is already loaded in memory -
     * otherwise, use the asynchronous `createRefPointer` method instead.
     * @param address - The address to create a reference pointer for.
     * @param allowedType - The allowed type for the pointer.
     * @param mutability - The mutability of the pointer.
     * @returns A Promise that resolves to the created pointer address.
     */
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

    /**
     * Updates the DIF value at the specified address.
     * @param address - The address of the DIF value to update.
     * @param dif - The DIFUpdate object containing the update information.
     */
    public updateDIF(address: string, dif: DIFUpdate) {
        this.#runtime.update(address, dif);
    }

    /**
     * Registers an observer callback for changes to the DIF value at the specified address.
     * The callback will be invoked whenever the value at the address is updated.
     * @param address - The address of the DIF value to observe.
     * @param callback - The callback function to invoke on updates.
     * @returns An observer ID that can be used to unregister the observer.
     */
    public observePointer(
        address: string,
        callback: (value: DIFUpdate) => void,
    ): number {
        return this.#runtime.observe_pointer(address, callback);
    }

    /**
     * Unregisters an observer for the specified address using the observer ID.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     */
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

        // null, boolean and text types values are just returned as is
        if (
            value.type === CoreTypeAddress.boolean ||
            value.type == CoreTypeAddress.text ||
            value.type === CoreTypeAddress.null
        ) {
            return value.value as T;
        } // small integers are interpreted as JS numbers
        else if (
            typeof value.type === "string" && (
                value.type == CoreTypeAddress.integer ||
                this.isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.small_signed_integers,
                ) ||
                this.isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.small_unsigned_integers,
                )
            )
        ) {
            return Number(value.value as number) as T;
        } // big integers are interpreted as JS BigInt
        else if (
            typeof value.type === "string" && (
                this.isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.big_signed_integers,
                ) ||
                this.isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.big_unsigned_integers,
                )
            )
        ) {
            return BigInt(value.value as number) as T;
        } // decimal types are interpreted as JS numbers
        else if (
            typeof value.type === "string" &&
            this.isPointerAddressInRange(
                value.type,
                CoreTypeAddressRanges.decimals,
            )
        ) {
            return (Number(value.value) as number) as T;
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
            for (const [key, val] of Object.entries(value.value as DIFObject)) {
                resolvedObj[key] = this.resolveDIFValueContainer(val);
            }
            return this.promiseFromObjectOrSync(resolvedObj) as T | Promise<T>;
        } else {
            // custom types not implemented yet
            throw new Error("Custom type resolution not implemented yet");
        }
    }

    /**
     * Converts an array of Promises or resolved values to either a Promise of an array of resolved values,
     * or an array of resolved values if all values are already resolved.
     */
    promiseAllOrSync<T>(values: (T | Promise<T>)[]): Promise<T[]> | T[] {
        if (values.some((v) => v instanceof Promise)) {
            return Promise.all(values);
        } else {
            return values as T[];
        }
    }

    /**
     * Converts an object with values that may be Promises to either a Promise of an object with resolved values,
     * or an object with resolved values if all values are already resolved.
     */
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

    /**
     * Resolves a DIFValueContainer (either a DIFValue or a pointer address) to its corresponding JS value.
     * If the container contains pointers that are not yet loaded in memory, it returns a Promise that resolves to the value.
     * Otherwise, it returns the resolved value directly.
     * @param value - The DIFValueContainer to resolve.
     * @returns The resolved value as type T, or a Promise that resolves to type T.
     */
    public resolveDIFValueContainer<T extends unknown>(
        value: DIFValueContainer,
    ): T | Promise<T> {
        if (typeof value !== "string") {
            return this.resolveDIFValue(value);
        } else {
            return this.resolvePointerAddress(value);
        }
    }

    /**
     * Synchronous version of resolveDIFValueContainer.
     * This method can only be used if the value only contains pointer addresses that are already loaded in memory -
     * otherwise, use the asynchronous `resolveDIFValueContainer` method instead.
     * @param value - The DIFValueContainer to resolve.
     * @returns The resolved value as type T.
     * @throws If the resolution would require asynchronous operations.
     */
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

    /**
     * Resolves a pointer address to its corresponding JS value.
     * If the pointer address is not yet loaded in memory, it returns a Promise that resolves to the value.
     * Otherwise, it returns the resolved value directly.
     * @param address - The pointer address to resolve.
     * @returns The resolved value as type T, or a Promise that resolves to type T.
     */
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
            const map: Record<string, DIFValue> = {};
            for (const [key, val] of Object.entries(value)) {
                map[key] = this.convertToDIFValue(val);
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

    /**
     * Returns true if the given address is within the specified address range.
     */
    protected isPointerAddressInRange(
        address: DIFPointerAddress,
        range: readonly [number, number],
    ): boolean {
        const addressNum = parseInt(address, 16);
        return addressNum >= range[0] && addressNum < range[1];
    }
}
