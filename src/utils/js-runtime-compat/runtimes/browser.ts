import type { JsRuntimeInterface } from "../js-runtime-interface.ts";

export default class BrowserRuntimeInterface implements JsRuntimeInterface {
    readonly type = "browser";

    async readTextFile(path: string | URL): Promise<string> {
        const response = await fetch(path.toString());
        return await response.text();
    }

    async readFile(path: string | URL): Promise<Uint8Array> {
        const response = await fetch(path.toString());
        const buffer = await response.arrayBuffer();
        return new Uint8Array(buffer);
    }

    instantiateWebAssembly(
        path: URL,
        importObject?: WebAssembly.Imports,
    ): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
        return WebAssembly.instantiateStreaming(fetch(path), importObject);
    }
}
