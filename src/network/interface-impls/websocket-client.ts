import { ComInterfaceImpl } from "../com-interface.ts";
import type { WebSocketClientInterfaceSetupData } from "../../datex-core/datex_core_js.d.ts";
import { ComHub } from "../com-hub.ts";

export class WebSocketClientInterfaceImpl
    extends ComInterfaceImpl<WebSocketClientInterfaceSetupData> {
}

ComHub.registerInterfaceImpl("websocket-client", WebSocketClientInterfaceImpl);
