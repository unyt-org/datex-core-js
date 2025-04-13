import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";

Deno.test("connect client", async () => {
    const PORT = 8082;
    const runtime = new Runtime("@unyt");
    const serverInterfaceUUID = await runtime.comHub
        .create_websocket_server_interface();
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
            await runtime.comHub.add_websocket_to_server_interface(
                serverInterfaceUUID,
                socket,
            ),
            "Failed to add websocket to server interface",
        );
        return response;
    });

    // add client
    const client1UUID = await runtime.comHub.add_ws_interface(
        `ws://localhost:${PORT}`,
    );
    assert(uuid.validate(client1UUID), "Invalid UUID");

    // add client
    const client2UUID = await runtime.comHub.add_ws_interface(
        `ws://localhost:${PORT}`,
    );
    assert(uuid.validate(client2UUID), "Invalid UUID");
    sockets.forEach((socket) => {
        socket.send(new TextEncoder().encode("Hello to server"));
    });
    await new Promise<void>((resolve) =>
        setTimeout(async () => {
            await runtime.comHub.close_websocket_server_interface(
                serverInterfaceUUID,
            );
            // sockets.forEach((socket) => socket.close());
            await server.shutdown();
            resolve();
        }, 2000)
    );
});
