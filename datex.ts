// all Datex.*
import * as DATEX from "./datex_all.ts";
export {DATEX};

// @ts-ignore global DATEX collision check
if (globalThis.DATEX) throw new Error(`The unyt core library was imported more than once from different sources (v${DATEX.Runtime.VERSION} from ${Datex.libURL} and v${globalThis.DATEX.Runtime.VERSION} from ${globalThis.DATEX.libURL}). Check your imports!`)
// @ts-ignore expose global DATEX
globalThis.DATEX = DATEX;

// // shortcut methods ($$, string, int, ...)
// export * from "./datex_short.ts";
// // decorators
// export * from "./js_adapter/legacy_decorators.ts";