// dnt-shim-ignore
export const isNodeOrBun = !globalThis.Deno &&
    // @ts-ignore
    (typeof globalThis.process !== "undefined") &&
    // @ts-ignore
    (typeof globalThis.process.versions.node !== "undefined");
