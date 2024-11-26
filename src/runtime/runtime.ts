import { init_runtime } from "../datex-core.ts";
import type {
    JSMemory,
    JSRuntime,
} from "../datex-core/datex_core_js.generated.d.ts";

// get version from deno.json
const VERSION = globalThis.Deno
    // Deno
    ? await Deno.readTextFile(new URL("../../deno.json", import.meta.url)).then(
        JSON.parse,
    ).then((data: { version: string }) => data.version)
    // browser
    : await fetch(new URL("../../deno.json", import.meta.url)).then((res) =>
        res.json()
    ).then((data: { version: string }) => data.version);

export class Runtime {
    public readonly js_version = VERSION;

    #runtime: JSRuntime;
    #memory: JSMemory;

    /**
     * properties from #runtime
     */
    get version() {
        return this.#runtime.version;
    }

    get memory() {
        return this.#memory;
    }

    /**
     * @internal only used for debugging
     */
    get _runtime() {
        return this.#runtime;
    }

    constructor() {
        this.#runtime = init_runtime();
        this.#memory = this.#runtime.memory;
    }
}
