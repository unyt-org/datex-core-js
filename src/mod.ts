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
    interfaces: [{
        type: "websocket-client",
        config: { address: "wss://example.unyt.land" },
    }],
    debug: false, // set to true to show info/debug messages
};

/**
 * The default instance of the Datex runtime.
 */
export const Datex: Runtime = await Runtime.create(defaultConfig, {
    allow_unsigned_blocks: true,
});

// try {
//     console.log(
//         "@example responded with:",
//         await Datex.execute("@example :: 'Hello, World!'"),
//     );
// } catch (error) {
//     console.error("Could not reach @example", error);
// }
