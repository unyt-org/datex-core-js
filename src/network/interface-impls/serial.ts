import { ComInterfaceImpl } from "../com-interface.ts";
import { ComHub } from "../com-hub.ts";
import type { SerialInterfaceSetupData } from "../../datex-core.ts";

/**
 * Implementation of the serial communication interface.
 */
export class SerialInterfaceImpl
    extends ComInterfaceImpl<SerialInterfaceSetupData> {
}

ComHub.registerInterfaceImpl("serial", SerialInterfaceImpl);
