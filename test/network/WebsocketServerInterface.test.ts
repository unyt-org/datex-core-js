import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";
import {isNodeOrBun} from "../is-node.ts";

Deno.test("add and close interface", async () => {
    const runtime = new Runtime("@unyt");
    const websocketServerInterface = runtime.comHub.websocket_server;
    const serverInterfaceUUID = await websocketServerInterface.register();
    assert(uuid.validate(serverInterfaceUUID), "Invalid UUID");
    await runtime.comHub.close_interface(
        serverInterfaceUUID,
    );
});

Deno.test("connect client and server", async () => {
    // FIXME: temporarily disabled because Deno.serve is not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn("Crypto tests are currently disabled in Node.js or Bun environments.");
        return;
    }
    const PORT = 8082;
    const runtime = new Runtime("@unyt");
    const websocketServerInterface = runtime.comHub.websocket_server;
    const serverInterfaceUUID = await websocketServerInterface.register();
    assert(uuid.validate(serverInterfaceUUID), "Invalid UUID");
    const sockets: WebSocket[] = [];
    const server = Deno.serve({
        port: PORT,
    }, async (req) => {
        if (req.headers.get("upgrade") != "websocket") {
            return new Response(null, { status: 501 });
        }
        const { socket, response } = Deno.upgradeWebSocket(req);
        sockets.push(socket);
        assert(
            await websocketServerInterface.add_socket(
                serverInterfaceUUID,
                socket,
            ),
            "Failed to add websocket to server interface",
        );
        return response;
    });

    // add client
    const client1UUID = await runtime.comHub.websocket_client.register(
        `ws://localhost:${PORT}`,
    );
    assert(uuid.validate(client1UUID), "Invalid UUID");

    // add client
    const client2UUID = await runtime.comHub.websocket_client.register(
        `ws://localhost:${PORT}`,
    );
    assert(uuid.validate(client2UUID), "Invalid UUID");
    sockets.forEach((socket) => {
        socket.send(new TextEncoder().encode("Hello to server"));
    });

    await new Promise<void>((resolve) =>
        setTimeout(async () => {
            assert(
                await runtime.comHub.close_interface(
                    serverInterfaceUUID,
                ),
            );
            await server.shutdown();
            resolve();
        }, 500)
    );
});
