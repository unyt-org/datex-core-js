import {
    create_runtime,
    execute_internal,
    type JSRuntime,
} from "../datex-core.ts";
import { ComHub } from "../network/com-hub.ts";
import { DIFHandler } from "../dif/dif-handler.ts";
import { DIFReferenceMutability, type DIFType } from "../dif/definitions.ts";
import type { Ref } from "../refs/ref.ts";

// auto-generated version - do not edit:
const VERSION: string = "0.0.6";

interface DebugFlags {
    allow_unsigned_blocks?: boolean;
    enable_deterministic_behavior?: boolean;
}

export type RuntimeConfig = {
    endpoint?: string;
    interfaces?: { type: string; config: unknown }[];
    debug?: boolean;
};

export type DecompileOptions = {
    formatted?: boolean;
    colorized?: boolean;
    resolve_slots?: boolean;
    json_compat?: boolean;
};

export class Runtime {
    public readonly js_version = VERSION;

    readonly #runtime: JSRuntime;
    readonly #comHub: ComHub;
    readonly #difHandler: DIFHandler;

    constructor(config: RuntimeConfig, debug_flags?: DebugFlags) {
        this.#runtime = create_runtime(JSON.stringify(config), debug_flags);
        this.#comHub = new ComHub(this.#runtime.com_hub);
        this.#difHandler = new DIFHandler(this.#runtime);
    }

    public static async create(
        config: RuntimeConfig,
        debug_flags?: DebugFlags,
    ): Promise<Runtime> {
        const runtime = new Runtime(config, debug_flags);
        await runtime.start();
        return runtime;
    }

    public start(): Promise<void> {
        return this.#runtime.start();
    }

    public _stop(): Promise<void> {
        return this.#runtime._stop();
    }

    /**
     * properties from #runtime
     */
    get endpoint(): string {
        return this.#runtime.endpoint;
    }

    get version(): string {
        return this.#runtime.version;
    }

    get dif(): DIFHandler {
        return this.#difHandler;
    }

    get comHub(): ComHub {
        return this.#comHub;
    }

    /**
     * @internal only used for debugging
     */
    get _runtime(): JSRuntime {
        return this.#runtime;
    }

    public executeWithStringResult(
        datexScript: string,
        values: unknown[] | null = [],
        decompileOptions: DecompileOptions | null = null,
    ): Promise<string> {
        return this.#runtime.execute_with_string_result(
            datexScript,
            this.#difHandler.convertToDIFValues(values),
            decompileOptions,
        );
    }

    public executeSyncWithStringResult(
        datexScript: string,
        values: unknown[] | null = [],
        decompileOptions: DecompileOptions | null = null,
    ): string {
        return this.#runtime.execute_sync_with_string_result(
            datexScript,
            this.#difHandler.convertToDIFValues(values),
            decompileOptions,
        );
    }

    /**
     * Asynchronously executes a Datex script and returns the result as a Promise.
     * Injected values can be passed as an array in `values`.
     * If the script returns no value, it will return `undefined`.
     * Example usage:
     * ```ts
     * const result = await runtime.execute<number>("1 + ?", [41]);
     * console.log(result); // 42
     * ```
     */
    public execute<T = unknown>(
        datexScript: string,
        values?: unknown[],
    ): Promise<T>;

    /**
     * Asynchronously executes a Datex script and returns the result as a Promise.
     * Injected values can be passed to the template string.
     * Example usage:
     * ```ts
     * const result = await runtime.execute<number>`1 + ${41}`;
     * console.log(result); // 42
     * ```
     */
    public execute<T = unknown>(
        templateStrings: TemplateStringsArray,
        ...values: unknown[]
    ): Promise<T>;

    public execute<T = unknown>(
        datexScriptOrTemplateStrings: string | TemplateStringsArray,
        ...values: unknown[]
    ): Promise<T> {
        const { datexScript, valuesArray } = this.#getScriptAndValues(
            datexScriptOrTemplateStrings,
            ...values,
        );
        return this.#executeInternal<T>(datexScript, valuesArray);
    }

    async #executeInternal<T = unknown>(
        datexScript: string,
        values: unknown[] | null = [],
    ): Promise<T> {
        const difValueContainer = await this.#difHandler.executeDIF(
            datexScript,
            values,
        );
        if (difValueContainer === null) {
            return undefined as T;
        }
        return this.#difHandler.resolveDIFValueContainer<T>(difValueContainer);
    }

    /**
     * Executes a Datex script synchronously and returns the result as a generic type T.
     * Injected values can be passed as an array in `values`.
     * If the script returns no value, it will return `undefined`.
     * Example usage:
     * ```ts
     * const result = runtime.executeSync<number>("1 + ?", [41]);
     * console.log(result); // 42
     * ```
     */
    public executeSync<T = unknown>(
        datexScript: string,
        values?: unknown[],
    ): T;

    /**
     * Executes a Datex script synchronously and returns the result as a generic type T.
     * Injected values can be passed to the template string.
     * Example usage:
     * ```ts
     * const result = runtime.executeSync<number>`1 + ${41}`;
     * console.log(result); // 42
     * ```
     */
    public executeSync<T = unknown>(
        templateStrings: TemplateStringsArray,
        ...values: unknown[]
    ): T;

    public executeSync<T = unknown>(
        datexScriptOrTemplateStrings: string | TemplateStringsArray,
        ...values: unknown[]
    ): T {
        // determine datexScript and valuesArray based on the type of datexScriptOrTemplateStrings
        const { datexScript, valuesArray } = this.#getScriptAndValues(
            datexScriptOrTemplateStrings,
            ...values,
        );
        return this.#executeSyncInternal<T>(datexScript, valuesArray);
    }

    #executeSyncInternal<T = unknown>(
        datexScript: string,
        values: unknown[] | null = [],
    ): T {
        const difValue = this.#difHandler.executeSyncDIF(datexScript, values);
        if (difValue === null) {
            return undefined as T;
        }
        const result = this.#difHandler.resolveDIFValueContainer<T>(difValue);
        if (result instanceof Promise) {
            throw new Error(
                "executeSync cannot return a Promise. Use execute() instead.",
            );
        }
        return result;
    }

    public valueToString(
        value: unknown,
        decompileOptions: DecompileOptions | null = null,
    ): string {
        return this.#runtime.value_to_string(
            this.#difHandler.convertJSValueToDIFValue(value),
            decompileOptions,
        );
    }

    /**
     * Handles the function arguments to a normal function call or a template function call,
     * always returning a normalized datexScript and valuesArray.
     */
    #getScriptAndValues(
        datexScriptOrTemplateStrings: string | TemplateStringsArray,
        ...values: unknown[]
    ): { datexScript: string; valuesArray: unknown[] } {
        //
        let datexScript: string;
        let valuesArray: unknown[];
        if (typeof datexScriptOrTemplateStrings === "string") {
            datexScript = datexScriptOrTemplateStrings;
            valuesArray = values[0] as unknown[] ?? [];
        } else if (Array.isArray(datexScriptOrTemplateStrings)) {
            // if it's a TemplateStringsArray, join the strings and interpolate the values
            datexScript = datexScriptOrTemplateStrings.join("?");
            valuesArray = values;
        } else {
            throw new Error("Invalid argument type for executeSync");
        }
        return { datexScript, valuesArray };
    }

    public _execute_internal(datexScript: string): boolean {
        return execute_internal(datexScript);
    }

    /**
     * Creates a new pointer containg the given JS value.
     * The returned value is a proxy object that behaves like the original object,
     * but also propagates changes between JS and the DATEX runtime.
     */
    public createPointer<
        V,
        M extends DIFReferenceMutability =
            typeof DIFReferenceMutability.Mutable,
    >(
        value: V & {},
        allowedType?: any | null,
        mutability?: M,
    ): PointerOut<V, M> {
        return this.#difHandler.createPointerFromJSValue(
            value,
            allowedType,
            mutability,
        ) as PointerOut<V, M>;
    }
}

