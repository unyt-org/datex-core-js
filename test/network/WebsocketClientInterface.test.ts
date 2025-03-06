import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import { createMockupServer } from "./WebsocketMockupServer.ts";
import { Runtime } from "../../src/runtime/runtime.ts";
import { sleep } from "../utils.ts";
import * as uuid from "jsr:@std/uuid";

Deno.test("invalid url construct", async () => {
    const runtime = new Runtime();
    await assertRejects(
        () => runtime.comHub.add_ws_interface(`invalid url`),
        Error,
        "Invalid URL",
    );
});

Deno.test("invalid url scheme construct", async () => {
    const runtime = new Runtime();
    await assertRejects(
        () => runtime.comHub.add_ws_interface(`ftp://invalid`),
        Error,
        "Invalid URL scheme",
    );
});

Deno.test("websocket connect fail", async () => {
    const runtime = new Runtime();
    await assertRejects(
        () => runtime.comHub.add_ws_interface(`ws://invalid`),
        Error,
        "Failed to connect to WebSocket",
    );
});

Deno.test("websocket basic connect", async () => {
    const port = 8484;
    const mockupServer = createMockupServer(port);
    const runtime = new Runtime();
    const connection = runtime.comHub.add_ws_interface(
        `ws://localhost:${port}/`,
    );
    await using _ = await mockupServer;
    assert(uuid.validate(await connection), "Invalid UUID");
});

Deno.test("websocket block retrieval", async () => {
    const port = 8484;
    const mockupServer = createMockupServer(port);

    const runtime = new Runtime();
    runtime.comHub.add_ws_interface(`ws://localhost:${port}/`)
        .then(() => console.info("Connected"))
        .catch((err) => console.error("Error:", err));
    await using server = await mockupServer;

    const block = runtime._runtime._create_block(
        new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    );
    server.send(block);
    await sleep(10);
    runtime.comHub._update();

    assert(runtime.comHub._incoming_blocks.length === 1);
    const incoming_block = runtime.comHub._incoming_blocks[0];
    assert(incoming_block.length === block.length);
    assertEquals(incoming_block, block);
});
