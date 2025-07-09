// dnt-shim-ignore
export const isNodeOrBun = !globalThis.Deno &&
    // @ts-ignore process might be not defined
    (typeof globalThis.process !== "undefined") &&
    // @ts-ignore process.versions might be not defined
    (typeof globalThis.process.versions.node !== "undefined");
