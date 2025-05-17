import type { JSComHub, JSMemory, JSRuntime } from "../datex-core.ts";
import { init_runtime } from "../datex-core.ts";
import { runtimeInterface } from "../utils/js-runtime-compat/runtime.ts";

// get version from deno.json
const VERSION: string = await runtimeInterface
    .readTextFile(new URL("../../deno.json", import.meta.url))
    .then(JSON.parse)
    .then((data: { version: string }) => data.version);

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
}
