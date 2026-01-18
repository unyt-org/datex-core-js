import type { JSComHub } from "../datex-core/datex_core_js.d.ts";
import { ComInterface, type ComInterfaceImpl } from "./com-interface.ts";
import type { DIFValue } from "../dif/definitions.ts";
import type { InterfaceProperties } from "../datex-core.ts";
import type { Runtime } from "../runtime/runtime.ts";

/**
 * Communication hub for managing communication interfaces.
 */
export class ComHub {
    /** The JS communication hub. */
    readonly #jsComHub: JSComHub;
    readonly #runtime: Runtime;
    readonly #interfaces = new Map<
        string,
        ComInterface<ComInterfaceImpl<unknown>>
    >();

    constructor(jsComHub: JSComHub, runtime: Runtime) {
        this.#jsComHub = jsComHub;
        this.#runtime = runtime;
    }

    /**
     * Registers a communication interface implementation.
     * @param interfaceType The type of the interface.
     * @param impl The implementation class of the interface.
     */
    // TODO
    registerInterfaceImpl<N extends string>(
        interfaceType: N,
        impl: typeof ComInterface,
    ) {
        this.registerInterfaceFactory(
            interfaceType,
            (uuid: string, setupData: unknown) => {
                const instance = new (impl as (new (
                    uuid: string,
                    setupData: unknown,
                    jsComHub: JSComHub,
                ) => ComInterface))(
                    uuid,
                    setupData,
                    this.#jsComHub,
                );
                this.#interfaces.set(
                    instance.uuid,
                    new ComInterface(instance.uuid, instance, jsComHub),
                );
                return {
                    uuid: instance.uuid,
                    impl: instance,
                };
            },
        );
    }

    registerInterfaceFactory<SetupData>(
        interface_type: string,
        factory: (
            uuid: string,
            setup_data: SetupData,
        ) => InterfaceProperties | Promise<InterfaceProperties>,
    ) {
        this.#jsComHub.register_interface_factory(
            interface_type,
            async (setup_data: DIFValue) => {
                return factory(
                    await this.#runtime.dif.resolveDIFValue<SetupData>(
                        setup_data,
                    ),
                );
            },
        );
    }

    /**
     * Creates a new communication interface.
     * @param interfaceType The type of the interface to create.
     * @param setupData The setup data for the interface.
     */
    async createInterface<T extends typeof ComInterfaceImpl<unknown>>(
        interfaceType: T,
        setupData: T extends typeof ComInterfaceImpl<infer P> ? P : never,
    ): Promise<ComInterface<InstanceType<T>>>;
    async createInterface<
        T extends ComInterfaceImpl<unknown>,
    >(
        interfaceType: string,
        setupData: T extends ComInterfaceImpl<infer P> ? P : never,
    ): Promise<ComInterface<T>>;

    async createInterface(
        type: string,
        setupData: unknown,
    ): Promise<ComInterface<ComInterfaceImpl<unknown>>> {
        const uuid = await this.#jsComHub.create_interface(
            type,
            JSON.stringify(setupData),
        );
        return this.#interfaces.get(uuid)!;
    }

    /**
     * Prints the metadata of the ComHub. Only available in debug builds.
     */
    public printMetadata(): void {
        // as any required because get_metadata_string only exists in debug builds
        // deno-lint-ignore no-explicit-any
        const metadata = (this.#jsComHub as any).get_metadata_string();
        console.log(metadata);
    }

    /**
     * Prints the trace for a specific endpoint. Only available in debug builds.
     * @param endpoint The endpoint for which to print the trace.
     */
    public async printTrace(endpoint: string): Promise<void> {
        // as any required because get_trace_string only exists in debug builds
        // deno-lint-ignore no-explicit-any
        const trace = await (this.#jsComHub as any).get_trace_string(endpoint);
        if (trace === undefined) {
            console.warn(`No trace available for endpoint: ${endpoint}`);
            return;
        }
        console.log(trace);
    }

    /**
     * @deprecated Use sender of interface instead.
     * Sends a block of data to a specific interface and socket.
     * @param block The data block to send.
     * @param interface_uuid The UUID of the interface to send the block to.
     * @param socket_uuid The UUID of the socket to send the block to.
     * @returns A promise that resolves to true if the block was sent successfully, false otherwise.
     */
    public sendBlock(
        block: Uint8Array,
        interface_uuid: string,
        socket_uuid: string,
    ) {
        this.#jsComHub.send_block(block, interface_uuid, socket_uuid);
    }

    /**
     * Registers a callback to intercept incoming blocks.
     * @param callback The callback to be invoked for each incoming block.
     */
    public registerIncomingBlockInterceptor(
        callback: (block: Uint8Array, socket_uuid: string) => void,
    ): void {
        this.#jsComHub.register_incoming_block_interceptor(callback);
    }

    /**
     * Registers a callback to intercept outgoing blocks.
     * @param callback The callback to be invoked for each outgoing block.
     */
    public registerOutgoingBlockInterceptor(
        callback: (
            block: Uint8Array,
            socket_uuid: string,
            endpoints: string[],
        ) => void,
    ): void {
        this.#jsComHub.register_outgoing_block_interceptor(callback);
    }
}
