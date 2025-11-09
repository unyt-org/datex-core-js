import type { JsRuntimeInterface } from "../js-runtime-interface.ts";
import * as fs from "node:fs/promises";

export class NodeRuntimeInterface implements JsRuntimeInterface {
    readonly type = "node";

    readTextFile(path: string | URL): Promise<string> {
        return Deno.readTextFile(path);
    }

    readFile(path: string | URL): Promise<Uint8Array> {
        return Deno.readFile(path);
    }

    async instantiateWebAssembly(
        path: URL,
        importObject?: WebAssembly.Imports,
    ): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
        const file = await fs.readFile(path) as Uint8Array;
        return (await WebAssembly.instantiate(file, importObject));
    }
}
