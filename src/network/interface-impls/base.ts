import { ComInterfaceImpl } from "../com-interface.ts";
import { ComHub } from "../com-hub.ts";
import type {
    BaseInterfaceSetupData,
    InterfaceDirection,
} from "../../datex-core/datex_core_js.d.ts";
export type { BaseInterfaceSetupData, InterfaceDirection };
export class BaseInterfaceImpl
    extends ComInterfaceImpl<BaseInterfaceSetupData> {
    public registerSocket(interfaceDirection: InterfaceDirection): string {
        return this.jsComHub.base_interface_register_socket(
            this.uuid,
            interfaceDirection,
        );
    }

    public destroySocket(socketUUID: string) {
        this.jsComHub.base_interface_destroy_socket(
            this.uuid,
            socketUUID,
        );
    }

    public receive(socketUUID: string, data: Uint8Array) {
        this.jsComHub.base_interface_receive(
            this.uuid,
            socketUUID,
            data,
        );
    }

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
