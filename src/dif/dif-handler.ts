import type { JSRuntime, RuntimeDIFHandle } from "../datex-core.ts";
import { Ref } from "../refs/ref.ts";
import { Endpoint } from "../runtime/special-core-types.ts";
import {
    CoreTypeAddress,
    CoreTypeAddressRanges,
    type DIFArray,
    type DIFContainer,
    type DIFMap,
    type DIFObject,
    type DIFPointerAddress,
    DIFReferenceMutability,
    type DIFType,
    type DIFTypeContainer,
    type DIFUpdate,
    type DIFValue,
    type DIFValueContainer,
    ReferenceMutability,
} from "./definitions.ts";

export class DIFHandler {
    /** The JSRuntime interface for the underlying Datex Core runtime */
    #runtime: JSRuntime;
    #handle: RuntimeDIFHandle;
    /** The pointer cache for storing and reusing object instances on the JS side
     * If the pointer is a final ref, it is not being observed and 'final' is set to true
     */
    readonly #cache = new Map<
        string,
        { val: WeakRef<WeakKey>; final: boolean }
    >();

    readonly #observers = new Map<
        string,
        Map<number, (value: DIFUpdate) => void>
    >();

    get _observers() {
        return this.#observers;
    }

    /**
     * Creates a new DIFHandler instance.
     * @param runtime - The JSRuntime instance for executing Datex scripts.
     * @param pointerCache - The PointerCache instance for managing object pointers. If not provided, a new PointerCache will be created.
     */
    constructor(
        runtime: JSRuntime,
    ) {
        this.#runtime = runtime;
        this.#handle = runtime.dif();
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
     * @param difValue - The DIFValue value to create a pointer for.
     * @param allowedType - The allowed type for the pointer.
     * @param mutability - The mutability of the pointer.
     * @returns The created pointer address.
     */
    public createPointer(
        difValue: DIFValue,
        allowedType: DIFTypeContainer | null = null,
        mutability: ReferenceMutability,
    ): string {
        return this.#handle.create_pointer(
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
    ): string {
        return this.#handle.create_pointer(
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
    public updatePointer(address: string, dif: DIFUpdate) {
        console.log("Updating pointer", address, dif);
        this.#handle.update(address, dif);
    }

    /**
     * Registers an observer callback for changes to the DIF value at the specified address
     * directly on the DATEX core runtime.
     * This method should only be used internally, since it comes with additional overhead.
     * For normal use cases, use the observePointer method instead.
     * The callback will be invoked whenever the value at the address is updated.
     * @param address - The address of the DIF value to observe.
     * @param callback - The callback function to invoke on updates.
     * @returns An observer ID that can be used to unregister the observer.
     * @throws If the pointer is final.
     */
    public observePointerBindDirect(
        address: string,
        callback: (value: DIFUpdate) => void,
    ): number {
        return this.#runtime.dif().observe_pointer(address, callback);
    }

    /**
     * Unregisters an observer that was registered directly on the DATEX core runtime
     * with the observePointerBindDirect method.
     * For internal use only.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     */
    public unobservePointerBindDirect(address: string, observerId: number) {
        this.#runtime.dif().unobserve_pointer(address, observerId);
    }

    /**
     * Registers a local observer callback for changes to the DIF value at the specified address.
     * The callback will be invoked whenever the value at the address is updated.
     * In contrast to observePointerBindDirect, this method does not register the observer
     * directly on the DATEX core runtime, but keeps it local in the JS side, which prevents
     * unnecessary overhead from additional cross-language calls.
     * @param address - The address of the DIF value to observe.
     * @param callback - The callback function to invoke on updates.
     * @returns An observer ID that can be used to unregister the observer.
     * @throws If the pointer is final.
     */
    public observePointer(
        address: string,
        callback: (value: DIFUpdate) => void,
    ): number {
        let cached = this.#cache.get(address);
        if (!cached) {
            // first resolve the pointer to make sure it's loaded in the cache
            this.resolvePointerAddressSync(address);
            cached = this.#cache.get(address)!;
        }

        // make sure the pointer is not final
        if (cached.final) {
            throw new Error(`Cannot final reference $${address}`);
        }

        // directly add to observers map
        let observers = this.#observers.get(address);
        if (!observers) {
            observers = new Map();
            this.#observers.set(address, observers);
        }
        const observerId = observers.size + 1;
        observers.set(observerId, callback);
        return observerId;
    }

    /**
     * Unregisters an observer that was registered with the observePointer method.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     * @returns True if the observer was successfully unregistered, false otherwise.
     */
    public unobservePointer(address: string, observerId: number): boolean {
        const observers = this.#observers.get(address);
        if (observers) {
            observers.delete(observerId);
            if (observers.size === 0) {
                return this.#observers.delete(address);
            }
        }
        return false;
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
        console.log("resolve DIF Value", value);

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
        } // struct types are resolved from a DIFObject (aka JS Map) to a JS object
        else if (value.type === CoreTypeAddress.struct) {
            const resolvedObj: { [key: string]: unknown } = {};
            for (const [key, val] of value.value as DIFObject) {
                resolvedObj[key] = this.resolveDIFValueContainer(val);
            }
            return this.promiseFromObjectOrSync(resolvedObj) as T | Promise<T>;
        } // map types are resolved from a DIFObject (aka JS Map) or Array of key-value pairs to a JS object
        else if (value.type === CoreTypeAddress.map) {
            const resolvedObj: { [key: string]: unknown } = {};
            for (const [key, val] of value.value as (DIFObject | DIFMap)) {
                // TODO: currently always converting to an object here, but this should be a Map per default
                resolvedObj[key as string] = this.resolveDIFValueContainer(val);
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
     * Maps a value or Promise of a value to another value or Promise of a value using the provided onfulfilled function.
     */
    public mapPromise<T, N>(
        value: T | Promise<T>,
        onfulfilled: (value: T) => N,
    ): N | Promise<N> {
        if (value instanceof Promise) {
            return value.then(onfulfilled);
        } else {
            return onfulfilled(value);
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
        // check cache first
        const cached = this.getCachedPointer(address);
        if (cached) {
            return cached as T;
        }
        // if not in cache, resolve from runtime
        const entry: DIFValueContainer | Promise<DIFValueContainer> = this
            .#handle.resolve_pointer_address(address);
        return this.mapPromise(entry, (e) => {
            const value: T | Promise<T> = this.resolveDIFValueContainer(e);
            return this.mapPromise(value, (v) => {
                // init pointer
                // get mutablity from DIFValue. TODO: this does not work for all cases.
                const mutability = ((e as DIFValue).type as DIFType)?.mut ||
                    DIFReferenceMutability.Mutable;
                this.initPointer(address, v, mutability);
                return v;
            });
        }) as Promise<T> | T;
    }

    /**
     * Resolves a pointer address to its corresponding JS value synchronously.
     * If the pointer address is not yet loaded in memory, it returns a Promise that resolves to the value.
     * Otherwise, it returns the resolved value directly.
     * @param address - The pointer address to resolve.
     * @returns The resolved value as type T, or a Promise that resolves to type T.
     * @throws If the resolution would require asynchronous operations.
     */
    public resolvePointerAddressSync<T extends unknown>(
        address: string,
    ): T {
        // check cache first
        const cached = this.getCachedPointer(address);
        if (cached) {
            return cached as T;
        }
        // if not in cache, resolve from runtime
        const entry: DIFValueContainer = this.#handle
            .resolve_pointer_address_sync(address);
        const value: T = this.resolveDIFValueContainerSync(
            entry,
        );
        // init pointer
        const mutability = ((entry as DIFValue).type as DIFType)?.mut ||
            DIFReferenceMutability.Mutable;
        this.initPointer(address, value, mutability);
        return value;
    }

    /**
     * Converts an array of JS values to an array of DIFValues.
     * If the input is null, it returns null.
     * @param values
     */
    public convertToDIFValues<T extends unknown[]>(
        values: T | null,
    ): DIFValue[] | null {
        return values?.map((value) => this.convertJSValueToDIFValue(value)) ||
            null;
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

    /**
     * Initializes a pointer with the given value and mutability, by
     * adding a proxy wrapper if necessary, and setting up observation and caching on the JS side.
     */
    protected initPointer<T>(
        ptrAddress: string,
        value: T,
        mutability: ReferenceMutability,
    ): T | Ref<T> {
        const refValue = this.wrapJSValueInProxy(value, ptrAddress);

        // if not final, observe  to keep the pointer 'live' and receive updates
        let observerId: number | null = null;
        if (mutability !== ReferenceMutability.Final) {
            observerId = this.observePointerBindDirect(
                ptrAddress,
                (update) => {
                    // call all local observers
                    const observers = this.#observers.get(ptrAddress);
                    if (observers) {
                        for (const cb of observers.values()) {
                            cb(update);
                        }
                    }
                    console.log("Pointer update received", update);
                },
            );
        }

        this.cacheWrappedPointerValue(ptrAddress, refValue, observerId);

        return refValue;
    }

    /**
     * Caches the given pointer value with the given address in the JS side cache.
     * The pointer must already be wrapped if necessary.
     */
    protected cacheWrappedPointerValue(
        address: string,
        value: WeakKey,
        observerId: number | null,
    ): void {
        this.#cache.set(address, {
            val: new WeakRef(value),
            final: observerId === null,
        });
        // register finalizer to clean up the cache and free the pointer in the runtime
        // when the object is garbage collected
        const finalizationRegistry = new FinalizationRegistry(
            (address: string) => {
                this.#cache.delete(address);
                // remove local observers
                this.#observers.delete(address);
                // if observer is active, unregister it
                if (observerId !== null) {
                    this.unobservePointerBindDirect(address, observerId);
                }
            },
        );
        finalizationRegistry.register(value, address);
    }

    protected getCachedPointer(address: string): WeakKey | undefined {
        const cached = this.#cache.get(address);
        if (cached) {
            const deref = cached.val.deref();
            if (deref) {
                return deref;
            }
        }
        return undefined;
    }

    /**
     * Creates a new pointer containg the given JS value.
     * The returned value is a proxy object that behaves like the original object,
     * but also propagates changes between JS and the DATEX runtime.
     */
    public createPointerFromJSValue<T>(
        value: T,
        allowedType: DIFType | null = null,
        mutability: ReferenceMutability = ReferenceMutability.Mutable,
    ): T | Ref<T> {
        const difValue = this.convertJSValueToDIFValue(value);
        const ptrAddress = this.createPointer(
            difValue,
            allowedType,
            mutability,
        );
        return this.initPointer(ptrAddress, value, mutability); // TODO: map to correct pointer wrapper type
    }

    protected wrapJSValueInProxy<T>(
        value: T,
        pointerAddress: string,
    ): (T | Ref<T>) & WeakKey {
        // primitive values are always wrapped in a Ref proxy
        if (
            value === null || value === undefined ||
            typeof value === "boolean" ||
            typeof value === "number" || typeof value === "bigint" ||
            typeof value === "string"
        ) {
            return new Ref(value, pointerAddress, this);
        } // TODO: wrap in proxy for generic objects and nested refs
        else {
            return value;
        }
    }

    /// Returns the pointer address for the given value if it is already cached, or null otherwise.
    /// TODO: optimize by using a reverse map or direct Symbols on the objects
    /// But this is probably not important for normal use cases
    public getPointerAddressForValue<T>(value: T): string | null {
        for (const [address, entry] of this.#cache) {
            const deref = entry.val.deref();
            if (deref === value) {
                return address;
            }
        }
        return null;
    }

    /**
     * Converts a given JS value to its DIFValue representation.
     */
    public convertJSValueToDIFValue<T extends unknown>(
        value: T,
    ): DIFValue {
        // assuming core values
        // TODO: handle custom types
        if (value === null) {
            return {
                value: null,
            };
        } else if (typeof value === "boolean") {
            return {
                value,
            };
        } else if (typeof value === "number") {
            return {
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
                value: value.map((v) => this.convertJSValueToDIFValue(v)),
            };
        } else if (typeof value === "object") {
            const map: Map<string, DIFValue> = new Map();
            for (const [key, val] of Object.entries(value)) {
                map.set(key, this.convertJSValueToDIFValue(val));
            }
            return {
                type: CoreTypeAddress.map,
                value: map,
            };
        }
        throw new Error("Unsupported type for conversion to DIFValue");
    }
}
