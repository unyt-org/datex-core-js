import { ComInterfaceImpl } from "../com-interface.ts";
import { ComHub } from "../com-hub.ts";
import type {
    BaseInterfaceSetupData,
    InterfaceDirection,
} from "../../datex-core/datex_core_js.d.ts";

export type {
    /**
     * Setup data for the base communication interface.
     */
    BaseInterfaceSetupData,
    /**
     * Direction of the communication interface (In/Out/InOut).
     */
    InterfaceDirection,
};

/**
 * Implementation of the base communication interface.
 */
export class BaseInterfaceImpl
    extends ComInterfaceImpl<BaseInterfaceSetupData> {
    /**
     * Registers a socket for the communication interface.
     * @param interfaceDirection The direction of the interface (incoming/outgoing).
     * @returns The UUID of the registered socket.
     */
    public registerSocket(interfaceDirection: InterfaceDirection): string {
        return this.jsComHub.base_interface_register_socket(
            this.uuid,
            interfaceDirection,
        );
    }

    /**
     * Destroys a socket for the communication interface.
     * @param socketUUID The UUID of the socket to destroy.
     */
    public destroySocket(socketUUID: string) {
        this.jsComHub.base_interface_destroy_socket(
            this.uuid,
            socketUUID,
        );
    }

    /**
     * Receives a data block for the communication interface.
     * @param socketUUID The UUID of the socket to receive data on.
     * @param data The data block to receive.
     */
    public receive(socketUUID: string, data: Uint8Array) {
        this.jsComHub.base_interface_receive(
            this.uuid,
            socketUUID,
            data,
        );
    }

    /**
     * Tests sending a data block for the communication interface.
     * @param socketUUID The UUID of the socket to send data on.
     * @param data The data block to send.
     * @returns A promise that resolves to true if the block was sent successfully, false otherwise.
     */
    public testSendBlock(
        socketUUID: string,
        data: Uint8Array,
    ): Promise<boolean> {
        return this.jsComHub.base_interface_test_send_block(
            this.uuid,
            socketUUID,
            data,
        );
    }

    /**
     * Registers a callback to handle sending data blocks.
     * @param callback The callback to be invoked when sending data.
     */
    public onSend(
        callback: (
            data: Uint8Array,
            receiver_socket_uuid: string,
        ) => Promise<boolean>,
    ) {
        this.jsComHub.base_interface_on_send(this.uuid, callback);
    }
}

ComHub.registerInterfaceImpl("base", BaseInterfaceImpl);
