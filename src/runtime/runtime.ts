import { init_runtime } from "../datex-core.ts";

export class Runtime {
	public readonly JS_VERSION = "1.0";
	public readonly VERSION = "1.0";

	constructor() {
		init_runtime();
	}

}