export type JSRuntimeType = "deno" | "browser" | "node" | "bun";

export interface JsRuntimeInterface {
    type: JSRuntimeType;
    readTextFile(path: string | URL): Promise<string>;
    readFile(path: string | URL): Promise<Uint8Array>;
    instantiateWebAssembly(
        path: URL,
        importObject?: WebAssembly.Imports,
    ): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
}
