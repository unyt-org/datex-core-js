import type { JSRuntime, RuntimeDIFHandle } from "../datex-core.ts";
import { Ref } from "../refs/ref.ts";
import { Endpoint } from "../lib/special-core-types/endpoint.ts";
import {
    type DIFArray,
    type DIFMap,
    type DIFObject,
    type DIFPointerAddress,
    type DIFProperty,
    type DIFReference,
    DIFReferenceMutability,
    type DIFTypeContainer,
    type DIFUpdate,
    type DIFUpdateData,
    DIFUpdateKind,
    type DIFValue,
    type DIFValueContainer,
    type ObserveOptions,
} from "./definitions.ts";
import { CoreTypeAddress, CoreTypeAddressRanges } from "./core.ts";
import { difValueContainerToDisplayString } from "./display.ts";
import { type TypeBinding, TypeRegistry } from "./type-registry.ts";
import { panic } from "../utils/exceptions.ts";

export type ReferenceMetadata = Record<string | symbol, unknown>;

/**
 * The DIFHandler class provides methods to interact with the DATEX Core DIF runtime,
 * including executing Datex scripts, creating and managing references, and observing changes.
 * It includes a local reference cache to optimize performance and reduce cross-language calls.
 */
export class DIFHandler {
    /** The JSRuntime interface for the underlying Datex Core runtime */
    #runtime: JSRuntime;
    readonly #handle: RuntimeDIFHandle;

    // always 0 for now - potentially used for multi DIF transceivers using the same underlying runtime
    readonly #transceiver_id = 0;

    /**
     * The reference cache for storing and reusing object instances on the JS side
     * The observerId is only set if the reference is being observed (if not final).
     */
    readonly #cache = new Map<
        string,
        { val: WeakRef<WeakKey>; observerId: number | null }
    >();

    readonly #referenceMetadata = new WeakMap<
        WeakKey,
        { address: string; metadata: ReferenceMetadata }
    >();

    readonly #observers = new Map<
        string,
        Map<number, (value: DIFUpdateData) => void>
    >();

    readonly #type_registry = new TypeRegistry(this);

    /**
     * Internal property
     * @returns The map of observers for each pointer address.
     */
    get _observers(): Map<string, Map<number, (value: DIFUpdateData) => void>> {
        return this.#observers;
    }

    /**
     * Internal property
     * @returns The RuntimeDIFHandle instance.
     */
    get _handle(): RuntimeDIFHandle {
        return this.#handle;
    }

    /**
     * Internal property
     * @returns The transceiver ID of the DIF client.
     */
    get _transceiver_id(): number {
        return this.#transceiver_id;
    }

