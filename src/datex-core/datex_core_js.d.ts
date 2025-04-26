// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

export function init_runtime(endpoint: string): JSRuntime;
export function compile(datex_script: string): void;
export function decompile(
    dxb: Uint8Array,
    formatted: boolean,
    colorized: boolean,
    resolve_slots: boolean,
): string;
export class BaseJSInterface {
    free(): void;
    constructor(com_hub: JSComHub, name: string);
    test_send_block(socket_uuid: string, data: Uint8Array): Promise<boolean>;
    on_send(func: Function): void;
    register_socket(direction: string): string;
    destroy_socket(socket_uuid: string): void;
    receive(socket_uuid: string, data: Uint8Array): Promise<void>;
    readonly uuid: string;
}
export class JSComHub {
    private constructor();
    free(): void;
    close_interface(interface_uuid: string): Promise<any>;
    _update(): Promise<void>;
    readonly websocket_server: WebSocketServerRegistry;
    readonly websocket_client: WebSocketClientRegistry;
    readonly serial: SerialRegistry;
    readonly webrtc: WebRTCClientRegistry;
    readonly _incoming_blocks: Uint8Array[];
}
export class JSMemory {
    private constructor();
    free(): void;
    get_pointer_by_id(address: Uint8Array): JSPointer | undefined;
    get_pointer_ids(): Uint8Array[];
}
export class JSPointer {
    private constructor();
    free(): void;
}
export class JSRuntime {
    private constructor();
    free(): void;
    crypto_test_tmp(): Promise<Promise<any>>;
    _create_block(
        body: Uint8Array | null | undefined,
        receivers: string[],
    ): Uint8Array;
    readonly version: string;
    readonly memory: JSMemory;
    readonly endpoint: string;
    readonly com_hub: JSComHub;
}
export class SerialRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(baud_rate: number): Promise<string>;
}
export class WebRTCClientRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(address: string): Promise<Promise<any>>;
}
export class WebSocketClientRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(address: string): Promise<Promise<any>>;
}
export class WebSocketServerRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(): string;
    add_socket(interface_uuid: string, websocket: WebSocket): any;
}
