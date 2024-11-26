// @generated file from wasmbuild -- do not edit
// @ts-nocheck: generated
// deno-lint-ignore-file
// deno-fmt-ignore-file
/// <reference types="./datex_core_js.generated.d.ts" />

// source-hash: b6d93fb83902454473c56ac4cba2637a3b7b11a9
let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) {
    return heap[idx];
}

let heap_next = heap.length;

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const cachedTextDecoder = typeof TextDecoder !== "undefined"
    ? new TextDecoder("utf-8", { ignoreBOM: true, fatal: true })
    : {
        decode: () => {
            throw Error("TextDecoder not available");
        },
    };

if (typeof TextDecoder !== "undefined") cachedTextDecoder.decode();

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}

let cachedUint32Memory0 = null;

function getUint32Memory0() {
    if (cachedUint32Memory0 === null || cachedUint32Memory0.byteLength === 0) {
        cachedUint32Memory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32Memory0;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getUint32Memory0();
    const slice = mem.subarray(ptr / 4, ptr / 4 + len);
    const result = [];
    for (let i = 0; i < slice.length; i++) {
        result.push(takeObject(slice[i]));
    }
    return result;
}
/**
 * @returns {JSRuntime}
 */
export function init_runtime() {
    const ret = wasm.init_runtime();
    return JSRuntime.__wrap(ret);
}

let WASM_VECTOR_LEN = 0;

const cachedTextEncoder = typeof TextEncoder !== "undefined"
    ? new TextEncoder("utf-8")
    : {
        encode: () => {
            throw Error("TextEncoder not available");
        },
    };

const encodeString = function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
};

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8Memory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}
/**
 * @param {string} datex_script
 */
export function compile(datex_script) {
    const ptr0 = passStringToWasm0(
        datex_script,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
    );
    const len0 = WASM_VECTOR_LEN;
    wasm.compile(ptr0, len0);
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8Memory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @param {Uint8Array} dxb
 * @param {boolean} formatted
 * @param {boolean} colorized
 * @param {boolean} resolve_slots
 * @returns {string}
 */
export function decompile(dxb, formatted, colorized, resolve_slots) {
    let deferred2_0;
    let deferred2_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(dxb, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.decompile(retptr, ptr0, len0, formatted, colorized, resolve_slots);
        var r0 = getInt32Memory0()[retptr / 4 + 0];
        var r1 = getInt32Memory0()[retptr / 4 + 1];
        deferred2_0 = r0;
        deferred2_1 = r1;
        return getStringFromWasm0(r0, r1);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

const JSMemoryFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_jsmemory_free(ptr >>> 0));
/** */
export class JSMemory {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(JSMemory.prototype);
        obj.__wbg_ptr = ptr;
        JSMemoryFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        JSMemoryFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_jsmemory_free(ptr);
    }
    /**
     * @param {Uint8Array} address
     * @returns {JSPointer | undefined}
     */
    get_pointer_by_id(address) {
        const ret = wasm.jsmemory_get_pointer_by_id(
            this.__wbg_ptr,
            addHeapObject(address),
        );
        return ret === 0 ? undefined : JSPointer.__wrap(ret);
    }
    /**
     * @returns {(Uint8Array)[]}
     */
    get_pointer_ids() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.jsmemory_get_pointer_ids(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayJsValueFromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}

const JSPointerFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_jspointer_free(ptr >>> 0));
/** */
export class JSPointer {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(JSPointer.prototype);
        obj.__wbg_ptr = ptr;
        JSPointerFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        JSPointerFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_jspointer_free(ptr);
    }
}

const JSRuntimeFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_jsruntime_free(ptr >>> 0));
/** */
export class JSRuntime {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(JSRuntime.prototype);
        obj.__wbg_ptr = ptr;
        JSRuntimeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        JSRuntimeFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_jsruntime_free(ptr);
    }
    /**
     * @returns {string}
     */
    get version() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.jsruntime_version(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {JSMemory}
     */
    get memory() {
        const ret = wasm.jsruntime_memory(this.__wbg_ptr);
        return JSMemory.__wrap(ret);
    }
}

