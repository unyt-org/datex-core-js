import {
    create_runtime,
    execute_internal,
    type JSMemory,
    type JSRuntime,
} from "../datex-core.ts";
import { ComHub } from "../network/com-hub.ts";
import {convertToDIFValues, DIFValue, resolveDIFValue} from "./dif.ts";

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
        datex_script: string,
        values: unknown[]|null = [],
        formatted: boolean = false,
    ): Promise<string> {
        return this.#runtime.execute_with_string_result(
            datex_script,
            convertToDIFValues(values),
            formatted,
        );
    }

    public executeSyncWithStringResult(
        datex_script: string,
        values: unknown[]|null = [],
        formatted: boolean = false,
    ): string {
        return this.#runtime.execute_sync_with_string_result(
            datex_script,
            convertToDIFValues(values),
            formatted,
        );
    }

    public executeDIF(
        datex_script: string,
        values: unknown[]|null = [],
    ): Promise<DIFValue> {
        return this.#runtime.execute(
            datex_script,
            convertToDIFValues(values)
        );
    }

    public executeSyncDIF(
        datex_script: string,
        values: unknown[]|null = [],
    ): DIFValue {
        return this.#runtime.execute_sync(
            datex_script,
            convertToDIFValues(values)
        );
    }

    // TODO: add normal execute/execute_sync methods that return an actual js value converted from DIFValue
    public async execute<T = unknown>(
        datex_script: string,
        values: unknown[] = [],
    ): Promise<T> {
        const difValue = await this.executeDIF(datex_script, values,);
        return resolveDIFValue<T>(difValue);
    }

    public executeSync<T = unknown>(
        datex_script: string,
        values: unknown[] = [],
    ): T {
        const difValue = this.executeSyncDIF(datex_script, values);
        console.log("difValue", difValue);
        if (difValue === null) {
            return undefined as T;
        }
        return resolveDIFValue<T>(difValue);
    }

    public _execute_internal(datex_script: string): boolean {
        return execute_internal(datex_script);
    }
}
