import { assert, assertEquals, assertRejects } from "jsr:@std/assert";
import { createMockupServer } from "./WebsocketMockupServer.ts";
import { Runtime } from "../../src/runtime/runtime.ts";
import { sleep } from "../utils.ts";
import * as uuid from "jsr:@std/uuid";
import { isNodeOrBun } from "../is-node.ts";
import "../../src/network/interface-impls/websocket-client.ts";

Deno.test("invalid url construct", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });
    await assertRejects(
        async () =>
            await runtime.comHub.createInterface("websocket-client", {
                address: "invalid url",
            }),
        "InvalidURL",
    );
});

Deno.test("invalid url scheme construct", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });
    await assertRejects(
        async () =>
            await runtime.comHub.createInterface("websocket-client", {
                address: "ftp://invalid",
            }),
        "InvalidURL",
    );
});

Deno.test("websocket connect fail", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });
    await assertRejects(
        async () =>
            await runtime.comHub.createInterface("websocket-client", {
                address: "ws://invalid",
            }),
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
    const runtime = new Runtime({ endpoint: "@unyt" });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const connection = await runtime.comHub.createInterface(
        "websocket-client",
        { address: `ws://localhost:${port}/` },
    );
    await using _ = await mockupServer;
    assert(uuid.validate(connection.uuid), "Invalid UUID");
});

Deno.test("websocket block retrieval", async () => {
    // FIXME: temporarily disabled because Deno.serve is not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn(
            "Crypto tests are currently disabled in Node.js or Bun environments.",
        );
        return;
    }
    const port = 8485;
    const mockupServer = createMockupServer(port);

    const runtime = new Runtime({ endpoint: "@unyt" }, {
        allow_unsigned_blocks: true,
    });
    runtime.comHub.createInterface("websocket-client", {
        address: `ws://localhost:${port}/`,
    })
        .then(() => console.info("Connected"))
        .catch((err) => console.error("Error:", err));
    await using server = await mockupServer;

    const block = runtime._runtime._create_block(
        new Uint8Array([0x01, 0x02, 0x03, 0x04]),
        ["@unyt"],
    );
    server.send(block);
    await sleep(10);
    await runtime.comHub._update();

    const blocks = runtime.comHub._drain_incoming_blocks();

    console.log("blocks", blocks);
    assert(blocks.length === 1);
    const incoming_block = blocks[0];
    assert(incoming_block.length === block.length);
    assertEquals(incoming_block, block);
});
