import { init_runtime } from "../datex-core.ts";
import type { JSRuntime } from "../datex-core/datex_core_js.generated.d.ts";

export class Runtime {
	public readonly js_version = "0.0.1";

	#runtime: JSRuntime;

	/**
	 * properties from #runtime
	 */
	get version() {
		return this.#runtime.version;
	}

	/**
	 * @internal only used for debugging
	 */
	get _runtime() {
		return this.#runtime;
	}

	constructor() {
		this.#runtime = init_runtime();
	}

}