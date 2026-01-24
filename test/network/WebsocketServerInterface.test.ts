import { assert } from "@std/assert/assert";
import { Runtime } from "datex-core-js/runtime/runtime.ts";
import * as uuid from "@std/uuid";
import { isNodeOrBun } from "../is-node.ts";
import { websocketServerDenoComInterfaceFactory } from "datex-core-js/network/interface-impls/websocket-server-deno.ts";
import { sleep } from "../utils.ts";

Deno.test("add and close interface", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });
    runtime.comHub.registerInterfaceFactory(websocketServerDenoComInterfaceFactory);
    const serverInterfaceUUID = await runtime.comHub.createInterface(
        "websocket-server",
        { port: 1234 },
    );
    assert(uuid.validate(serverInterfaceUUID), "Invalid UUID");
    runtime.comHub.closeInterface(serverInterfaceUUID);
});

Deno.test("connect two runtimes", async () => {
    // FIXME: temporarily disabled because Deno.serve is not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn(
            "Crypto tests are currently disabled in Node.js or Bun environments.",
        );
        return;
    }

    const PORT = 8082;
    const runtimeA = new Runtime({ endpoint: "@test_a" });
    runtimeA.comHub.registerInterfaceFactory(websocketServerDenoComInterfaceFactory);

    const serverInterfaceUUID = await runtimeA.comHub.createInterface(
        "websocket-server",
        { port: PORT, secure: false },
    );

    const runtimeB = new Runtime({ endpoint: "@test_b" });
    const clientInterfaceUUID = await runtimeB.comHub.createInterface(
        "websocket-client",
        { address: `ws://localhost:${PORT}` },
    );

    runtimeA.comHub.closeInterface(serverInterfaceUUID);
    runtimeB.comHub.closeInterface(clientInterfaceUUID);
});

Deno.test("send data between two runtimes", async () => {
    // FIXME: temporarily disabled because Deno.serve is not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn(
            "Crypto tests are currently disabled in Node.js or Bun environments.",
        );
        return;
    }

    const PORT = 8082;
    const runtimeA = await Runtime.create({ endpoint: "@test_a" }, {
        allow_unsigned_blocks: true,
    });
    runtimeA.comHub.registerInterfaceFactory(websocketServerDenoComInterfaceFactory);
    const serverInterfaceUUID = await runtimeA.comHub.createInterface(
        "websocket-server",
        { port: PORT },
    );

    const runtimeB = await Runtime.create({ endpoint: "@test_b" }, {
        allow_unsigned_blocks: true,
    });
    const clientInterfaceUUID = await runtimeB.comHub.createInterface(
        "websocket-client",
        { address: `ws://localhost:${PORT}` },
    );

    await sleep(1000);

    const res = await runtimeA.executeWithStringResult("@test_b :: 1 + 2");
    assert(res === "3", "Expected result from remote execution to be 3");

    runtimeA.comHub.closeInterface(serverInterfaceUUID);
    runtimeB.comHub.closeInterface(clientInterfaceUUID);
});
