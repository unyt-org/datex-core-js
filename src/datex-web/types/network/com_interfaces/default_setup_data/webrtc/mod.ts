// @generated file -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

import type { Tagged } from "../../../../../../lib/mod.ts";

/**
 * Represents the role of a WebRTC participant in a connection.
 */
export type WebRTCRoleDX = Tagged<"Offerer"> | Tagged<"Answerer">;

/**
 * Represents an ICE server configuration for WebRTC.
 */
export type RTCIceServerDX = {
    urls: string[];
    username: null | string;
    credential: null | string;
};

/**
 * Represents the setup data required for establishing a WebRTC interface.
 */
export type WebRTCInterfaceSetupData = {
    role: WebRTCRoleDX;
    data_channel_label: string;
    ice_servers: RTCIceServerDX[];
    negotiated_data_channel_id: null | number;
    ordered: boolean;
};

/**
 * Represents an ICE candidate initialization message in WebRTC.
 */
export type RTCIceCandidateInitDX = {
    candidate: string;
    sdp_mid: null | string;
    sdp_mline_index: null | number;
    username_fragment: null | string;
};

/**
 * Represents the type of a WebRTC session description.
 */
export type RTCSdpTypeDX = Tagged<"Unspecified"> | Tagged<"Answer"> | Tagged<"Offer">;

/**
 * Represents a WebRTC session description.
 */
export type RTCSessionDescriptionDX = {
    type: RTCSdpTypeDX;
    sdp: string;
};

export type WebRTCSignalDX = Tagged<"Description", RTCSessionDescriptionDX> | Tagged<"IceCandidate", RTCIceCandidateInitDX> | Tagged<"EndOfCandidates">;