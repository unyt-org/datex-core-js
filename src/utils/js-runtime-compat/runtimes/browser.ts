import type { JsRuntimeInterface } from "../js-runtime-interface.ts";

export class BrowserRuntimeInterface implements JsRuntimeInterface {
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
}
