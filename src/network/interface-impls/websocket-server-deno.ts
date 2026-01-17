import { ComInterfaceImpl } from "../com-interface.ts";
import { ComHub } from "../com-hub.ts";
import type { WebSocketServerInterfaceSetupData } from "../../datex-core/datex_core_js.d.ts";

// TODO: deprecate this class, not needed anymore - only write interfaces for custom implementations like websocket-server-deno

/**
 * Implementation of the WebSocket server communication interface for Deno.
 */
export class WebSockerServerDenoInterfaceImpl
    extends ComInterfaceImpl<WebSocketServerInterfaceSetupData> {
    #server?: Deno.HttpServer;

    override init() {
        this.#server = Deno.serve({
            port: this.setupData.port,
        }, (req) => {
            if (req.headers.get("upgrade") != "websocket") {
                return new Response(null, { status: 501 });
            }
            const { socket, response } = Deno.upgradeWebSocket(req);
            if (
                !this.jsComHub.websocket_server_interface_add_socket(
                    this.uuid,
                    socket,
                )
            ) {
                console.error("Failed to add websocket to server interface");
                return new Response(
                    "Failed to add websocket to server interface",
                    { status: 500 },
                );
            }
            return response;
        });
    }

    override async cleanup() {
        if (this.#server) {
            await this.#server.shutdown();
            this.#server = undefined;
        }
    }
}

ComHub.registerInterfaceImpl(
    "websocket-server",
    WebSockerServerDenoInterfaceImpl,
);
