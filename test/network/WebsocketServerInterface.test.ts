import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";
import { sleep } from "../utils.ts";

Deno.test("connect client", async () => {
    const PORT = 8082;
    const runtime = new Runtime("@unyt");
    const serverInterfaceUUID = await runtime.comHub
        .create_websocket_server_interface();
    assert(uuid.validate(serverInterfaceUUID), "Invalid UUID");

    const server = Deno.serve({
        port: PORT,
    }, (req) => {
        if (req.headers.get("upgrade") != "websocket") {
            return new Response(null, { status: 501 });
        }
        const { socket, response } = Deno.upgradeWebSocket(req);
        runtime.comHub.add_websocket_to_server_interface(
            serverInterfaceUUID,
            socket,
        );
        return response;
    });
    await sleep(1000);
    // add client
    const clientUUID = await runtime.comHub.add_ws_interface(
        `ws://localhost:${PORT}`,
    );
    console.log(clientUUID);

    await new Promise<void>((resolve) =>
        setTimeout(async () => {
            await server.shutdown();
            resolve();
        }, 3000)
    );
});
