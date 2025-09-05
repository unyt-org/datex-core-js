import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";
import { sleep } from "../utils.ts";
import { assertFalse } from "jsr:@std/assert/false";
import { assertEquals } from "jsr:@std/assert/equals";
import { assertThrows } from "jsr:@std/assert/throws";
import { isNodeOrBun } from "../is-node.ts";
import type { BaseInterfaceSetupData } from "../../src/datex-core/datex_core_js.d.ts";
import "../../src/network/interface-impls/base.ts";
import type { BaseInterfaceImpl } from "../../src/network/interface-impls/base.ts";

const config: BaseInterfaceSetupData = {
    name: "base",
    interface_type: "base",
    channel: "test",
    direction: "InOut",
    round_trip_time: 5,
    max_bandwidth: 1,
    continuous_connection: true,
    allow_redirects: true,
    is_secure_channel: true,
    reconnection_config: "NoReconnect",
    reconnect_attempts: null,
    close_timestamp: null,
};
// Deno.test("custom properties no reconnect", () => {
//     const runtime = new Runtime("@unyt");
//     const config: InterfaceProperties = {
//         name: "base",
//         interface_type: "base",
//         channel: "test",
//         direction: "InOut",
//         round_trip_time: 1000,
//         max_bandwidth: 1,
//         continuous_connection: true,
//         allow_redirects: true,
//         is_secure_channel: true,
//         reconnection_config: "NoReconnect",
//         reconnect_attempts: undefined,
//     };
//     const baseInterface = new BaseJSInterface(runtime._runtime, config);
//     assertEquals(baseInterface.properties, config);
// });

Deno.test("custom properties with reconnect", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });

    const baseInterface = await runtime.comHub.createInterface<
        BaseInterfaceImpl
    >("base", config);
    assert(uuid.validate(baseInterface.uuid), "Invalid UUID");
});

Deno.test("add interface and sockets", async () => {
    const runtime = new Runtime({ endpoint: "@unyt" });
    const baseInterface = await runtime.comHub.createInterface<
        BaseInterfaceImpl
    >("base", config);
    assert(uuid.validate(baseInterface.uuid), "Invalid UUID");

    const socketA = baseInterface.impl.registerSocket("InOut");
    const socketB = baseInterface.impl.registerSocket("InOut");
    assert(uuid.validate(socketA), "Invalid UUID");
    assert(uuid.validate(socketB), "Invalid UUID");

    baseInterface.impl.receive(
        socketA,
        new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    );
    baseInterface.impl.receive(
        socketB,
        new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    );
});

Deno.test("test receive and send", async () => {
    const queue: [data: Uint8Array, socket: string][] = [];
    const runtime = new Runtime({ endpoint: "@unyt" });
    const baseInterface = await runtime.comHub.createInterface<
        BaseInterfaceImpl
    >("base", config);

    assertThrows(
        () => baseInterface.impl.destroySocket("invalid socket"),
        "Destroying invalid socket should throw",
    );

    assert(uuid.validate(baseInterface.uuid), "Invalid UUID");
    const socket = baseInterface.impl.registerSocket("InOut");
    assert(uuid.validate(socket), "Invalid UUID");

    // If the callback is not set, the send block
    // should return false
    assertFalse(
        await baseInterface.impl.testSendBlock(
            socket,
            new Uint8Array([0]),
        ),
        "Callback not set should return false",
    );

    baseInterface.impl.onSend(
        async (data: Uint8Array, receiver_socket_uuid: string) => {
            queue.push([data, receiver_socket_uuid]);
            await sleep(1);
            return true;
        },
    );

    // Invalid sockets should not trigger the on_send callback
    // and should return false
    assertFalse(
        await baseInterface.impl.testSendBlock(
            "invalid socket",
            new Uint8Array([0]),
        ),
        "Invalid socket should return false",
    );

    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
    assert(
        await baseInterface.impl.testSendBlock(
            socket,
            data,
        ),
        "Valid socket should return true",
    );

    assertEquals(queue.length, 1, "Queue should have one item");
    assertEquals(
        queue,
        [[data, socket]],
    );

    baseInterface.impl.destroySocket(socket);

    assertThrows(
        () => baseInterface.impl.destroySocket(socket),
        "Destroying socket twice should throw",
    );
});

// TODO:
Deno.test("worker", async () => {
    // FIXME: temporarily disabled because workers are not yet supported for node.js/dnt
    if (isNodeOrBun) {
        console.warn(
            "Crypto tests are currently disabled in Node.js or Bun environments.",
        );
        return;
    }
    const workerCode = `
        self.onmessage = (e) => {
            console.log("Worker received:", e.data);
            self.postMessage("Pong from inline worker");
        };
    `;

    const blob = new Blob([workerCode], { type: "application/javascript" });
    const worker = new Worker(URL.createObjectURL(blob), { type: "module" });

    worker.postMessage("Ping from main");
    worker.onmessage = (e) => {
        console.log("Main got:", e.data);
    };

    await sleep(1000);
});