    get type_registry(): TypeRegistry {
        return this.#type_registry;
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
    ): Promise<DIFValueContainer> {
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
    ): DIFValueContainer {
        return this.#runtime.execute_sync(
            datexScript,
            this.convertToDIFValues(values),
        );
    }

    /**
     * Creates a new pointer for the specified value.
     * @param difValueContainer - The DIFValueContainer value to create a pointer for.
     * @param allowedType - The allowed type for the pointer.
     * @param mutability - The mutability of the pointer.
     * @returns The created pointer address.
     */
    public createReference(
        difValueContainer: DIFValueContainer,
        allowedType: DIFTypeContainer | null = null,
        mutability: DIFReferenceMutability,
    ): string {
        return this.#handle.create_pointer(
            difValueContainer,
            allowedType,
            mutability,
        );
    }

    /**
     * Updates the DIF value at the specified address.
     * @param address - The address of the DIF value to update.
     * @param dif - The DIFUpdate object containing the update information.
     */
    public updateReference(address: string, dif: DIFUpdateData) {
        this.#handle.update(this.#transceiver_id, address, dif);
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
        options: ObserveOptions = { relay_own_updates: false },
    ): number {
        return this.#runtime.dif().observe_pointer(
            this.#transceiver_id,
            address,
            options,
            callback,
        );
    }

    /**
     * Updates the observe options for a registered observer.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     * @param options - The new observe options to apply.
     */
    private updateObserverOptions(
        address: string,
        observerId: number,
        options: ObserveOptions,
    ) {
        this.#runtime.dif().update_observer_options(
            address,
            observerId,
            options,
        );
    }

    /**
     * Enables propagation of own updates for a registered observer.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     */
    public enableOwnUpdatesPropagation(
        address: string,
        observerId: number,
    ) {
        this.updateObserverOptions(address, observerId, {
            relay_own_updates: true,
        });
    }

    /**
     * Disables propagation of own updates for a registered observer.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     */
    public disableOwnUpdatesPropagation(
        address: string,
        observerId: number,
    ) {
        this.updateObserverOptions(address, observerId, {
            relay_own_updates: false,
        });
    }

    /**
     * Unregisters an observer that was registered directly on the DATEX core runtime
     * with the observePointerBindDirect method.
     * For internal use only.
     * @param address - The address of the DIF value being observed.
     * @param observerId - The observer ID returned by the observePointer method.
     */
    public unobserveReferenceBindDirect(address: string, observerId: number) {
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
        callback: (value: DIFUpdateData) => void,
    ): number {
        let cached = this.#cache.get(address);
        if (!cached) {
            // first resolve the pointer to make sure it's loaded in the cache
            this.resolvePointerAddressSync(address);
            cached = this.#cache.get(address)!;
        }

        // make sure the pointer is not final (no observer)
        if (cached.observerId === null) {
            throw new Error(`Cannot observe final reference $${address}`);
        }

        // directly add to observers map
        let observers = this.#observers.get(address);
        if (!observers) {
            observers = new Map();
            this.#observers.set(address, observers);
            // first local observer for this address - enable own updates propagation
            this.enableOwnUpdatesPropagation(address, cached.observerId);
        }
        // FIXME make this more robust for delete/re-add cases
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
                // no local observers left - disable own updates propagation and remove from map
                const cached = this.#cache.get(address);
                if (cached?.observerId) {
                    this.disableOwnUpdatesPropagation(
                        address,
                        cached.observerId,
                    );
                } else {
                    console.error(`No observer found for address ${address}`);
                }
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
        console.log("RESOLVE", value);
        let type = value.type;
        if (type === undefined) {
            if (Array.isArray(value.value)) {
                if (Array.isArray(value.value[0])) {
                    type = CoreTypeAddress.map;
                } else {
                    type = CoreTypeAddress.list;
                }
            } else {
                return value.value as T;
            }
        }
        console.log(type, value);

        // null, boolean and text types values are just returned as is
        if (
            type === CoreTypeAddress.boolean ||
            type == CoreTypeAddress.text ||
            type === CoreTypeAddress.null
        ) {
            return value.value as T;
        } // small integers are interpreted as JS numbers
        else if (
            typeof type === "string" && (
                type == CoreTypeAddress.integer ||
                this.isPointerAddressInAdresses(
                    type,
                    CoreTypeAddressRanges.small_signed_integers,
                ) ||
                this.isPointerAddressInAdresses(
                    type,
                    CoreTypeAddressRanges.small_unsigned_integers,
                )
            )
        ) {
            return Number(value.value as number) as T;
        } // big integers are interpreted as JS BigInt
        else if (
            typeof type === "string" && (
                this.isPointerAddressInAdresses(
                    type,
                    CoreTypeAddressRanges.big_signed_integers,
                ) ||
                this.isPointerAddressInAdresses(
                    type,
                    CoreTypeAddressRanges.big_unsigned_integers,
                )
            )
        ) {
            return BigInt(value.value as number) as T;
        } // decimal types are interpreted as JS numbers
        else if (
            typeof type === "string" &&
            this.isPointerAddressInAdresses(
                type,
                CoreTypeAddressRanges.decimals,
            )
        ) {
            return (Number(value.value) as number) as T;
        } // endpoint types are resolved to Endpoint instances
        else if (type === CoreTypeAddress.endpoint) {
            return Endpoint.get(value.value as string) as T;
        } else if (type === CoreTypeAddress.list) {
            return this.promiseAllOrSync(
                (value.value as DIFArray).map((v) =>
                    this.resolveDIFValueContainer(v)
                ),
            ) as T | Promise<T>;
        } // map types are resolved from a DIFObject (aka JS Map) or Array of key-value pairs to a JS object
        else if (type === CoreTypeAddress.map) {
            if (Array.isArray(value.value)) {
                const resolvedMap = new Map<unknown, unknown>();
                for (const [key, val] of (value.value as DIFMap)) {
                    // TODO: currently always converting to an object here, but this should be a Map per default
                    resolvedMap.set(
                        this.resolveDIFValueContainer(key),
                        this.resolveDIFValueContainer(val),
                    );
                }
                // TODO: map promises
                return resolvedMap as unknown as T | Promise<T>;
            } else {
                const resolvedObj: { [key: string]: unknown } = {};
                for (
                    const [key, val] of Object.entries(value.value as DIFObject)
                ) {
                    // TODO: currently always converting to an object here, but this should be a Map per default
                    resolvedObj[key as string] = this.resolveDIFValueContainer(
                        val,
                    );
                }
                return this.promiseFromObjectOrSync(resolvedObj) as
                    | T
                    | Promise<T>;
            }
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
     * Resolves a DIFProperty to its corresponding JS value.
     */
    public resolveDIFPropertySync<T extends unknown>(
        property: DIFProperty,
    ): T {
        if (property.kind === "text") {
            return property.value as T;
        } else if (property.kind === "index") {
            return property.value as T;
        } else {
            return this.resolveDIFValueContainerSync(property.value);
        }
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
        const cached = this.getCachedReference(address);
        if (cached) {
            return cached as T;
        }
        // if not in cache, resolve from runtime
        const reference: DIFReference | Promise<DIFReference> = this
            .#handle.resolve_pointer_address(address);
        return this.mapPromise(reference, (reference) => {
            const value: T | Promise<T> = this.resolveDIFValueContainer(
                reference.value,
            );
            return this.mapPromise(value, (v) => {
                // init pointer
                this.initReference(
                    address,
                    v,
                    reference.mut,
                    reference.allowed_type,
                );
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
        const cached = this.getCachedReference(address);
        if (cached) {
            return cached as T;
        }
        // if not in cache, resolve from runtime
        const entry: DIFReference = this.#handle
            .resolve_pointer_address_sync(address);
        const value: T = this.resolveDIFValueContainerSync(
            entry.value,
        );
        this.initReference(address, value, entry.mut, entry.allowed_type);
        return value;
    }

    /**
     * Converts an array of JS values to an array of DIFValues.
     * If the input is null, it returns null.
     * @param values
     */
    public convertToDIFValues<T extends unknown[]>(
        values: T | null,
    ): DIFValueContainer[] | null {
        return values?.map((value) => this.convertJSValueToDIFValue(value)) ||
            null;
    }

    /**
     * Returns true if the given address is within the specified address range.
     */
    protected isPointerAddressInAdresses(
        address: DIFPointerAddress,
        range: Set<string>,
    ): boolean {
        return range.has(address);
    }

    /**
     * Initializes a reference with the given value and mutability, by
     * adding a proxy wrapper if necessary, and setting up observation and caching on the JS side.
     */
    protected initReference<T>(
        pointerAddress: string,
        value: T,
        mutability: DIFReferenceMutability,
        allowedType: DIFTypeContainer | null = null,
    ): T | Ref<T> {
        let wrappedValue = this.wrapJSValue(
            value,
            pointerAddress,
            allowedType,
        );

        let typeBinding: TypeBinding<unknown> | null = null;
        let metadata: ReferenceMetadata | undefined = undefined;

        // bind js value (if mutable, nominal type)
        const bindJSValue = mutability !== DIFReferenceMutability.Immutable &&
            typeof allowedType == "string";
        if (bindJSValue && !(wrappedValue instanceof Ref)) {
            typeBinding = this.type_registry.getTypeBinding(allowedType);
            if (typeBinding) {
                const { value, metadata: newMetadata } =
                    (typeBinding as TypeBinding<T & WeakKey>)
                        .bindValue(
                            wrappedValue,
                            pointerAddress,
                        );
                metadata = newMetadata;
                wrappedValue = value;
            }
        }

        // if not immutable, observe to keep the pointer 'live' and receive updates
        let observerId: number | null = null;
        if (mutability !== DIFReferenceMutability.Immutable) {
            observerId = this.observePointerBindDirect(
                pointerAddress,
                (update) => {
                    // if source_id is not own transceiver id, handle pointer update
                    if (update.source_id !== this.#transceiver_id) {
                        try {
                            this.handlePointerUpdate(
                                pointerAddress,
                                wrappedValue,
                                update.data,
                                typeBinding,
                            );
                        } catch (e) {
                            console.error(
                                "Error handling pointer update",
                                e,
                            );
                            throw e;
                        }
                    }
                    // call all local observers
                    const observers = this.#observers.get(pointerAddress);
                    if (observers) {
                        for (const cb of observers.values()) {
                            try {
                                cb(update.data);
                            } catch (e) {
                                console.error(
                                    "Error in pointer observer callback",
                                    e,
                                );
                            }
                        }
                    }
                    console.debug("Pointer update received", update);
                },
            );
        }

        this.cacheWrappedReferenceValue(
            pointerAddress,
            wrappedValue,
            observerId,
            metadata,
        );

        // set up observers
        return wrappedValue as T | Ref<T>;
    }

    /**
     * Handles a pointer update received from the DATEX core runtime.
     * If the pointer is cached and has a dereferenceable value, it updates the value.
     * @param pointerAddress - The address of the pointer being updated.
     * @param update - The DIFUpdateData containing the update information.
     * @returns True if the pointer was found and updated, false otherwise.
     */
    protected handlePointerUpdate<T>(
        pointerAddress: string,
        value: T,
        update: DIFUpdateData,
        typeBinding: TypeBinding<T> | null,
    ): boolean {
        const cached = this.#cache.get(pointerAddress);
        if (!cached) return false;
        const deref = cached.val.deref();
        if (!deref) return false;

        if (deref instanceof Ref && update.kind === DIFUpdateKind.Replace) {
            deref.updateValueSilently(this.resolveDIFValueContainerSync(
                update.value,
            ));
        }
        // handle generic updates for values (depending on type interface definition)
        if (typeBinding) {
            typeBinding.handleDifUpdate(value, pointerAddress, update);
        }

        return true;
    }

    /**
     * Caches the given reference value with the given address in the JS side cache.
     * The reference must already be wrapped if necessary.
     */
    protected cacheWrappedReferenceValue(
        address: string,
        value: WeakKey,
        observerId: number | null,
        metadata: ReferenceMetadata = {},
    ): void {
        this.#cache.set(address, {
            val: new WeakRef(value),
            observerId,
        });
        this.#referenceMetadata.set(value, {
            address,
            metadata,
        });
        // register finalizer to clean up the cache and free the reference in the runtime
        // when the object is garbage collected
        const finalizationRegistry = new FinalizationRegistry(
            (address: string) => {
                this.#cache.delete(address);
                // remove local observers
                this.#observers.delete(address);
                // if observer is active, unregister it
                if (observerId !== null) {
                    this.unobserveReferenceBindDirect(address, observerId);
                }
            },
        );
        finalizationRegistry.register(value, address);
    }

    protected getCachedReference(address: string): WeakKey | undefined {
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
     * Creates a new reference containg the given JS value.
     * The returned value is a proxy object that behaves like the original object,
     * but also propagates changes between JS and the DATEX runtime.
     */
    public createReferenceFromJSValue(
        value: unknown,
        allowedType: DIFTypeContainer | null = null,
        mutability: DIFReferenceMutability = DIFReferenceMutability.Mutable,
    ): unknown | Ref<unknown> {
        const difValue = this.convertJSValueToDIFValue(value);
        console.log("DIF", difValueContainerToDisplayString(difValue));
        const ptrAddress = this.createReference(
            difValue,
            allowedType,
            mutability,
        );
        // get inferred allowed type from pointer if not explicitly set
        if (!allowedType) {
            allowedType = (this.#handle.resolve_pointer_address_sync(
                ptrAddress,
            ) as DIFReference).allowed_type;
        }
        return this.initReference(ptrAddress, value, mutability, allowedType);
    }

    /**
     * Wraps a given JS value in a Ref proxy if necessary.
     */
    protected wrapJSValue<T>(
        value: T,
        pointerAddress: string,
        _type: DIFTypeContainer | null = null,
    ): (T | Ref<unknown>) & WeakKey {
        // primitive values are always wrapped in a Ref proxy
        if (
            value === null || value === undefined ||
            typeof value === "boolean" ||
            typeof value === "number" || typeof value === "bigint" ||
            typeof value === "string"
        ) {
            return new Ref(value, pointerAddress, this);
        } else {
            return value;
        }
    }

    private isRef(value: unknown): value is Ref<unknown> {
        return value instanceof Ref;
    }

    private wrapJSObjectInProxy<T extends object>(
        value: T,
    ): (T | Ref<unknown>) & WeakKey {
        // deno-lint-ignore no-this-alias
        const self = this;
        return new Proxy(value, {
            get(target, prop, receiver) {
                const val = Reflect.get(target, prop, receiver);
                if (val && typeof val === "object" && !self.isRef(val)) {
                    return self.wrapJSObjectInProxy(val);
                }
                return val;
            },
            set(target, prop, newValue, receiver) {
                const oldValue = Reflect.get(target, prop, receiver);
                if (!self.isRef(oldValue)) {
                    throw new Error(
                        `Cannot modify non-Ref property "${String(prop)}"`,
                    );
                }
                oldValue.value = newValue;
                return true;
            },
            deleteProperty() {
                throw new Error(
                    "Cannot delete properties from a Refs-only object",
                );
            },
            defineProperty() {
                throw new Error(
                    "Cannot define new properties on a Refs-only object",
                );
            },
        });
    }

    /**
     * Returns the pointer address for the given value if it is already cached, or null otherwise.
     */
    public getPointerAddressForValue<T extends WeakKey>(
        value: T,
    ): string | null {
        return this.#referenceMetadata.get(value)?.address || null;
    }

    /**
     * Returns the reference metadata for the given value if it is already cached, or null otherwise.
     * The caller must ensure that the correct type M is used and the reference is already registered.
     * If the reference is not found, an error is thrown.
     */
    public getReferenceMetadata<M extends ReferenceMetadata, T extends WeakKey>(
        value: T,
    ): M {
        const metadata = this.#referenceMetadata.get(value)?.metadata as
            | M
            | null;
        if (!metadata) {
            panic("Reference metadata not found for the given value");
        }
        return metadata;
    }

    /**
     * Converts a given JS value to its DIFValue representation.
     */
    public convertJSValueToDIFValue<T extends unknown>(
        value: T,
    ): DIFValueContainer {
        // if the value is a registered reference, return its address
        const existingReference = this.#referenceMetadata.get(value as WeakKey);
        if (existingReference) {
            return existingReference.address;
        }
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
        } else if (value instanceof Map) {
            const map: [DIFValueContainer, DIFValueContainer][] = value
                .entries().map((
                    [k, v],
                ) => [
                    this.convertJSValueToDIFValue(k),
                    this.convertJSValueToDIFValue(v),
                ] satisfies [DIFValueContainer, DIFValueContainer]).toArray();
            return {
                type: CoreTypeAddress.map,
                value: map,
            };
        } else if (typeof value === "object") {
            const map: Record<string, DIFValueContainer> = {};
            for (const [key, val] of Object.entries(value)) {
                map[key] = this.convertJSValueToDIFValue(val);
            }
            return {
                type: CoreTypeAddress.map,
                value: map,
            };
        }
        throw new Error("Unsupported type for conversion to DIFValue");
    }

    /** DIF update handler utilities */

    /**
     * Triggers a 'set' update for the given pointer address, key and value.
     */
    public triggerSet<K, V>(
        pointerAddress: string,
        key: K,
        value: V,
    ) {
        const difKey = this.convertJSValueToDIFValue(key);
        const difValue = this.convertJSValueToDIFValue(value);
        const update: DIFUpdateData = {
            kind: DIFUpdateKind.Set,
            key: { kind: "value", value: difKey },
            value: difValue,
        };
        this.updateReference(pointerAddress, update);
    }

    /**
     * Triggers an 'append' update for the given pointer address and value.
     */
    public triggerAppend<V>(
        pointerAddress: string,
        value: V,
    ) {
        const difValue = this.convertJSValueToDIFValue(value);
        const update: DIFUpdateData = {
            kind: DIFUpdateKind.Append,
            value: difValue,
        };
        this.updateReference(pointerAddress, update);
    }

    /**
     * Triggers a 'replace' update for the given pointer address and key.
     */
    public triggerReplace<V>(
        pointerAddress: string,
        value: V,
    ) {
        const difValue = this.convertJSValueToDIFValue(value);
        const update: DIFUpdateData = {
            kind: DIFUpdateKind.Replace,
            value: difValue,
        };
        this.updateReference(pointerAddress, update);
    }

    /**
     * Triggers a 'delete' update for the given pointer address and key.
     */
    public triggerDelete<K>(
        pointerAddress: string,
        key: K,
    ) {
        const difKey = this.convertJSValueToDIFValue(key);
        const update: DIFUpdateData = {
            kind: DIFUpdateKind.Delete,
            key: { kind: "value", value: difKey },
        };
        this.updateReference(pointerAddress, update);
    }

    /**
     * Triggers a 'clear' update for the given pointer address.
     */
    public triggerClear(pointerAddress: string) {
        const update: DIFUpdateData = {
            kind: DIFUpdateKind.Clear,
        };
        this.updateReference(pointerAddress, update);
    }
}
