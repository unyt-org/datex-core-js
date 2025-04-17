import { Datex } from "../src/mod.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await Datex.comHub.serial.register(19200);
    console.log(serial);
});

// TODO
// document.getElementById("webrtc")!.addEventListener("click", async () => {
//     const webrtc = await Datex.comHub.webrtc.register("ws://localhost:8080");
//     console.log(webrtc);
// });
