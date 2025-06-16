// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

export function init_runtime(endpoint: string, debug_flags: any): JSRuntime;
export function compile(datex_script: string): void;
export function execute(datex_script: string, formatted: boolean): string;

type InterfaceProperties = {
    name?: string;
    interface_type: string;
    channel: string;
    direction: "In" | "Out" | "InOut";
    round_trip_time: number;
    max_bandwidth: number;
    continuous_connection: boolean;
    allow_redirects: boolean;
    is_secure_channel: boolean;
    reconnect_attempts?: number;
    reconnection_config:
        | "NoReconnect"
        | "InstantReconnect"
        | {
            ReconnectWithTimeout: {
                timeout: number;
            };
        }
        | {
            ReconnectWithTimeoutAndAttempts: {
                timeout: number;
                attempts: number;
            };
        };
};

export class BaseJSInterface {
    free(): void;
    constructor(
        com_hub: JSComHub,
        name_or_properties: InterfaceProperties | string,
    );
    test_send_block(socket_uuid: string, data: Uint8Array): Promise<boolean>;
    on_send(func: Function): void;
    register_socket(direction: string): string;
    destroy_socket(socket_uuid: string): void;
    receive(socket_uuid: string, data: Uint8Array): Promise<void>;
    readonly properties: InterfaceProperties;
    readonly uuid: string;
}
export class JSComHub {
    private constructor();
    free(): void;
    close_interface(interface_uuid: string): Promise<any>;
    start_update_loop(): void;
    stop_update_loop(): Promise<void>;
    update(): Promise<void>;
    /**
     * Send a block to the given interface and socket
     * This does not involve the routing on the ComHub level.
     * The socket UUID is used to identify the socket to send the block over
     * The interface UUID is used to identify the interface to send the block over
     */
    send_block(
        block: Uint8Array,
        interface_uuid: string,
        socket_uuid: string,
    ): Promise<boolean>;
    _drain_incoming_blocks(): Uint8Array[];
    readonly websocket_server: WebSocketServerRegistry;
    readonly websocket_client: WebSocketClientRegistry;
    readonly serial: SerialRegistry;
    readonly webrtc: WebRTCRegistry;
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
export class WebRTCRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(endpoint: string): Promise<string>;
    create_offer(interface_uuid: string): Promise<Uint8Array>;
    create_answer(
        interface_uuid: string,
        offer: Uint8Array,
    ): Promise<Uint8Array>;
    set_answer(interface_uuid: string, answer: Uint8Array): Promise<void>;
    set_on_ice_candidate(
        interface_uuid: string,
        on_ice_candidate: Function,
    ): void;
    add_ice_candidate(
        interface_uuid: string,
        candidate: Uint8Array,
    ): Promise<void>;
    wait_for_connection(interface_uuid: string): Promise<void>;
}
export class WebSocketClientRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(address: string): Promise<string>;
}
export class WebSocketServerRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
    register(): Promise<string>;
    add_socket(interface_uuid: string, websocket: WebSocket): any;
}
