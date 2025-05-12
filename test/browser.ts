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
    const webrtc = Datex.comHub.webrtcnew;
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
});
// deno-lint-ignore no-unused-vars
class WebRTCInterface {
    private peer: RTCPeerConnection;
    private dataChannel?: RTCDataChannel;
    private iceCandidateQueue: RTCIceCandidate[] = [];
    private remoteDescriptionSet = false;

    constructor(private onMessage?: (msg: string) => void) {
        this.peer = new RTCPeerConnection();

        this.peer.onicecandidate = (event) => {
            if (event.candidate && this.onICECandidate) {
                this.onICECandidate(event.candidate);
            }
        };

        this.peer.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };
    }

    onICECandidate?: (candidate: RTCIceCandidate) => void;

    async setRemoteCandidate(candidate: RTCIceCandidate) {
        if (this.remoteDescriptionSet) {
            await this.peer.addIceCandidate(candidate);
        } else {
            this.iceCandidateQueue.push(candidate);
        }
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
        this.dataChannel = this.peer.createDataChannel("data");
        this.setupDataChannel();

        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        return offer;
    }

    async createAnswer(
        offer: RTCSessionDescriptionInit,
    ): Promise<RTCSessionDescriptionInit> {
        await this.peer.setRemoteDescription(offer);
        this.remoteDescriptionSet = true;

        // Flush queued ICE candidates
        for (const candidate of this.iceCandidateQueue) {
            await this.peer.addIceCandidate(candidate);
        }
        this.iceCandidateQueue = [];

        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);
        return answer;
    }

    async setAnswer(answer: RTCSessionDescriptionInit) {
        await this.peer.setRemoteDescription(answer);
        this.remoteDescriptionSet = true;

        // Flush queued ICE candidates
        for (const candidate of this.iceCandidateQueue) {
            await this.peer.addIceCandidate(candidate);
        }
        this.iceCandidateQueue = [];
    }

    send(message: string) {
        if (this.dataChannel?.readyState === "open") {
            this.dataChannel.send(message);
        }
    }

    private setupDataChannel() {
        if (!this.dataChannel) return;

        this.dataChannel.onopen = () => {
            console.log("Data channel open");
        };

        this.dataChannel.onmessage = (event) => {
            console.log("Received:", event.data);
            this.onMessage?.(event.data);
        };
    }
}
