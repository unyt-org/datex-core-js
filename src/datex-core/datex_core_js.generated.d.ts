// deno-lint-ignore-file
// deno-fmt-ignore-file

export interface InstantiateResult {
  instance: WebAssembly.Instance;
  exports: {
    init_runtime: typeof init_runtime;
    compile: typeof compile;
    decompile: typeof decompile;
    JSRuntime : typeof JSRuntime 
  };
}

/** Gets if the Wasm module has been instantiated. */
export function isInstantiated(): boolean;

/** Options for instantiating a Wasm instance. */
export interface InstantiateOptions {
  /** Optional url to the Wasm file to instantiate. */
  url?: URL;
  /** Callback to decompress the raw Wasm file bytes before instantiating. */
  decompress?: (bytes: Uint8Array) => Uint8Array;
}

/** Instantiates an instance of the Wasm module returning its functions.
* @remarks It is safe to call this multiple times and once successfully
* loaded it will always return a reference to the same object. */
export function instantiate(opts?: InstantiateOptions): Promise<InstantiateResult["exports"]>;

/** Instantiates an instance of the Wasm module along with its exports.
 * @remarks It is safe to call this multiple times and once successfully
 * loaded it will always return a reference to the same object. */
export function instantiateWithInstance(opts?: InstantiateOptions): Promise<InstantiateResult>;

/**
* @returns {JSRuntime}
*/
export function init_runtime(): JSRuntime;
/**
* @param {string} datex_script
*/
export function compile(datex_script: string): void;
/**
* @param {Uint8Array} dxb
* @param {boolean} formatted
* @param {boolean} colorized
* @param {boolean} resolve_slots
* @returns {string}
*/
export function decompile(dxb: Uint8Array, formatted: boolean, colorized: boolean, resolve_slots: boolean): string;
/**
*/
export class JSRuntime {
  free(): void;
/**
*/
  readonly version: string;
}
