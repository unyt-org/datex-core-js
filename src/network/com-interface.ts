import type { JSComHub } from "../datex-core/datex_core_js.d.ts";

/**
 * Abstract base class for communication interface implementations.
 */
export abstract class ComInterfaceImpl<SetupData> {
    protected readonly uuid!: string;
    protected readonly setupData!: SetupData;
    protected readonly jsComHub!: JSComHub;

    constructor(uuid: string, setupData: SetupData, jsComHub: JSComHub) {
        this.uuid = uuid;
        this.setupData = setupData;
        this.jsComHub = jsComHub;
    }
    /**
     * Initializes the communication interface.
     */
    init?(): Promise<void> | void;
    /**
     * Cleans up the communication interface.
     */
    cleanup?(): Promise<void> | void;
}

/**
 * Represents a communication interface.
 */
export class ComInterface<T extends ComInterfaceImpl<unknown>> {
    /** The UUID of the interface. */
    readonly uuid: string;

    /** The implementation of the interface. */
    readonly impl: T;

    /** The JS communication hub. */
    readonly #jsComHub: JSComHub;

    constructor(uuid: string, impl: T, jsComHub: JSComHub) {
        this.uuid = uuid;
        this.impl = impl;
        this.#jsComHub = jsComHub;
    }

    /**
     * Closes the communication interface.
     * @returns True if the interface was closed successfully, false otherwise.
     */
    public async close(): Promise<boolean> {
        await this.impl.cleanup?.();
        return this.#jsComHub.close_interface(this.uuid);
    }
}
