import type { JsRuntimeInterface } from "../js-runtime-interface.ts";

export class DenoRuntimeInterface implements JsRuntimeInterface {
    readonly type = "deno";

    readTextFile(path: string | URL): Promise<string> {
        return Deno.readTextFile(path);
    }

    readFile(path: string | URL): Promise<Uint8Array> {
        return Deno.readFile(path);
    }
}
