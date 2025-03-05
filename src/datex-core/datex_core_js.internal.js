// @generated file from wasmbuild -- do not edit
// @ts-nocheck: generated
// deno-lint-ignore-file
// deno-fmt-ignore-file

let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_export_2.set(idx, obj);
    return idx;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

let WASM_VECTOR_LEN = 0;

let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (
        cachedUint8ArrayMemory0 === null ||
        cachedUint8ArrayMemory0.byteLength === 0
    ) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

const lTextEncoder = typeof TextEncoder === "undefined"
    ? (0, module.require)("util").TextEncoder
    : TextEncoder;

let cachedTextEncoder = new lTextEncoder("utf-8");

const encodeString = typeof cachedTextEncoder.encodeInto === "function"
    ? function (arg, view) {
        return cachedTextEncoder.encodeInto(arg, view);
    }
    : function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length,
        };
    };

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

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
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedDataViewMemory0 = null;

function getDataViewMemory0() {
    if (
        cachedDataViewMemory0 === null ||
        cachedDataViewMemory0.buffer.detached === true ||
        (cachedDataViewMemory0.buffer.detached === undefined &&
            cachedDataViewMemory0.buffer !== wasm.memory.buffer)
    ) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

const lTextDecoder = typeof TextDecoder === "undefined"
    ? (0, module.require)("util").TextDecoder
    : TextDecoder;

let cachedTextDecoder = new lTextDecoder("utf-8", {
    ignoreBOM: true,
    fatal: true,
});

cachedTextDecoder.decode();

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(
        getUint8ArrayMemory0().subarray(ptr, ptr + len),
    );
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((state) => {
        wasm.__wbindgen_export_5.get(state.dtor)(state.a, state.b);
    });

function makeMutClosure(arg0, arg1, dtor, f) {
    const state = { a: arg0, b: arg1, cnt: 1, dtor };
    const real = (...args) => {
        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            if (--state.cnt === 0) {
                wasm.__wbindgen_export_5.get(state.dtor)(a, state.b);
                CLOSURE_DTORS.unregister(state);
            } else {
                state.a = a;
            }
        }
    };
    real.original = state;
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == "number" || type == "boolean" || val == null) {
        return `${val}`;
    }
    if (type == "string") {
        return `"${val}"`;
    }
    if (type == "symbol") {
        const description = val.description;
        if (description == null) {
            return "Symbol";
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == "function") {
        const name = val.name;
        if (typeof name == "string" && name.length > 0) {
            return `Function(${name})`;
        } else {
            return "Function";
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = "[";
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for (let i = 1; i < length; i++) {
            debug += ", " + debugString(val[i]);
        }
        debug += "]";
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == "Object") {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return "Object(" + JSON.stringify(val) + ")";
        } catch (_) {
            return "Object";
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_export_2.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * @returns {JSRuntime}
 */
export function init_runtime() {
    const ret = wasm.init_runtime();
    return JSRuntime.__wrap(ret);
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
        const ptr0 = passArray8ToWasm0(dxb, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.decompile(
            ptr0,
            len0,
            formatted,
            colorized,
            resolve_slots,
        );
        deferred2_0 = ret[0];
        deferred2_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred2_0, deferred2_1, 1);
    }
}

function __wbg_adapter_24(arg0, arg1, arg2) {
    wasm.closure9_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_27(arg0, arg1) {
    wasm._dyn_core__ops__function__FnMut_____Output___R_as_wasm_bindgen__closure__WasmClosure___describe__invoke__h94f274bb6d83b5b5(
        arg0,
        arg1,
    );
}

function __wbg_adapter_32(arg0, arg1, arg2) {
    wasm.closure74_externref_shim(arg0, arg1, arg2);
}

function __wbg_adapter_77(arg0, arg1, arg2, arg3) {
    wasm.closure87_externref_shim(arg0, arg1, arg2, arg3);
}

const __wbindgen_enum_BinaryType = ["blob", "arraybuffer"];

const JSComHubFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_jscomhub_free(ptr >>> 0, 1));

export class JSComHub {
    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(JSComHub.prototype);
        obj.__wbg_ptr = ptr;
        JSComHubFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        JSComHubFinalization.unregister(this);
        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_jscomhub_free(ptr, 0);
    }
    /**
     * @param {string} address
     * @returns {Promise<any>}
     */
    add_ws_interface(address) {
        const ptr0 = passStringToWasm0(
            address,
            wasm.__wbindgen_malloc,
            wasm.__wbindgen_realloc,
        );
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.jscomhub_add_ws_interface(this.__wbg_ptr, ptr0, len0);
        return ret;
    }
    _update() {
        wasm.jscomhub__update(this.__wbg_ptr);
    }
    /**
     * @returns {Uint8Array[]}
     */
    get _incoming_blocks() {
        const ret = wasm.jscomhub__incoming_blocks(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}

const JSMemoryFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) => wasm.__wbg_jsmemory_free(ptr >>> 0, 1));

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
        wasm.__wbg_jsmemory_free(ptr, 0);
    }
    /**
     * @param {Uint8Array} address
     * @returns {JSPointer | undefined}
     */
    get_pointer_by_id(address) {
        const ret = wasm.jsmemory_get_pointer_by_id(this.__wbg_ptr, address);
        return ret === 0 ? undefined : JSPointer.__wrap(ret);
    }
    /**
     * @returns {Uint8Array[]}
     */
    get_pointer_ids() {
        const ret = wasm.jsmemory_get_pointer_ids(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}

const JSPointerFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) =>
        wasm.__wbg_jspointer_free(ptr >>> 0, 1)
    );

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
        wasm.__wbg_jspointer_free(ptr, 0);
    }
}

