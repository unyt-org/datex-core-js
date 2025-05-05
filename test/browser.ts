import { Datex } from "../src/mod.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await Datex.comHub.serial.register(19200);
    console.log(serial);
});

// TODO
document.getElementById("webrtc")!.addEventListener("click", async () => {
    const interface1 = await Datex.comHub.webrtc.register("@jonas");
    console.log(interface1);

    // const interface2 = await Datex.comHub.webrtc.register("@bob");
    // console.log(interface2);
});
