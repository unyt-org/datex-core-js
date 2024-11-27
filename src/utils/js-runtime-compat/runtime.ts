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

type global = {
    process: {
        versions: Record<string, string>;
    };
    // isPolyfill is a custom property injected by the unyt.land Deno polyfill for browsers
    Deno: typeof Deno & { isPolyfill?: boolean };
};

function detectRuntime(): JSRuntimeType {
    const global = globalThis as unknown as global;

    if (global.Deno && !global.Deno.isPolyfill) {
        return "deno";
    } else if (global.process.versions.bun) {
        return "bun";
    } else if (global.process) {
        return "node";
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
    } else if (type === "bun") {
        const { BunRuntimeInterface } = await import("./runtimes/bun.ts");
        return new BunRuntimeInterface();
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
