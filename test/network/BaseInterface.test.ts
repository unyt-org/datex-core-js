import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";
import { BaseJSInterface } from "../../src/datex-core.ts";
import { sleep } from "../utils.ts";
import { assertFalse } from "jsr:@std/assert/false";
import { assertEquals } from "jsr:@std/assert/equals";
import { assertThrows } from "jsr:@std/assert/throws";

Deno.test("add interface and sockets", async () => {
    const runtime = new Runtime("@unyt");
    const baseInterface = new BaseJSInterface(runtime.comHub, "test");
    assert(uuid.validate(baseInterface.uuid), "Invalid UUID");

    const socketA = baseInterface.register_socket("InOut");
    const socketB = baseInterface.register_socket("InOut");
    assert(uuid.validate(socketA), "Invalid UUID");
    assert(uuid.validate(socketB), "Invalid UUID");

    await baseInterface.receive(
        socketA,
        new Uint8Array([0x01, 0x02, 0x03, 0x04]),
    );
    await baseInterface.receive(
        socketB,
        new Uint8Array([0x05, 0x06, 0x07, 0x08]),
    );
});

Deno.test("test receive and send", async () => {
    const queue: [data: Uint8Array, socket: string][] = [];
    const runtime = new Runtime("@unyt");
    const baseInterface = new BaseJSInterface(runtime.comHub, "test");

    assertThrows(
        () => baseInterface.destroy_socket("invalid socket"),
        "Destroying invalid socket should throw",
    );

    assert(uuid.validate(baseInterface.uuid), "Invalid UUID");
    const socket = baseInterface.register_socket("InOut");
    assert(uuid.validate(socket), "Invalid UUID");

    // If the callback is not set, the send block
    // should return false
    assertFalse(
        await baseInterface.test_send_block(
            socket,
            new Uint8Array([0]),
        ),
        "Callback not set should return false",
    );

    baseInterface.on_send(
        async (data: Uint8Array, receiver_socket_uuid: string) => {
            queue.push([data, receiver_socket_uuid]);
            await sleep(1);
            return true;
        },
    );

    // Invalid sockets should not trigger the on_send callback
    // and should return false
    assertFalse(
        await baseInterface.test_send_block(
            "invalid socket",
            new Uint8Array([0]),
        ),
        "Invalid socket should return false",
    );

    const data = new Uint8Array([1, 2, 3, 4, 5, 6]);
    assert(
        await baseInterface.test_send_block(
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

    baseInterface.destroy_socket(socket);

    assertThrows(
        () => baseInterface.destroy_socket(socket),
        "Destroying socket twice should throw",
    );
});

// TODO
Deno.test("worker", async () => {
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
