import { Datex } from "../src/mod.ts";
import { sleep } from "./utils.ts";

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
    webrtc.set_on_ice_candidate(interface_a, async (candidate: Uint8Array) => {
        await webrtc.add_ice_candidate(interface_b, candidate);
        console.log("ICE candidate added to interface B");
    });
    webrtc.set_on_ice_candidate(interface_b, async (candidate: Uint8Array) => {
        await webrtc.add_ice_candidate(interface_a, candidate);
        console.log("ICE candidate added to interface A");
    });

    const offer_sdp = await webrtc.create_offer(interface_a);
    await webrtc.set_remote_description(interface_b, offer_sdp);

    await sleep(300); // Why?

    const answer_sdp = await webrtc.create_answer(interface_b);
    await webrtc.set_remote_description(interface_a, answer_sdp);

    // console.log(
    //     await Datex.comHub.send_block(
    //         new Uint8Array([1, 2, 3, 4]),
    //         interface_a,
    //         "",
    //     ),
    // );
});