const imports = {
    __wbindgen_placeholder__: {
        __wbindgen_object_drop_ref: function (arg0) {
            takeObject(arg0);
        },
        __wbindgen_string_new: function (arg0, arg1) {
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbg_log_5bb5f88f245d7762: function (arg0) {
            console.log(getObject(arg0));
        },
        __wbg_buffer_12d079cc21e14bdb: function (arg0) {
            const ret = getObject(arg0).buffer;
            return addHeapObject(ret);
        },
        __wbg_newwithbyteoffsetandlength_aa4a17c33a06e5cb: function (
            arg0,
            arg1,
            arg2,
        ) {
            const ret = new Uint8Array(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_new_63b92bc8671ed464: function (arg0) {
            const ret = new Uint8Array(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_set_a47bac70306a19a7: function (arg0, arg1, arg2) {
            getObject(arg0).set(getObject(arg1), arg2 >>> 0);
        },
        __wbg_length_c20a40f15020d68a: function (arg0) {
            const ret = getObject(arg0).length;
            return ret;
        },
        __wbindgen_throw: function (arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_memory: function () {
            const ret = wasm.memory;
            return addHeapObject(ret);
        },
    },
};

class WasmBuildLoader {
    #options;
    #lastLoadPromise;
    #instantiated;

    constructor(options) {
        this.#options = options;
    }

    get instance() {
        return this.#instantiated?.instance;
    }

    get module() {
        return this.#instantiated?.module;
    }

    load(
        url,
        decompress,
    ) {
        if (this.#instantiated) {
            return Promise.resolve(this.#instantiated);
        } else if (this.#lastLoadPromise == null) {
            this.#lastLoadPromise = (async () => {
                try {
                    this.#instantiated = await this.#instantiate(
                        url,
                        decompress,
                    );
                    return this.#instantiated;
                } finally {
                    this.#lastLoadPromise = undefined;
                }
            })();
        }
        return this.#lastLoadPromise;
    }

    async #instantiate(url, decompress) {
        const imports = this.#options.imports;
        if (this.#options.cache != null && url.protocol !== "file:") {
            try {
                const result = await this.#options.cache(
                    url,
                    decompress ?? ((bytes) => bytes),
                );
                if (result instanceof URL) {
                    url = result;
                    decompress = undefined; // already decompressed
                } else if (result != null) {
                    return WebAssembly.instantiate(result, imports);
                }
            } catch {
                // ignore if caching ever fails (ex. when on deploy)
            }
        }

        const isFile = url.protocol === "file:";

        // make file urls work in Node via dnt
        const isNode = globalThis.process?.versions?.node != null;
        if (isFile && typeof Deno !== "object") {
            throw new Error(
                "Loading local files are not supported in this environment",
            );
        }
        if (isNode && isFile) {
            // the deno global will be shimmed by dnt
            const wasmCode = await Deno.readFile(url);
            return WebAssembly.instantiate(
                decompress ? decompress(wasmCode) : wasmCode,
                imports,
            );
        }

        switch (url.protocol) {
            case "file:":
            case "https:":
            case "http:": {
                const wasmResponse = await fetchWithRetries(url);
                if (decompress) {
                    const wasmCode = new Uint8Array(
                        await wasmResponse.arrayBuffer(),
                    );
                    return WebAssembly.instantiate(
                        decompress(wasmCode),
                        imports,
                    );
                }
                if (
                    isFile ||
                    wasmResponse.headers.get("content-type")?.toLowerCase()
                        .startsWith("application/wasm")
                ) {
                    return WebAssembly.instantiateStreaming(
                        wasmResponse,
                        imports,
                    );
                } else {
                    return WebAssembly.instantiate(
                        await wasmResponse.arrayBuffer(),
                        imports,
                    );
                }
            }
            default:
                throw new Error(`Unsupported protocol: ${url.protocol}`);
        }
    }
}
const isNodeOrDeno = typeof Deno === "object" ||
    (typeof process !== "undefined" && process.versions != null &&
        process.versions.node != null);

const loader = new WasmBuildLoader({
    imports,
    cache: isNodeOrDeno ? cacheToLocalDir : undefined,
});

export async function instantiate(opts) {
    return (await instantiateWithInstance(opts)).exports;
}

export async function instantiateWithInstance(opts) {
    const { instance } = await loader.load(
        opts?.url ?? new URL("datex_core_js_bg.wasm", import.meta.url),
        opts?.decompress,
    );
    wasm = wasm ?? instance.exports;
    cachedInt32Memory0 = cachedInt32Memory0 ??
        new Int32Array(wasm.memory.buffer);
    cachedUint8Memory0 = cachedUint8Memory0 ??
        new Uint8Array(wasm.memory.buffer);
    return {
        instance,
        exports: getWasmInstanceExports(),
    };
}

function getWasmInstanceExports() {
    return { init_runtime, compile, decompile, JSMemory, JSPointer, JSRuntime };
}

export function isInstantiated() {
    return loader.instance != null;
}
export async function cacheToLocalDir(url, decompress) {
    const localPath = await getUrlLocalPath(url);
    if (localPath == null) {
        return undefined;
    }
    if (!await exists(localPath)) {
        const fileBytes = decompress(new Uint8Array(await getUrlBytes(url)));
        try {
            await Deno.writeFile(localPath, fileBytes);
        } catch {
            // ignore and return the wasm bytes
            return fileBytes;
        }
    }
    return toFileUrl(localPath);
}
async function getUrlLocalPath(url) {
    try {
        const dataDirPath = await getInitializedLocalDataDirPath();
        const hash = await getUrlHash(url);
        return `${dataDirPath}/${hash}.wasm`;
    } catch {
        return undefined;
    }
}
async function getInitializedLocalDataDirPath() {
    const dataDir = localDataDir();
    if (dataDir == null) {
        throw new Error(`Could not find local data directory.`);
    }
    const dirPath = `${dataDir}/deno-wasmbuild`;
    await ensureDir(dirPath);
    return dirPath;
}
async function exists(filePath) {
    try {
        await Deno.lstat(filePath);
        return true;
    } catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            return false;
        }
        throw error;
    }
}
async function ensureDir(dir) {
    try {
        const fileInfo = await Deno.lstat(dir);
        if (!fileInfo.isDirectory) {
            throw new Error(`Path was not a directory '${dir}'`);
        }
    } catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            // if dir not exists. then create it.
            await Deno.mkdir(dir, { recursive: true });
            return;
        }
        throw err;
    }
}
async function getUrlHash(url) {
    // Taken from MDN: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
    const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(url.href),
    );
    // convert buffer to byte array
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // convert bytes to hex string
    const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex;
}
async function getUrlBytes(url) {
    const response = await fetchWithRetries(url);
    return await response.arrayBuffer();
}
// the below is extracted from deno_std/path
const WHITESPACE_ENCODINGS = {
    "\u0009": "%09",
    "\u000A": "%0A",
    "\u000B": "%0B",
    "\u000C": "%0C",
    "\u000D": "%0D",
    "\u0020": "%20",
};
function encodeWhitespace(string) {
    return string.replaceAll(/[\s]/g, (c) => {
        return WHITESPACE_ENCODINGS[c] ?? c;
    });
}
function toFileUrl(path) {
    return Deno.build.os === "windows"
        ? windowsToFileUrl(path)
        : posixToFileUrl(path);
}
function posixToFileUrl(path) {
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(
        path.replace(/%/g, "%25").replace(/\\/g, "%5C"),
    );
    return url;
}
function windowsToFileUrl(path) {
    const [, hostname, pathname] = path.match(
        /^(?:[/\\]{2}([^/\\]+)(?=[/\\](?:[^/\\]|$)))?(.*)/,
    );
    const url = new URL("file:///");
    url.pathname = encodeWhitespace(pathname.replace(/%/g, "%25"));
    if (hostname != null && hostname != "localhost") {
        url.hostname = hostname;
        if (!url.hostname) {
            throw new TypeError("Invalid hostname.");
        }
    }
    return url;
}
export async function fetchWithRetries(url, maxRetries = 5) {
    let sleepMs = 250;
    let iterationCount = 0;
    while (true) {
        iterationCount++;
        try {
            const res = await fetch(url);
            if (res.ok || iterationCount > maxRetries) {
                return res;
            }
        } catch (err) {
            if (iterationCount > maxRetries) {
                throw err;
            }
        }
        console.warn(`Failed fetching. Retrying in ${sleepMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, sleepMs));
        sleepMs = Math.min(sleepMs * 2, 10000);
    }
}
// MIT License - Copyright (c) justjavac.
// https://github.com/justjavac/deno_dirs/blob/e8c001bbef558f08fd486d444af391729b0b8068/data_local_dir/mod.ts
function localDataDir() {
    switch (Deno.build.os) {
        case "linux": {
            const xdg = Deno.env.get("XDG_DATA_HOME");
            if (xdg) {
                return xdg;
            }
            const home = Deno.env.get("HOME");
            if (home) {
                return `${home}/.local/share`;
            }
            break;
        }
        case "darwin": {
            const home = Deno.env.get("HOME");
            if (home) {
                return `${home}/Library/Application Support`;
            }
            break;
        }
        case "windows":
            return Deno.env.get("LOCALAPPDATA") ?? undefined;
    }
    return undefined;
}
