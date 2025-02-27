import { assertThrows } from "jsr:@std/assert/throws";
import { assert, assertEquals } from "jsr:@std/assert";
import { createMockupServer } from "./WebsocketMockupServer.ts";
import { Runtime } from "../../src/runtime/Runtime.ts";

Deno.test("websocket connect", async () => {
    const port = 8484;
    const mockupServer = createMockupServer(port);
    const runtime = new Runtime();
    runtime.comHub.add_ws_interface("ws://localhost:8484/");

    using server = await mockupServer;
    server.send(runtime._runtime._create_block(new Uint8Array([0x01, 0x02, 0x03, 0x04])));
    await new Promise((resolve) => setTimeout(resolve, 1300));
    runtime.comHub._update();
    await new Promise((resolve) => setTimeout(resolve, 1300));

    console.log(
        runtime.comHub._incoming_blocks
    );
});
