import { init_runtime } from "../rs_lib.ts";

export class Runtime {
	public static readonly JS_VERSION = "1.0";
	public static readonly VERSION = "1.0";

	public static init() {
		init_runtime()
	}

}