type WidenLiteral<T> = T extends string ? string
    : T extends number ? number
    : T extends boolean ? boolean
    : T extends bigint ? bigint
    : T extends symbol ? symbol
    : T;

type IsRef<T> = T extends Ref<unknown> ? true : false;
type ContainsRef<T> = IsRef<T> extends true ? true
    : T extends object
        ? { [K in keyof T]: ContainsRef<T[K]> }[keyof T] extends true ? true
        : false
    : false;

export type AssignableRef<T> = Ref<T> | T & { value?: T };

type Builtins =
    | Function
    | Date
    | RegExp
    | Map<any, any>
    | Set<any>
    | WeakMap<any, any>
    | WeakSet<any>
    | Array<any>;

type IsPlainObject<T> = T extends Builtins ? false
    : T extends object ? true
    : false;

type ObjectFieldOut<T, M extends DIFReferenceMutability> = T extends
    Ref<infer U>
    ? M extends typeof DIFReferenceMutability.Final ? Ref<U> : AssignableRef<U>
    : IsPlainObject<T> extends true ? (
            ContainsRef<T> extends true
                ? M extends typeof DIFReferenceMutability.Final
                    ? { readonly [K in keyof T]: ObjectFieldOut<T[K], M> }
                : { [K in keyof T]: ObjectFieldOut<T[K], M> }
                : { readonly [K in keyof T]: ObjectFieldOut<T[K], M> }
        )
    : T;

type PointerOut<V, M extends DIFReferenceMutability> = V extends Ref<infer U>
    ? M extends typeof DIFReferenceMutability.Final ? Ref<U> : AssignableRef<U>
    : IsPlainObject<V> extends true ? (
            ContainsRef<V> extends true
                ? M extends typeof DIFReferenceMutability.Final
                    ? { readonly [K in keyof V]: ObjectFieldOut<V[K], M> }
                : { [K in keyof V]: ObjectFieldOut<V[K], M> }
                : { readonly [K in keyof V]: ObjectFieldOut<V[K], M> }
        )
    : V extends Builtins ? Pointer<V>
    : M extends typeof DIFReferenceMutability.Final ? Ref<V>
    : Ref<WidenLiteral<V>>;

type CollectionProps<T> = {
    [K in keyof T as K extends "value" ? never : K]: T[K];
};

interface MapRef<K, V> extends Ref<Map<K, V>>, CollectionProps<Map<K, V>> {}
interface SetRef<T> extends Ref<Set<T>>, CollectionProps<Set<T>> {}
interface ArrayRef<T> extends Ref<T[]>, CollectionProps<T[]> {}

type Pointer<T> = T extends Map<infer K, infer V> ? MapRef<K, V>
    : T extends Set<infer U> ? SetRef<U>
    : T extends Array<infer U> ? ArrayRef<U>
    : Ref<T>;
