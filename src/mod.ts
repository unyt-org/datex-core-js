/**
 * @module mod.ts
 * @description
 * This modules exports a instance of the DATEX runtime.
 */

import { Runtime } from "./runtime/runtime.ts";

/**
 * The default instance of the Datex runtime.
 */
export const Datex: Runtime = await Runtime.create({ endpoint: "@unyt" });
