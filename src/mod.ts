/**
 * @module mod.ts
 * @description
 * This module exports an instance of the DATEX runtime.
 */

import { Runtime } from "./runtime/runtime.ts";

/**
 * The default configuration for the Datex runtime.
 */
const defaultConfig = {
    interfaces: [{type: "websocket-client", config: {address: "wss://example.unyt.land"}}]
}

/**
 * The default instance of the Datex runtime.
 */
export const Datex: Runtime = await Runtime.create(defaultConfig);
