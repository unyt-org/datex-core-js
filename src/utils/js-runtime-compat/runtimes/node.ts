import { promises as fs } from "fs";
import type { JsRuntimeInterface } from "../js-runtime-interface.ts";

export class NodeRuntimeInterface implements JsRuntimeInterface {
    readonly type = "node";

    async readTextFile(path: string | URL): Promise<string> {
        const filePath = typeof path === "string" ? path : path.toString();
        return fs.readFile(filePath, { encoding: "utf-8" });
    }

    async readFile(path: string | URL): Promise<Uint8Array> {
        const filePath = typeof path === "string" ? path : path.toString();
        return fs.readFile(filePath);
    }
}
