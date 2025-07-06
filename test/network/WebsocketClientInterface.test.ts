import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import { createMockupServer } from "./WebsocketMockupServer.ts";
import { Runtime } from "../../src/runtime/runtime.ts";
import { sleep } from "../utils.ts";
import * as uuid from "jsr:@std/uuid";
import { isNodeOrBun } from "../is-node.ts";

Deno.test("invalid url construct", async () => {
    const runtime = new Runtime("@unyt");
    await assertRejects(
        () => runtime.comHub.websocket_client.register(`invalid url`),
        "InvalidURL",
    );
});

Deno.test("invalid url scheme construct", async () => {
    const runtime = new Runtime("@unyt");
    await assertRejects(
        () => runtime.comHub.websocket_client.register(`ftp://invalid`),
        "InvalidURL",
    );
});

Deno.test("websocket connect fail", async () => {
    const runtime = new Runtime("@unyt");
    await assertRejects(
        () => runtime.comHub.websocket_client.register(`ws://invalid`),
        "Failed to connect to WebSocket",
    );
});

Deno.test("websocket basic connect", async () => {
    // FIXME: temporarily disabled because Deno.serve is not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn(
            "Crypto tests are currently disabled in Node.js or Bun environments.",
        );
        return;
    }
    const port = 8484;
    const mockupServer = createMockupServer(port);
    const runtime = new Runtime("@unyt");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const connection = runtime.comHub.websocket_client.register(
        `ws://localhost:${port}/`,
    );
    await using _ = await mockupServer;
    assert(uuid.validate(await connection), "Invalid UUID");
});

Deno.test("websocket block retrieval", async () => {
    // FIXME: temporarily disabled because Deno.serve is not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn(
            "Crypto tests are currently disabled in Node.js or Bun environments.",
        );
        return;
    }
    const port = 8484;
    const mockupServer = createMockupServer(port);

    const runtime = new Runtime("@unyt", { allow_unsigned_blocks: true });
    runtime.comHub.websocket_client.register(`ws://localhost:${port}/`)
        .then(() => console.info("Connected"))
        .catch((err) => console.error("Error:", err));
    await using server = await mockupServer;

    const block = runtime._runtime._create_block(
        new Uint8Array([0x01, 0x02, 0x03, 0x04]),
        ["@unyt"],
    );
    server.send(block);
    await sleep(10);
    await runtime.comHub.update();

    const blocks = runtime.comHub._drain_incoming_blocks();

    console.log("blocks", blocks);
    assert(blocks.length === 1);
    const incoming_block = blocks[0];
    assert(incoming_block.length === block.length);
    assertEquals(incoming_block, block);
});
