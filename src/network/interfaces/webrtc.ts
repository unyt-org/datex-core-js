// import type { ComInterfaceFactory, SocketConfiguration } from "../com-hub.ts";
// import { tagged } from "datex/lib/special-core-types/tagged.ts";
// import { DIFHandler } from "datex/dif/dif-handler.ts";
// import {
//     RTCIceCandidateInitDX,
//     WebRTCRoleDX,
//     type WebRTCSignalDX,
// } from "../../datex-web/types/network/com_interfaces/default_setup_data/webrtc/mod.ts";
// import type { WebRTCInterfaceSetupDataJS } from "../../datex-web/types/network/com_interfaces/webrtc/mod.ts";
// import { Tagged } from "../../lib/mod.ts";

// export interface WebRTCSignaling {
//     send(signal: WebRTCSignalDX): Promise<void>;
//     receive(): Promise<WebRTCSignalDX>;
// }

// export function createWebrtcComInterfaceFactory(): ComInterfaceFactory<WebRTCInterfaceSetupDataJS> {
//     return {
//         interfaceType: "webrtc",
//         factory: (setupData) => {
//             return {
//                 properties: {
//                     interface_type: "webrtc",
//                     channel: "webrtc",
//                     name: "webrtc",
//                     direction: tagged("InOut"),
//                     round_trip_time: 0,
//                     max_bandwidth: 0,
//                     continuous_connection: true,
//                     allow_redirects: false,
//                     is_secure_channel: true,
//                     reconnection_config: tagged("NoReconnect"),
//                     auto_identify: true,
//                     connectable_interfaces: [],
//                 },
//                 has_single_socket: false,
//                 new_sockets_iterator: new ReadableStream<SocketConfiguration>({
//                     async start(controller) {
//                         const socket = await createWebrtcSocket(setupData);
//                         controller.enqueue(socket);
//                     },
//                 }),
//             };
//         },
//     };
// }
// const signaling = createLocalWebRTCSignalingPair();

// async function createWebrtcSocket(
//     setup: WebRTCInterfaceSetupDataJS,
// ): Promise<SocketConfiguration> {
//     const peerConnection = new RTCPeerConnection({
//         iceServers: setup.ice_servers.map((server) => ({
//             urls: server.urls,
//             username: server.username ?? undefined,
//             credential: server.credential ?? undefined,
//         } satisfies RTCIceServer)),
//     });

//     const isOfferer = setup.role.tag === "Offerer";
//     installIceCallback(peerConnection, isOfferer ? signaling.offerer : signaling.answerer);

//     const dataChannel = isOfferer
//         ? await createOffererChannel(setup, peerConnection)
//         : await createAnswererChannel(setup, peerConnection);

//     dataChannel.binaryType = "arraybuffer";

//     const incomingDataStream = createDataChannelReadableStream(
//         dataChannel,
//         peerConnection,
//     );

//     return {
//         properties: DIFHandler.convertJSValueToDIFValueContainer({
//             direction: tagged("InOut"),
//             channel_factor: 1,
//             direct_endpoint: null,
//         }),

//         iterator: incomingDataStream,
//         send_callback: (data: ArrayBuffer) => {
//             if (dataChannel.readyState !== "open") {
//                 throw new Error(
//                     `Cannot send over WebRTC data channel in state ${dataChannel.readyState}`,
//                 );
//             }
//             dataChannel.send(data);
//         },
//     };
// }

// function installIceCallback(
//     peerConnection: RTCPeerConnection,
//     signaling: WebRTCSignaling,
// ) {
//     peerConnection.onicecandidate = (event) => {
//         void (async () => {
//             if (event.candidate) {
//                 const candidate = event.candidate.toJSON();
//                 const init: RTCIceCandidateInitDX = {
//                     candidate: candidate.candidate!,
//                     sdp_mid: candidate.sdpMid ?? null,
//                     sdp_mline_index: candidate.sdpMLineIndex ?? null,
//                     username_fragment: candidate.usernameFragment ?? null,
//                 };
//                 await signaling.send(new Tagged("IceCandidate", init));
//             } else {
//                 await signaling.send(new Tagged<"EndOfCandidates">("EndOfCandidates"));
//             }
//         })();
//     };
// }

// async function createOffererChannel(
//     setup: WebRTCInterfaceSetupDataJS,
//     peerConnection: RTCPeerConnection,
// ): Promise<RTCDataChannel> {
//     const dataChannel = peerConnection.createDataChannel(
//         setup.data_channel_label ?? "datex",
//         {
//             ordered: setup.ordered ?? true,
//             negotiated: setup.negotiated_data_channel_id !== undefined,
//             id: setup.negotiated_data_channel_id ?? undefined,
//         },
//     );

//     dataChannel.binaryType = "arraybuffer";

//     const openPromise = waitForDataChannelOpen(dataChannel);

//     const offer = await peerConnection.createOffer();
//     await peerConnection.setLocalDescription(offer);

//     await setup.signaling.send({
//         type: "Description",
//         description: {
//             sdp_type: "Offer",
//             sdp: offer.sdp ?? "",
//         },
//     });

//     let gotAnswer = false;

//     while (!gotAnswer) {
//         const signal = await setup.signaling.receive();

//         if (signal.type === "Description") {
//             if (signal.description.sdp_type !== "Answer") {
//                 throw new Error("Expected WebRTC answer");
//             }

//             await peerConnection.setRemoteDescription({
//                 type: "answer",
//                 sdp: signal.description.sdp,
//             });

