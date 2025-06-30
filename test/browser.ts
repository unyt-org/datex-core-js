import { Datex } from "../src/mod.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await Datex.comHub.serial.register(19200);
    console.log(serial);
});

document.getElementById("webrtc")!.addEventListener("click", async () => {
    const webrtc = Datex.comHub.webrtc;
    const interface_a = await webrtc.register("@jonas");
    const interface_b = await webrtc.register("@ben");

    webrtc.set_on_ice_candidate(interface_a, (candidate: Uint8Array) => {
        webrtc.add_ice_candidate(interface_b, candidate)
            .then(() => console.log("ICE candidate added to interface B"))
            .catch((e) =>
                console.error(
                    "Error adding ICE candidate to interface B",
                    e,
                )
            );
    });

    webrtc.set_on_ice_candidate(interface_b, (candidate: Uint8Array) => {
        webrtc.add_ice_candidate(interface_a, candidate)
            .then(() => console.log("ICE candidate added to interface A"))
            .catch((e) =>
                console.error(
                    "Error adding ICE candidate to interface A",
                    e,
                )
            );
    });

    const offer = await webrtc.create_offer(interface_a);
    console.log("Offer:", offer);

    const answer = await webrtc.create_answer(interface_b, offer);
    console.log("Answer:", answer);
    await webrtc.set_answer(interface_a, answer);

    await webrtc.wait_for_connection(interface_a);
    await webrtc.wait_for_connection(interface_b);

    const success = await Datex.comHub.send_block(
        new Uint8Array([1, 2, 3, 4]),
        interface_a,
        "",
    ) && await Datex.comHub.send_block(
        new Uint8Array([1, 2, 3, 4]),
        interface_b,
        "",
    );

    if (!success) {
        console.error("Failed to send message");
    } else {
        console.log("Message sent successfully");
    }
});
