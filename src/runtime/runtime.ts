import {
    create_runtime,
    execute_internal,
    type JSMemory,
    type JSRuntime,
} from "../datex-core.ts";
import { ComHub } from "../network/com-hub.ts";

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

    public execute(
        datex_script: string,
        formatted: boolean = false,
    ): Promise<string> {
        return this.#runtime.execute(datex_script, formatted);
    }

    public execute_sync(
        datex_script: string,
        formatted: boolean = false,
    ): string {
        return this.#runtime.execute_sync(datex_script, formatted);
    }

    public _execute_internal(datex_script: string): boolean {
        return execute_internal(datex_script);
    }
}