//             gotAnswer = true;
//         } else {
//             await handleIceSignal(peerConnection, signal);
//         }
//     }

//     await openPromise;

//     return dataChannel;
// }

// async function createAnswererChannel(
//     setup: WebRTCInterfaceSetupDataJS,
//     peerConnection: RTCPeerConnection,
// ): Promise<RTCDataChannel> {
//     const dataChannelPromise = waitForRemoteDataChannel(peerConnection);

//     let gotOffer = false;

//     while (!gotOffer) {
//         const signal = await setup.signaling.receive();

//         if (signal.type === "Description") {
//             if (signal.description.sdp_type !== "Offer") {
//                 throw new Error("Expected WebRTC offer");
//             }

//             await peerConnection.setRemoteDescription({
//                 type: "offer",
//                 sdp: signal.description.sdp,
//             });

//             const answer = await peerConnection.createAnswer();
//             await peerConnection.setLocalDescription(answer);

//             await setup.signaling.send({
//                 type: "Description",
//                 description: {
//                     sdp_type: "Answer",
//                     sdp: answer.sdp ?? "",
//                 },
//             });

//             gotOffer = true;
//         } else {
//             await handleIceSignal(peerConnection, signal);
//         }
//     }

//     const dataChannel = await dataChannelPromise;
//     dataChannel.binaryType = "arraybuffer";

//     await waitForDataChannelOpen(dataChannel);

//     return dataChannel;
// }

// async function handleIceSignal(
//     peerConnection: RTCPeerConnection,
//     signal: WebRTCSignalDX,
// ) {
//     if (signal.tag === "IceCandidate") {
//         await peerConnection.addIceCandidate(signal.value);
//     } else if (signal.tag === "EndOfCandidates") {
//         await peerConnection.addIceCandidate(null);
//     }
// }

// function waitForRemoteDataChannel(
//     peerConnection: RTCPeerConnection,
// ): Promise<RTCDataChannel> {
//     return new Promise((resolve) => {
//         peerConnection.ondatachannel = (event) => {
//             resolve(event.channel);
//         };
//     });
// }

// function waitForDataChannelOpen(
//     dataChannel: RTCDataChannel,
// ): Promise<void> {
//     if (dataChannel.readyState === "open") {
//         return Promise.resolve();
//     }

//     return new Promise((resolve, reject) => {
//         dataChannel.addEventListener("open", () => resolve(), { once: true });
//         dataChannel.addEventListener(
//             "error",
//             () => reject(new Error("WebRTC data channel error before open")),
//             { once: true },
//         );
//         dataChannel.addEventListener(
//             "close",
//             () => reject(new Error("WebRTC data channel closed before open")),
//             { once: true },
//         );
//     });
// }

// function createDataChannelReadableStream(
//     dataChannel: RTCDataChannel,
//     peerConnection: RTCPeerConnection,
// ): ReadableStream<ArrayBuffer> {
//     return new ReadableStream<ArrayBuffer>({
//         start(controller) {
//             dataChannel.addEventListener("message", (event) => {
//                 if (event.data instanceof ArrayBuffer) {
//                     controller.enqueue(event.data);
//                     return;
//                 }
//                 if (event.data instanceof Blob) {
//                     void event.data.arrayBuffer().then((buffer) => {
//                         controller.enqueue(buffer);
//                     });
//                     return;
//                 }
//                 console.warn("Ignoring non-binary WebRTC DataChannel message");
//             });

//             dataChannel.addEventListener("error", () => {
//                 controller.error(new Error("WebRTC DataChannel error"));
//             });
//             dataChannel.addEventListener("close", () => {
//                 controller.close();
//             });
//         },

//         cancel() {
//             dataChannel.close();
//             peerConnection.close();
//         },
//     });
// }

// export interface WebRTCSignaling {
//     send(signal: WebRTCSignalDX): Promise<void>;
//     receive(): Promise<WebRTCSignalDX>;
// }

// class AsyncSignalQueue<T> {
//     private queue: T[] = [];
//     private waiters: Array<(value: T) => void> = [];

//     push(value: T) {
//         const waiter = this.waiters.shift();
//         if (waiter) {
//             waiter(value);
//         } else {
//             this.queue.push(value);
//         }
//     }

//     receive(): Promise<T> {
//         const value = this.queue.shift();
//         if (value !== undefined) {
//             return Promise.resolve(value);
//         }
//         return new Promise<T>((resolve) => {
//             this.waiters.push(resolve);
//         });
//     }
// }

// export function createLocalWebRTCSignalingPair(): {
//     offerer: WebRTCSignaling;
//     answerer: WebRTCSignaling;
// } {
//     const offererToAnswerer = new AsyncSignalQueue<WebRTCSignalDX>();
//     const answererToOfferer = new AsyncSignalQueue<WebRTCSignalDX>();

//     const cloneSignal = (signal: WebRTCSignalDX): WebRTCSignalDX => {
//         return structuredClone(signal);
//     };

//     return {
//         offerer: {
//             async send(signal) {
//                 await offererToAnswerer.push(cloneSignal(signal));
//             },
//             receive() {
//                 return answererToOfferer.receive();
//             },
//         },

//         answerer: {
//             async send(signal) {
//                 await answererToOfferer.push(cloneSignal(signal));
//             },

//             receive() {
//                 return offererToAnswerer.receive();
//             },
//         },
//     };
// }
