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
    const bufferA: Uint8Array[] = [];
    const bufferB: Uint8Array[] = [];

    let aRemoteSet = false;
    let bRemoteSet = false;

    // Set up ICE candidate exchange with buffering
    webrtc.set_on_ice_candidate(interface_a, (candidate: Uint8Array) => {
        console.log("set_on_ice_candidate", candidate);
        if (bRemoteSet) {
            webrtc.add_ice_candidate(interface_b, candidate)
                .then(() => console.log("ICE candidate added to interface B"))
                .catch((e) =>
                    console.error(
                        "Error adding ICE candidate to interface B",
                        e,
                    )
                );
        } else {
            bufferB.push(candidate);
        }
    });

    webrtc.set_on_ice_candidate(interface_b, (candidate: Uint8Array) => {
        console.log("set_on_ice_candidate", candidate);

        if (aRemoteSet) {
            webrtc.add_ice_candidate(interface_a, candidate)
                .then(() => console.log("ICE candidate added to interface A"))
                .catch((e) =>
                    console.error(
                        "Error adding ICE candidate to interface A",
                        e,
                    )
                );
        } else {
            bufferA.push(candidate);
        }
    });

    // Offer/Answer exchange
    const offer_sdp = await webrtc.create_offer(interface_a);
    await webrtc.set_remote_description(interface_b, offer_sdp);

    await sleep(300);

    const answer_sdp = await webrtc.create_answer(interface_b);
    await webrtc.set_remote_description(interface_a, answer_sdp);
    await sleep(300);

    aRemoteSet = true;
    bRemoteSet = true;
    console.log(
        bufferA,
        bufferB,
    );
    // Flush buffered candidates for A
    for (const c of bufferA) {
        try {
            await webrtc.add_ice_candidate(interface_a, c);
        } catch (e) {
            console.error("Buffered ICE candidate to A failed", e);
        }
    }
    for (const c of bufferB) {
        try {
            await webrtc.add_ice_candidate(interface_b, c);
        } catch (e) {
            console.error("Buffered ICE candidate to B failed", e);
        }
    }
});
