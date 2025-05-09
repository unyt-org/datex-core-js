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

    const offer = await webrtc.create_offer(interface_a);
    console.log("Offer:", offer);
    const answer = await webrtc.create_answer(interface_b, offer);
    console.log("Answer:", answer);

    // const bufferA: Uint8Array[] = [];
    // const bufferB: Uint8Array[] = [];

    // const peerA = new WebRTCInterface((msg) => console.log("Peer A got:", msg));
    // const peerB = new WebRTCInterface((msg) => console.log("Peer B got:", msg));

    // peerA.onICECandidate = (candidate) => peerB.setRemoteCandidate(candidate);
    // peerB.onICECandidate = (candidate) => peerA.setRemoteCandidate(candidate);

    // (async () => {
    //     const offer = await peerA.createOffer();
    //     await sleep(1000);
    //     const answer = await peerB.createAnswer(offer);
    //     await peerA.setAnswer(answer);

    //     // Wait for connection to establish before sending
    //     setTimeout(() => {
    //         peerA.send("Hello from Peer A");
    //     }, 1000);
    // })();
    // return;

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

    const offer_sdp = await webrtc.create_offer(interface_a);
    await sleep(300);
    const answer_sdp = await webrtc.create_answer(interface_b, offer_sdp);
    await webrtc.set_answer(interface_a, answer_sdp);
});
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
