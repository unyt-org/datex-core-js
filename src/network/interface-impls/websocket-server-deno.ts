import {ComHub, ComInterfaceFactory, ComInterfaceFactoryFn} from "../com-hub.ts";
import type {
    BaseInterfaceHandle,
    InterfaceProperties,
    WebSocketServerInterfaceSetupData
} from "../../datex-core/datex_core_js.d.ts";

/**
 * General utility functions for WebSockets that can be reused for different socket server implementations.
 */
export function registerWebSocket(webSocket: WebSocket, baseInterfaceHandle: BaseInterfaceHandle): boolean {
    const uuid = baseInterfaceHandle.registerSocket();
    // TODO:
    webSocket.onmessage = (msg) => {
        console.log("WebSocket connection opened");
        baseInterfaceHandle.sendBlock(uuid, msg.data)
    };
}

export const websocketServerDenoComInterfaceFactory: ComInterfaceFactory<WebSocketServerInterfaceSetupData> = {
    interfaceType: "websocket-server",
    factory: (baseInterfaceHandle, setupData) => {
        const server =  Deno.serve({
            port: setupData.port,
        }, (req) => {
            if (req.headers.get("upgrade") != "websocket") {
                return new Response(null, { status: 501 });
            }
            const { socket: webSocket, response } = Deno.upgradeWebSocket(req);

            if (!registerWebSocket(webSocket, baseInterfaceHandle)) {
                console.error("Failed to add websocket to server interface");
                return new Response(
                    "Failed to add websocket to server interface",
                    { status: 500 },
                );
            }
            return response;
        });

        // cleanup handler
        baseInterfaceHandle.onClosed(async () => {
            await server.shutdown();
        });

        // TODO: set properties
        return {
            interface_type: "websocket-server",
            channel: "websocket",
            name: undefined,
            direction: "InOut",
            round_trip_time: 0,
            max_bandwidth: 0,
            continuous_connection: false,
            allow_redirects: false,
            is_secure_channel: false,
            reconnection_config: "NoReconnect",
            auto_identify: false,
            close_timestamp: undefined,
            reconnect_attempts: undefined
        } satisfies InterfaceProperties
    }
}