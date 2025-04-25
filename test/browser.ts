import { BaseJSInterface } from "../src/datex-core.ts";
import { Datex } from "../src/mod.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await Datex.comHub.serial.register(19200);
    console.log(serial);
});

// TODO
document.getElementById("webrtc")!.addEventListener("click", async () => {
    const webrtc = await Datex.comHub.webrtc.register("ws://localhost:8080");
    console.log(webrtc);
});

const baseInterface = new BaseJSInterface(Datex.comHub, "test");

const socket = baseInterface.register_socket("IN_OUT");

baseInterface.setCallback(async (data: Uint8Array, socket: string) => {
    console.warn(socket, data);
    return false;
});

const r = await baseInterface._testSendBlock(
    socket,
    new Uint8Array([1, 2, 3, 4, 5, 6]),
);
console.dir(r);
console.log(typeof r, r, "<--");
