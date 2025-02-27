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
    const block = runtime._runtime._create_block(new Uint8Array([0x01, 0x02, 0x03, 0x04]));
    server.send(block);
    await new Promise((resolve) => setTimeout(resolve, 100));
    runtime.comHub._update();

    assert(runtime.comHub._incoming_blocks.length === 1);
    const incoming_block = runtime.comHub._incoming_blocks[0];
    assert(incoming_block.length === block.length);
    assertEquals(incoming_block, block);
});