const JSRuntimeFinalization = (typeof FinalizationRegistry === "undefined")
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry((ptr) =>
        wasm.__wbg_jsruntime_free(ptr >>> 0, 1)
    );

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
        wasm.__wbg_jsruntime_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    get version() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.jsruntime_version(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
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
    /**
     * @returns {JSComHub}
     */
    get com_hub() {
        const ret = wasm.jsruntime_com_hub(this.__wbg_ptr);
        return JSComHub.__wrap(ret);
    }
    /**
     * @param {Uint8Array | null} [body]
     * @returns {Uint8Array}
     */
    _create_block(body) {
        var ptr0 = isLikeNone(body)
            ? 0
            : passArray8ToWasm0(body, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        const ret = wasm.jsruntime__create_block(this.__wbg_ptr, ptr0, len0);
        var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
        wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        return v2;
    }
}

export function __wbg_buffer_609cc3eee51ed158(arg0) {
    const ret = arg0.buffer;
    return ret;
}

export function __wbg_call_672a4d21634d4a24() {
    return handleError(function (arg0, arg1) {
        const ret = arg0.call(arg1);
        return ret;
    }, arguments);
}

export function __wbg_call_7cccdd69e0791ae2() {
    return handleError(function (arg0, arg1, arg2) {
        const ret = arg0.call(arg1, arg2);
        return ret;
    }, arguments);
}

export function __wbg_data_432d9c3df2630942(arg0) {
    const ret = arg0.data;
    return ret;
}

export function __wbg_instanceof_ArrayBuffer_e14585432e3737fc(arg0) {
    let result;
    try {
        result = arg0 instanceof ArrayBuffer;
    } catch (_) {
        result = false;
    }
    const ret = result;
    return ret;
}

export function __wbg_length_a446193dc22c12f8(arg0) {
    const ret = arg0.length;
    return ret;
}

export function __wbg_log_c222819a41e063d3(arg0) {
    console.log(arg0);
}

export function __wbg_message_d1685a448ba00178(arg0, arg1) {
    const ret = arg1.message;
    const ptr1 = passStringToWasm0(
        ret,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
    );
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}

export function __wbg_new_23a2665fac83c611(arg0, arg1) {
    try {
        var state0 = { a: arg0, b: arg1 };
        var cb0 = (arg0, arg1) => {
            const a = state0.a;
            state0.a = 0;
            try {
                return __wbg_adapter_77(a, state0.b, arg0, arg1);
            } finally {
                state0.a = a;
            }
        };
        const ret = new Promise(cb0);
        return ret;
    } finally {
        state0.a = state0.b = 0;
    }
}

export function __wbg_new_92c54fc74574ef55() {
    return handleError(function (arg0, arg1) {
        const ret = new WebSocket(getStringFromWasm0(arg0, arg1));
        return ret;
    }, arguments);
}

export function __wbg_new_a12002a7f91c75be(arg0) {
    const ret = new Uint8Array(arg0);
    return ret;
}

export function __wbg_newnoargs_105ed471475aaf50(arg0, arg1) {
    const ret = new Function(getStringFromWasm0(arg0, arg1));
    return ret;
}

export function __wbg_newwithbyteoffsetandlength_d97e637ebe145a9a(
    arg0,
    arg1,
    arg2,
) {
    const ret = new Uint8Array(arg0, arg1 >>> 0, arg2 >>> 0);
    return ret;
}

export function __wbg_newwithlength_a381634e90c276d4(arg0) {
    const ret = new Uint8Array(arg0 >>> 0);
    return ret;
}

export function __wbg_queueMicrotask_97d92b4fcc8a61c5(arg0) {
    queueMicrotask(arg0);
}

export function __wbg_queueMicrotask_d3219def82552485(arg0) {
    const ret = arg0.queueMicrotask;
    return ret;
}

export function __wbg_resolve_4851785c9c5f573d(arg0) {
    const ret = Promise.resolve(arg0);
    return ret;
}

export function __wbg_send_fc0c204e8a1757f4() {
    return handleError(function (arg0, arg1, arg2) {
        arg0.send(getArrayU8FromWasm0(arg1, arg2));
    }, arguments);
}

export function __wbg_set_65595bdd868b3009(arg0, arg1, arg2) {
    arg0.set(arg1, arg2 >>> 0);
}

export function __wbg_setbinaryType_92fa1ffd873b327c(arg0, arg1) {
    arg0.binaryType = __wbindgen_enum_BinaryType[arg1];
}

export function __wbg_setonclose_14fc475a49d488fc(arg0, arg1) {
    arg0.onclose = arg1;
}

export function __wbg_setonerror_8639efe354b947cd(arg0, arg1) {
    arg0.onerror = arg1;
}

export function __wbg_setonmessage_6eccab530a8fb4c7(arg0, arg1) {
    arg0.onmessage = arg1;
}

export function __wbg_setonopen_2da654e1f39745d5(arg0, arg1) {
    arg0.onopen = arg1;
}

export function __wbg_static_accessor_GLOBAL_88a902d13a557d07() {
    const ret = typeof global === "undefined" ? null : global;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}

export function __wbg_static_accessor_GLOBAL_THIS_56578be7e9f832b0() {
    const ret = typeof globalThis === "undefined" ? null : globalThis;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}

export function __wbg_static_accessor_SELF_37c5d418e4bf5819() {
    const ret = typeof self === "undefined" ? null : self;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}

export function __wbg_static_accessor_WINDOW_5de37043a91a9c40() {
    const ret = typeof window === "undefined" ? null : window;
    return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
}

export function __wbg_then_44b73946d2fb3e7d(arg0, arg1) {
    const ret = arg0.then(arg1);
    return ret;
}

export function __wbindgen_cb_drop(arg0) {
    const obj = arg0.original;
    if (obj.cnt-- == 1) {
        obj.a = 0;
        return true;
    }
    const ret = false;
    return ret;
}

export function __wbindgen_closure_wrapper188(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 75, __wbg_adapter_32);
    return ret;
}

