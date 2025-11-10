import type { JsRuntimeInterface } from "../js-runtime-interface.ts";
import * as fs from "node:fs/promises";

export default class NodeRuntimeInterface implements JsRuntimeInterface {
    readonly type = "node";

    readTextFile(path: string | URL): Promise<string> {
        return fs.readFile(path, { encoding: "utf-8" });
    }

    readFile(path: string | URL): Promise<Uint8Array> {
        return fs.readFile(path);
    }

    async instantiateWebAssembly(
        path: URL,
        importObject?: WebAssembly.Imports,
    ): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
        const file = await fs.readFile(path) as BufferSource;
        return (await WebAssembly.instantiate(file, importObject));
    }
}
