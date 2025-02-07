export type JSRuntimeType = "deno" | "browser";

export interface JsRuntimeInterface {
    type: JSRuntimeType;
    readTextFile(path: string | URL): Promise<string>;
    readFile(path: string | URL): Promise<Uint8Array>;
}
