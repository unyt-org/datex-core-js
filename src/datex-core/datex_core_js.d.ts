// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

export function create_runtime(config: string, debug_flags: any): JSRuntime;
/**
 * Executes a Datex script and returns true when execution was successful.
 * Does not return the result of the script, but only indicates success or failure.
 */
export function execute_internal(datex_script: string): boolean;
export function compile(datex_script: string): void;
/**
 * Executes a Datex script and returns the result as a string.
 */
export function execute(datex_script: string, formatted: boolean): string;

type WebSocketServerInterfaceSetupData = {
    port: number;
};

type BaseInterfaceSetupData = {
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

type WebSocketClientInterfaceSetupData = {
    address: string;
};

export class BaseJSInterface {
    private constructor();
    free(): void;
}
export class JSComHub {
    private constructor();
    free(): void;
    websocket_server_interface_add_socket(
        interface_uuid: string,
        websocket: WebSocket,
    ): string;
    base_interface_register_socket(uuid: string, direction: string): string;
    base_interface_test_send_block(
        uuid: string,
        socket_uuid: string,
        data: Uint8Array,
    ): Promise<boolean>;
    base_interface_receive(
        uuid: string,
        socket_uuid: string,
        data: Uint8Array,
    ): void;
    base_interface_on_send(uuid: string, func: Function): void;
    base_interface_destroy_socket(uuid: string, socket_uuid: string): void;
    get_metadata_string(): string;
    get_trace_string(endpoint: string): Promise<string | undefined>;
    register_default_interface_factories(): void;
    close_interface(interface_uuid: string): Promise<any>;
    create_interface(interface_type: string, properties: string): Promise<any>;
    update(): Promise<void>;
    _drain_incoming_blocks(): Uint8Array[];
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
}
export class JSMemory {
    private constructor();
    free(): void;
    get_pointer_by_id(address: Uint8Array): JSPointer | undefined;
}
export class JSPointer {
    private constructor();
    free(): void;
}
export class JSRuntime {
    private constructor();
    free(): void;
    static value_to_string(dif_value: any, decompile_options: any): string;
    crypto_test_tmp(): Promise<Promise<any>>;
    execute_sync_with_string_result(
        script: string,
        dif_values: any[] | null | undefined,
        decompile_options: any,
    ): string;
    execute_sync(script: string, dif_values?: any[] | null): any;
    execute(script: string, dif_values?: any[] | null): Promise<any>;
    _stop(): Promise<void>;
    _create_block(
        body: Uint8Array | null | undefined,
        receivers: string[],
    ): Uint8Array;
    execute_with_string_result(
        script: string,
        dif_values: any[] | null | undefined,
        decompile_options: any,
    ): Promise<string>;
    start(): Promise<void>;
    readonly endpoint: string;
    readonly version: string;
    com_hub: JSComHub;
    memory: JSMemory;
}
export class WebRTCRegistry {
    private constructor();
    free(): void;
    add_ice_candidate(
        interface_uuid: string,
        candidate: Uint8Array,
    ): Promise<void>;
    register(endpoint: string): Promise<string>;
    set_answer(interface_uuid: string, answer: Uint8Array): Promise<void>;
    wait_for_connection(interface_uuid: string): Promise<void>;
    create_offer(interface_uuid: string): Promise<Uint8Array>;
    set_on_ice_candidate(
        interface_uuid: string,
        on_ice_candidate: Function,
    ): void;
    create_answer(
        interface_uuid: string,
        offer: Uint8Array,
    ): Promise<Uint8Array>;
    close(interface_uuid: string): Promise<any>;
}
export class WebSocketServerRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
}
