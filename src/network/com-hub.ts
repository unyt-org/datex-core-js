import type { JSComHub } from "../datex-core/datex_core_js.d.ts";
import { ComInterface, type ComInterfaceImpl } from "./com-interface.ts";

/**
 * Communication hub for managing communication interfaces.
 */
export class ComHub {
    /** Static map of registered interface implementations. */
    static #interfaceImpls = new Map<
        string,
        typeof ComInterfaceImpl<unknown>
    >();

    /** Static map of interface implementations by class. */
    static #interfaceImplsByClass = new Map<
        typeof ComInterfaceImpl<unknown>,
        string
    >();

    /** The JS communication hub. */
    readonly #jsComHub: JSComHub;

    constructor(jsComHub: JSComHub) {
        this.#jsComHub = jsComHub;
    }

    /**
     * Registers a communication interface implementation.
     * @param interfaceType The type of the interface.
     * @param impl The implementation class of the interface.
     */
    static registerInterfaceImpl<N extends string>(
        interfaceType: N,
        impl: typeof ComInterfaceImpl<unknown>,
    ) {
        if (this.#interfaceImpls.has(interfaceType)) {
            throw new Error(
                `Interface implementation for ${interfaceType} already registered.`,
            );
        }
        this.#interfaceImpls.set(interfaceType, impl);
        this.#interfaceImplsByClass.set(impl, interfaceType);
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
        interfaceType: string | typeof ComInterfaceImpl,
        setupData: unknown,
    ): Promise<ComInterface<ComInterfaceImpl<unknown>>> {
        const type = typeof interfaceType === "string"
            ? interfaceType
            : ComHub.#interfaceImplsByClass.get(interfaceType);
        if (type === undefined) {
            throw new Error(
                `Interface implementation for ${(interfaceType as typeof ComInterfaceImpl).name
                } not registered.`,
            );
        }
        const implClass = ComHub.#interfaceImpls.get(type);
        if (implClass === undefined) {
            throw new Error(
                `Interface implementation for ${type} not registered.`,
            );
        }
        const uuid = await this.#jsComHub.create_interface(
            type,
            JSON.stringify(setupData),
        );
        const impl = new (implClass as (new (
            uuid: string,
            setupData: unknown,
            comHub: JSComHub,
        ) => ComInterfaceImpl<unknown>))(uuid, setupData, this.#jsComHub);
        await impl.init?.();
        return new ComInterface(uuid, impl, this.#jsComHub);
    }

    public _update(): Promise<void> {
        return this.#jsComHub.update();
    }

    public _drain_incoming_blocks(): Uint8Array<ArrayBufferLike>[] {
        return this.#jsComHub._drain_incoming_blocks();
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
    ): Promise<boolean> {
        return this.#jsComHub.send_block(block, interface_uuid, socket_uuid);
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