export function __wbindgen_closure_wrapper71(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 10, __wbg_adapter_24);
    return ret;
}

export function __wbindgen_closure_wrapper72(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 10, __wbg_adapter_27);
    return ret;
}

export function __wbindgen_closure_wrapper73(arg0, arg1, arg2) {
    const ret = makeMutClosure(arg0, arg1, 10, __wbg_adapter_24);
    return ret;
}

export function __wbindgen_debug_string(arg0, arg1) {
    const ret = debugString(arg1);
    const ptr1 = passStringToWasm0(
        ret,
        wasm.__wbindgen_malloc,
        wasm.__wbindgen_realloc,
    );
    const len1 = WASM_VECTOR_LEN;
    getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
    getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
}

export function __wbindgen_error_new(arg0, arg1) {
    const ret = new Error(getStringFromWasm0(arg0, arg1));
    return ret;
}

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_2;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
}

export function __wbindgen_is_function(arg0) {
    const ret = typeof arg0 === "function";
    return ret;
}

export function __wbindgen_is_undefined(arg0) {
    const ret = arg0 === undefined;
    return ret;
}

export function __wbindgen_memory() {
    const ret = wasm.memory;
    return ret;
}

export function __wbindgen_string_new(arg0, arg1) {
    const ret = getStringFromWasm0(arg0, arg1);
    return ret;
}

export function __wbindgen_throw(arg0, arg1) {
    throw new Error(getStringFromWasm0(arg0, arg1));
}
