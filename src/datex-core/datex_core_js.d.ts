// @generated file from wasmbuild -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

export function create_runtime(config: string, debug_flags: any): JSRuntime;
/**
 * Executes a Datex script and returns true when execution was successful.
 * Does not return the result of the script, but only indicates success or failure.
 */
export function execute_internal(datex_script: string): boolean;
/**
 * Executes a Datex script and returns the result as a string.
 */
export function execute(datex_script: string, formatted: boolean): string;
export interface WebRTCInterfaceSetupData {
    peer_endpoint: string;
    ice_servers: RTCIceServer[] | null;
}

export type BaseInterfaceSetupData = InterfaceProperties;

export interface WebSocketServerInterfaceSetupData {
    port: number;
    /**
     * if true, the server will use wss (secure WebSocket). Defaults to true.
     */
    secure: boolean | null;
}

export interface WebSocketClientInterfaceSetupData {
    address: string;
}

export interface RTCIceServer {
    urls: string[];
    username: string | null;
    credential: string | null;
}

export type ReconnectionConfig = "NoReconnect" | "InstantReconnect" | {
    ReconnectWithTimeout: { timeout: { secs: number; nanos: number } };
} | {
    ReconnectWithTimeoutAndAttempts: {
        timeout: { secs: number; nanos: number };
        attempts: number;
    };
};

export type InterfaceDirection = "In" | "Out" | "InOut";

export interface InterfaceProperties {
    /**
     * the type of the interface, by which it is identified
     * e.g. \"tcp-client\", \"websocket-server\",
     * multiple interfaces implementations (e.g. for native and web)
     * can have the same interface type if they are compatible and
     * have an identical initialization function
     */
    interface_type: string;
    /**
     * the channel that the interface is using,
     * e.g. \"tcp\", \"websocket\
     */
    channel: string;
    /**
     * a unique name that further identifies an interface instance
     * e.g. \"wss://example.com:443\
     */
    name: string | null;
    /**
     * The support message direction of the interface
     */
    direction: InterfaceDirection;
    /**
     * Estimated mean latency for this interface type in milliseconds (round trip time).
     * Lower latency interfaces are preferred over higher latency channels
     */
    round_trip_time: number;
    /**
     * Bandwidth in bytes per second
     */
    max_bandwidth: number;
    /**
     * If true, the interface does support continuous connections
     */
    continuous_connection: boolean;
    /**
     * If true, the interface can be used to redirect DATEX messages to other endpoints
     * which are not directly connected to the interface (default: true)
     * Currently only enforced for broadcast messages
     */
    allow_redirects: boolean;
    /**
     * If true, the interface is a secure channel (can not be eavesdropped).
     * This might be an already encrypted channel such as WebRTC or a channel
     * that is end-to-end and not interceptable by third parties
     */
    is_secure_channel: boolean;
    reconnection_config: ReconnectionConfig;
    /**
     * Timestamp of the interface close event
     * This is used to determine if the interface shall be reopened
     */
    close_timestamp: number | null;
    /**
     * Number of reconnection attempts already made
     * This is used to determine if the interface shall be reopened
     * and if the interface shall be destroyed
     */
    reconnect_attempts: number | null;
}

export interface SerialInterfaceSetupData {
    port_name: string | null;
    baud_rate: number;
}

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
    webrtc_interface_create_answer(
        interface_uuid: string,
        offer: Uint8Array,
    ): Promise<Uint8Array>;
    webrtc_interface_add_ice_candidate(
        interface_uuid: string,
        candidate: Uint8Array,
    ): Promise<void>;
    webrtc_interface_create_offer(interface_uuid: string): Promise<Uint8Array>;
    webrtc_interface_wait_for_connection(interface_uuid: string): Promise<void>;
    webrtc_interface_set_on_ice_candidate(
        interface_uuid: string,
        on_ice_candidate: Function,
    ): void;
    webrtc_interface_set_answer(
        interface_uuid: string,
        answer: Uint8Array,
    ): Promise<void>;
    base_interface_receive(
        uuid: string,
        socket_uuid: string,
        data: Uint8Array,
    ): void;
    base_interface_on_send(uuid: string, func: Function): void;
    base_interface_destroy_socket(uuid: string, socket_uuid: string): void;
    base_interface_test_send_block(
        uuid: string,
        socket_uuid: string,
        data: Uint8Array,
    ): Promise<boolean>;
    base_interface_register_socket(uuid: string, direction: string): string;
    update(): Promise<void>;
    register_default_interface_factories(): void;
    get_metadata_string(): string;
    _drain_incoming_blocks(): Uint8Array[];
    register_incoming_block_interceptor(callback: Function): void;
    create_interface(interface_type: string, properties: string): Promise<any>;
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
    get_trace_string(endpoint: string): Promise<string | undefined>;
    close_interface(interface_uuid: string): Promise<any>;
    register_outgoing_block_interceptor(callback: Function): void;
}
export class JSPointer {
    private constructor();
    free(): void;
}
export class JSRuntime {
    private constructor();
    free(): void;
    value_to_string(dif_value: any, decompile_options: any): string;
    crypto_test_tmp(): Promise<Promise<any>>;
    execute_sync_with_string_result(
        script: string,
        dif_values: any[] | null | undefined,
        decompile_options: any,
    ): string;
    execute(script: string, dif_values?: any[] | null): Promise<any>;
    _stop(): Promise<void>;
    execute_sync(script: string, dif_values?: any[] | null): any;
    execute_with_string_result(
        script: string,
        dif_values: any[] | null | undefined,
        decompile_options: any,
    ): Promise<string>;
    start(): Promise<void>;
    /**
     * Get a handle to the DIF interface of the runtime
     */
    dif(): RuntimeDIFHandle;
    _create_block(
        body: Uint8Array | null | undefined,
        receivers: string[],
    ): Uint8Array;
    /**
     * Start the LSP server, returning a JS function to send messages to Rust
     */
    start_lsp(send_to_js: Function): Function;
    com_hub: JSComHub;
    readonly endpoint: string;
    readonly version: string;
}
export class RuntimeDIFHandle {
    private constructor();
    free(): void;
    /**
     * Resolve a pointer address synchronously if it's in memory, otherwise return an error
     */
    resolve_pointer_address_sync(address: string): any;
    observe_pointer(
        transceiver_id: number,
        address: string,
        observe_options: any,
        callback: Function,
    ): number;
    unobserve_pointer(address: string, observer_id: number): void;
    apply(callee: any, value: any): any;
    create_pointer(value: any, allowed_type: any, mutability: number): string;
    update_observer_options(
        address: string,
        observer_id: number,
        observe_options: any,
    ): void;
    update(transceiver_id: number, address: string, update: any): void;
    /**
     * Resolve a pointer address, returning a Promise
     * If the pointer is in memory, the promise resolves immediately
     * If the pointer is not in memory, it will be loaded first
     */
    resolve_pointer_address(address: string): any;
}
export class WebSocketServerRegistry {
    private constructor();
    free(): void;
    close(interface_uuid: string): Promise<any>;
}
