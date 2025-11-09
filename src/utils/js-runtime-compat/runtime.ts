/**
 * @module runtime
 * @description
 * The runtime module provides a runtimeInterface object that contains common
 * runtime-specific functions for reading files, etc.
 * It automatically detects the runtime environment and provides the correct
 * runtime interface.
 * Supported runtimes are:
 * - Deno
 * - Node.js
 * - Bun
 * - Browser
 */

import type {
    JsRuntimeInterface,
    JSRuntimeType,
} from "./js-runtime-interface.ts";

function detectRuntime(): JSRuntimeType {
    if (globalThis.navigator?.userAgent.startsWith("Node.js")) {
        return "node";
    } else if (globalThis.navigator?.userAgent.startsWith("Deno")) {
        return "deno";
    } else if (globalThis.navigator?.userAgent.startsWith("Bun")) {
        return "bun";
    } else {
        return "browser";
    }
}

async function getRuntimeInterface(type: JSRuntimeType) {
    if (type === "deno") {
        const { DenoRuntimeInterface } = await import("./runtimes/deno.ts");
        return new DenoRuntimeInterface();
    } else if (type === "node") {
        const { NodeRuntimeInterface } = await import("./runtimes/node.ts");
        return new NodeRuntimeInterface();
    } else {
        const { BrowserRuntimeInterface } = await import(
            "./runtimes/browser.ts"
        );
        return new BrowserRuntimeInterface();
    }
}

export const runtimeInterface: JsRuntimeInterface = await getRuntimeInterface(
    detectRuntime(),
);
