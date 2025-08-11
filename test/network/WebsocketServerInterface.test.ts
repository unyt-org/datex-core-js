import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";
import { isNodeOrBun } from "../is-node.ts";
import "../../src/network/interface-impls/websocket-client.ts";
import "../../src/network/interface-impls/websocket-server-deno.ts";
import { sleep } from "../utils.ts";
import type { WebSockerServerDenoInterfaceImpl } from "../../src/network/interface-impls/websocket-server-deno.ts";
import type { WebSocketClientInterfaceImpl } from "../../src/network/interface-impls/websocket-client.ts";

Deno.test("add and close interface", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });
    const serverInterface = await runtime.comHub.createInterface(
        "websocket-server",
        { port: 1234 },
    );
    assert(uuid.validate(serverInterface.uuid), "Invalid UUID");
    await serverInterface.close();
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
    const serverInterface = await runtimeA.comHub.createInterface<
        WebSockerServerDenoInterfaceImpl
    >(
        "websocket-server",
        { port: PORT },
    );

    const runtimeB = new Runtime({ endpoint: "@test_b" });
    const clientInterface = await runtimeB.comHub.createInterface<
        WebSocketClientInterfaceImpl
    >(
        "websocket-client",
        { address: `ws://localhost:${PORT}` },
    );

    await serverInterface.close();
    await clientInterface.close();
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
    const serverInterface = await runtimeA.comHub.createInterface(
        "websocket-server",
        { port: PORT },
    );

    const runtimeB = await Runtime.create({ endpoint: "@test_b" }, {
        allow_unsigned_blocks: true,
    });
    const clientInterface = await runtimeB.comHub.createInterface(
        "websocket-client",
        { address: `ws://localhost:${PORT}` },
    );

    await sleep(1000);

    const res = await runtimeA.execute_with_string_result("@test_b :: 1 + 2");
    assert(res === "3", "Expected result from remote execution to be 3");

    await serverInterface.close();
    await clientInterface.close();

    await runtimeA._stop();
    await runtimeB._stop();
});
