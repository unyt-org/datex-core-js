import { Datex } from "../src/mod.ts";
import { SerialInterfaceImpl } from "../src/network/interface-impls/serial.ts";
import { WebRTCInterfaceImpl } from "../src/network/interface-impls/webrtc.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await Datex.comHub.createInterface(
        SerialInterfaceImpl,
        { baud_rate: 19200, port_name: null },
    );
    console.log(serial);
});

document.getElementById("webrtc")!.addEventListener("click", async () => {
    const interface_a = await Datex.comHub.createInterface(
        WebRTCInterfaceImpl,
        {
            peer_endpoint: "@jonas",
            ice_servers: null,
        },
    );

    const interface_b = await Datex.comHub.createInterface(
        WebRTCInterfaceImpl,
        {
            peer_endpoint: "@ben",
            ice_servers: null,
        },
    );
    console.log("Interface A:", interface_a);
    interface_a.impl.setOnIceCandidate((candidate: Uint8Array) => {
        console.log("Interface A ICE candidate:", candidate);
        interface_b.impl.addIceCandidate(candidate)
            .then(() => console.log("ICE candidate added to interface B"))
            .catch((e) =>
                console.error(
                    "Error adding ICE candidate to interface B",
                    e,
                )
            );
    });

    interface_b.impl.setOnIceCandidate((candidate: Uint8Array) => {
        interface_a.impl.addIceCandidate(candidate)
            .then(() => console.log("ICE candidate added to interface A"))
            .catch((e) =>
                console.error(
                    "Error adding ICE candidate to interface A",
                    e,
                )
            );
    });
    const offer = await interface_a.impl.createOffer();
    console.log("Offer from A:", offer);

    const answer = await interface_b.impl.createAnswer(offer);
    console.log("Answer from B:", answer);
    await interface_a.impl.setAnswer(answer);

    await interface_a.impl.waitForConnection();
    console.log("Interface A connected");
    await interface_b.impl.waitForConnection();
    console.log("Interface B connected");

    const success = await Datex.comHub.sendBlock(
        new Uint8Array([1, 2, 3, 4]),
        interface_a.uuid,
        "",
    ) && await Datex.comHub.sendBlock(
        new Uint8Array([1, 2, 3, 4]),
        interface_b.uuid,
        "",
    );

    if (!success) {
        console.error("Failed to send message");
    } else {
        console.log("Message sent successfully");
    }
});
