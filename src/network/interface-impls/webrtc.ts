import { ComInterfaceImpl } from "../com-interface.ts";
import { ComHub } from "../com-hub.ts";
import type { WebRTCInterfaceSetupData } from "../../datex-core.ts";

export class WebRTCInterfaceImpl
    extends ComInterfaceImpl<WebRTCInterfaceSetupData> {
    public setOnIceCandidate(
        onIceCandidate: (candidate: Uint8Array) => void,
    ): void {
        this.jsComHub.webrtc_interface_set_on_ice_candidate(
            this.uuid,
            onIceCandidate,
        );
    }
    public addIceCandidate(candidate: Uint8Array): Promise<void> {
        return this.jsComHub.webrtc_interface_add_ice_candidate(
            this.uuid,
            candidate,
        );
    }
    public createOffer(): Promise<Uint8Array> {
        return this.jsComHub.webrtc_interface_create_offer(this.uuid);
    }
    public createAnswer(offer: Uint8Array): Promise<Uint8Array> {
        return this.jsComHub.webrtc_interface_create_answer(
            this.uuid,
            offer,
        );
    }
    public setAnswer(answer: Uint8Array): Promise<void> {
        return this.jsComHub.webrtc_interface_set_answer(this.uuid, answer);
    }
    public waitForConnection(): Promise<void> {
        return this.jsComHub.webrtc_interface_wait_for_connection(this.uuid);
    }
}

ComHub.registerInterfaceImpl("webrtc", WebRTCInterfaceImpl);
