import { init_runtime } from "../datex-core.ts";
import type { JSMemory, JSRuntime } from "../datex-core.ts";
import { runtimeInterface } from "../utils/js-runtime-compat/runtime.ts";

// get version from deno.json
const VERSION: string = await runtimeInterface
    .readTextFile(new URL("../../deno.json", import.meta.url))
    .then(JSON.parse)
    .then((data: { version: string }) => data.version);

export class Runtime {
    public readonly js_version = VERSION;

    #runtime: JSRuntime;
    #memory: JSMemory;

    /**
     * properties from #runtime
     */
    get version(): string {
        return this.#runtime.version;
    }

    get memory(): JSMemory {
        return this.#memory;
    }

    /**
     * @internal only used for debugging
     */
    get _runtime(): JSRuntime {
        return this.#runtime;
    }

    constructor() {
        this.#runtime = init_runtime();
        this.#memory = this.#runtime.memory;
    }
}
