import { assert } from "jsr:@std/assert/assert";
import { Runtime } from "../../src/runtime/runtime.ts";
import * as uuid from "jsr:@std/uuid";
import { BaseJSInterface } from "../../src/datex-core.ts";
import { sleep } from "../utils.ts";

Deno.test("add interface and sockets", async () => {
    const runtime = new Runtime("@unyt");
    const baseInterface = new BaseJSInterface(runtime.comHub, "test");
    assert(uuid.validate(baseInterface.uuid), "Invalid UUID");

    const socketA = baseInterface.register_socket("IN_OUT");
    const socketB = baseInterface.register_socket("IN_OUT");
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
