import type { BaseInterfaceHandle } from "../datex-core.ts";

/**
 * Represents a communication interface.
 */
export class ComInterface {
    /** The UUID of the interface. */
    readonly uuid: string;

    /** The handle to the underlying communication interface. */
    readonly handle: BaseInterfaceHandle;

    constructor(uuid: string, handle: BaseInterfaceHandle) {
        this.uuid = uuid;
        this.handle = handle;
    }

    /**
     * Closes the communication interface.
     * @returns True if the interface was closed successfully, false otherwise.
     */
    public async close() {
        await this.handle.destroy();
    }
}
