import { Datex } from "../src/mod.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await Datex.comHub.serial.register(19200);
    console.log(serial);
});

// TODO
document.getElementById("webrtc")!.addEventListener("click", async () => {
    const webrtc = Datex.comHub.webrtc;
    const interface_a = await webrtc.register("@jonas");
    const interface_b = await webrtc.register("@ben");
    const offer_sdp = await webrtc.create_offer(interface_a);
    await webrtc.set_remote_description(interface_b, offer_sdp);
    const answer_sdp = await webrtc.create_answer(interface_b);
    await webrtc.set_remote_description(interface_a, answer_sdp);

    console.log(offer_sdp, answer_sdp);
});
