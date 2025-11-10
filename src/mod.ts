/**
 * @module mod.ts
 * @description
 * This module exports all public APIs of the DATEX runtime.
 */

export * from "./runtime/runtime.ts";
/**
 * @namespace DIF
 * @description
 * This namespace contains all modules related to the DIF (DATEX Interchange Format) interfaces of the DATEX runtime.
 */
export * as DIF from "./dif/mod.ts";
/**
 * @namespace Network
 * @description
 * This namespace contains all modules related to the network interfaces of the DATEX runtime.
 */
export * as Network from "./network/mod.ts";
