import {
    create_runtime,
    execute_internal,
    type JSMemory,
    JSRuntime,
} from "../datex-core.ts";
import { ComHub } from "../network/com-hub.ts";
import {
    convertToDIFValue,
    convertToDIFValues,
    type DIFValue,
    resolveDIFValue,
} from "./dif.ts";

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
    readonly #memory: JSMemory;
    readonly #comHub: ComHub;

    constructor(config: RuntimeConfig, debug_flags?: DebugFlags) {
        this.#runtime = create_runtime(JSON.stringify(config), debug_flags);
        this.#memory = this.#runtime.memory;
        this.#comHub = new ComHub(this.#runtime.com_hub);
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

    get memory(): JSMemory {
        return this.#memory;
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
            convertToDIFValues(values),
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
            convertToDIFValues(values),
            decompileOptions,
        );
    }

    public executeDIF(
        datexScript: string,
        values: unknown[] | null = [],
    ): Promise<DIFValue> {
        return this.#runtime.execute(
            datexScript,
            convertToDIFValues(values),
        );
    }

    public executeSyncDIF(
        datexScript: string,
        values: unknown[] | null = [],
    ): DIFValue {
        return this.#runtime.execute_sync(
            datexScript,
            convertToDIFValues(values),
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
        const difValue = await this.executeDIF(datexScript, values);
        if (difValue === null) {
            return undefined as T;
        }
        return resolveDIFValue<T>(difValue);
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
        const difValue = this.executeSyncDIF(datexScript, values);
        console.debug("difValue", difValue);
        if (difValue === null) {
            return undefined as T;
        }
        return resolveDIFValue<T>(difValue);
    }

    public valueToString(
        value: unknown,
        decompileOptions: DecompileOptions | null = null,
    ): string {
        return JSRuntime.value_to_string(
            convertToDIFValue(value),
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
}
