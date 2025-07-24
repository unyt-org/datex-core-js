import {execute_internal, init_runtime, type JSComHub, type JSMemory, type JSRuntime} from "../datex-core.ts";

// auto-generated version - do not edit:
const VERSION: string = "0.0.5";

interface DebugFlags {
    allow_unsigned_blocks?: boolean;
    enable_deterministic_behavior?: boolean;
}

export class Runtime {
    public readonly js_version = VERSION;

    readonly #runtime: JSRuntime;
    readonly #memory: JSMemory;
    readonly #comHub: JSComHub;

    constructor(endpoint: string = "@unyt", debug_flags?: DebugFlags) {
        this.#runtime = init_runtime(endpoint, debug_flags);
        this.#memory = this.#runtime.memory;
        this.#comHub = this.#runtime.com_hub;
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

    get comHub(): JSComHub {
        return this.#comHub;
    }

    /**
     * @internal only used for debugging
     */
    get _runtime(): JSRuntime {
        return this.#runtime;
    }

    public execute(datex_script: string, formatted: boolean = false): Promise<string> {
        return this.#runtime.execute(datex_script, formatted);
    }

    public execute_sync(datex_script: string, formatted: boolean = false): string {
        return this.#runtime.execute_sync(datex_script, formatted);
    }

    public _execute_internal(datex_script: string): boolean {
        return execute_internal(datex_script);
    }
}
