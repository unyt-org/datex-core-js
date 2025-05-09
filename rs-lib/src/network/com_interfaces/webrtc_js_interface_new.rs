use std::cell::RefCell;
use std::collections::VecDeque;
use std::default;
use std::future::Future;
use std::pin::Pin;
use std::rc::Rc;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use async_trait::async_trait;
use datex_core::datex_values::Endpoint;
use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceInfo, ComInterfaceSockets, ComInterfaceUUID,
};
use datex_core::network::com_interfaces::com_interface_properties::{
    InterfaceDirection, InterfaceProperties,
};
use datex_core::network::com_interfaces::com_interface_socket::{
    ComInterfaceSocket, ComInterfaceSocketUUID,
};
use datex_core::network::com_interfaces::default_com_interfaces::serial;
use datex_core::network::com_interfaces::socket_provider::SingleSocketProvider;
use datex_core::stdlib::sync::Arc;
use datex_core::{delegate_com_interface_info, set_opener};

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use js_sys::{Function, Reflect, JSON};
use serde::{Deserialize, Serialize};
use wasm_bindgen_futures::JsFuture;

use crate::define_registry;
use crate::js_utils::TryAsByteSlice;
use log::{debug, error, info};
use wasm_bindgen::prelude::{wasm_bindgen, Closure};
use wasm_bindgen::{JsCast, JsError, JsValue};
use web_sys::{MessageEvent, RtcDataChannelEvent, RtcIceCandidate, RtcIceCandidateInit, RtcPeerConnection, RtcPeerConnectionIceEvent, RtcSdpType, RtcSessionDescriptionInit, RtcSignalingState};
use datex_core::network::com_hub::InterfacePriority;
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common::{deserialize, serialize, RTCIceServer, WebRTCError, WebRTCInterfaceTrait};
use datex_macros::{com_interface, create_opener};

pub struct WebRTCCommon {
    pub endpoint: Endpoint,
    candidates: VecDeque<Vec<u8>>,
    is_remote_description_set: bool,
    on_ice_candidate: Option<Box<dyn Fn(Vec<u8>)>>,
}
impl WebRTCCommon {
    pub fn new(endpoint: impl Into<Endpoint>) -> Self {
        WebRTCCommon {
            endpoint: endpoint.into(),
            candidates: VecDeque::new(),
            is_remote_description_set: false,
            on_ice_candidate: None,
        }
    }
    fn on_ice_candidate(&self, candidate: RTCIceCandidateInitDX) {
        if let Some(ref on_ice_candidate) = self.on_ice_candidate {
            if let Ok(candidate) = serialize(&candidate) {
                on_ice_candidate(candidate);
            } else {
                error!("Failed to serialize candidate");
            }
        } else {
            error!("No on_ice_candidate callback set");
        }
    }
}

#[async_trait(?Send)]
pub trait WebRTCTrait {
    fn new(peer_endpoint: impl Into<Endpoint>) -> Self;
    fn get_commons(&self) -> Rc<RefCell<WebRTCCommon>>;
    fn remote_endpoint(&self) -> Endpoint {
        self.get_commons().borrow().endpoint.clone()
    }
    fn set_on_ice_candidate(&mut self, on_ice_candidate: Box<dyn Fn(Vec<u8>)>) {
        self.get_commons().borrow_mut().on_ice_candidate =
            Some(on_ice_candidate);
    }

    fn on_ice_candidate(&self, candidate: RTCIceCandidateInitDX) {
        let commons = self.get_commons();
        commons.borrow().on_ice_candidate(candidate);
    }

    async fn add_ice_candidate(
        &self,
        candidate: Vec<u8>,
    ) -> Result<(), WebRTCError> {
        let info = self.get_commons();
        if info.borrow().is_remote_description_set {
            let candidate = deserialize::<RTCIceCandidateInitDX>(&candidate)
                .map_err(|_| WebRTCError::InvalidCandidate)?;
            self.handle_add_ice_candidate(candidate).await?;
        } else {
            info.borrow_mut().candidates.push_back(candidate);
        }
        Ok(())
    }
    async fn create_offer(&self) -> Result<Vec<u8>, WebRTCError> {
        self.handle_create_data_channel().await?;
        self.handle_setup_data_channel().await?;
        let offer = self.handle_create_offer().await?;
        self.handle_set_local_description(offer.clone()).await?;
        let offer = serialize(&offer).unwrap();
        Ok(offer)
    }
    async fn create_answer(
        &self,
        offer: Vec<u8>,
    ) -> Result<Vec<u8>, WebRTCError> {
        self.set_remote_description(offer).await?;
        let answer = self.handle_create_answer().await?;
        self.handle_set_local_description(answer.clone()).await?;
        let answer = serialize(&answer).unwrap();
        Ok(answer)
    }
    async fn set_remote_description(
        &self,
        description: Vec<u8>,
    ) -> Result<(), WebRTCError> {
        let description = deserialize::<RTCSessionDescriptionDX>(&description)
            .map_err(|_| WebRTCError::InvalidSdp)?;
        self.handle_set_remote_description(description).await?;
        self.get_commons().borrow_mut().is_remote_description_set = true;
        for candidate in self.get_commons().borrow_mut().candidates.drain(..) {
            if let Ok(candidate) =
                deserialize::<RTCIceCandidateInitDX>(&candidate)
            {
                self.handle_add_ice_candidate(candidate).await?;
            } else {
                error!("Failed to deserialize candidate");
            }
        }
        Ok(())
    }
    async fn set_answer(&self, answer: Vec<u8>) -> Result<(), WebRTCError> {
        let session_description =
            deserialize::<RTCSessionDescriptionDX>(&answer)
                .map_err(|_| WebRTCError::InvalidSdp)?;
        self.handle_set_remote_description(session_description)
            .await
    }
    async fn handle_create_data_channel(&self) -> Result<(), WebRTCError>;
    async fn handle_setup_data_channel(&self) -> Result<(), WebRTCError>;
    async fn handle_create_offer(
        &self,
    ) -> Result<RTCSessionDescriptionDX, WebRTCError>;
    async fn handle_add_ice_candidate(
        &self,
        candidate: RTCIceCandidateInitDX,
    ) -> Result<(), WebRTCError>;
    async fn handle_set_local_description(
        &self,
        description: RTCSessionDescriptionDX,
    ) -> Result<(), WebRTCError>;
    async fn handle_set_remote_description(
        &self,
        description: RTCSessionDescriptionDX,
    ) -> Result<(), WebRTCError>;
    async fn handle_create_answer(
        &self,
    ) -> Result<RTCSessionDescriptionDX, WebRTCError>;
}

#[derive(Default, Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RTCIceCandidateInitDX {
    pub candidate: String,
    pub sdp_mid: Option<String>,
    #[serde(rename = "sdpMLineIndex")]
    pub sdp_mline_index: Option<u16>,
    pub username_fragment: Option<String>,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub enum RTCSdpTypeDX {
    #[default]
    Unspecified,
    #[serde(rename = "answer")]
    Answer,
    #[serde(rename = "offer")]
    Offer,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize)]
pub struct RTCSessionDescriptionDX {
    #[serde(rename = "type")]
    pub sdp_type: RTCSdpTypeDX,
    pub sdp: String,
}

pub struct WebRTCJSInterfaceNew {
    pub info: ComInterfaceInfo,
    pub commons: Rc<RefCell<WebRTCCommon>>,
    pub peer_connection: Rc<Option<RtcPeerConnection>>,
    data_channel: Rc<RefCell<Option<web_sys::RtcDataChannel>>>,
}
#[async_trait(?Send)]
impl WebRTCTrait for WebRTCJSInterfaceNew {
    fn new(peer_endpoint: impl Into<Endpoint>) -> Self {
        WebRTCJSInterfaceNew {
            info: ComInterfaceInfo::default(),
            commons: Rc::new(RefCell::new(WebRTCCommon::new(peer_endpoint))),
            peer_connection: Rc::new(None),
            data_channel: Rc::new(RefCell::new(None)),
        }
    }

    async fn handle_create_data_channel(&self) -> Result<(), WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let data_channel = peer_connection.create_data_channel("datex");
            self.data_channel.borrow_mut().replace(data_channel);
        }
        Ok(())
    }
    async fn handle_setup_data_channel(&self) -> Result<(), WebRTCError> {
        if let Some(data_channel) = self.data_channel.borrow().as_ref() {
            let data_channel_clone = data_channel.clone();
            let self_data_channel = self.data_channel.clone();
            let onopen_callback = Closure::<dyn FnMut()>::new(move || {
                info!("Data channel opened sender");
                self_data_channel
                    .borrow_mut()
                    .replace(data_channel_clone.clone());
            });
            data_channel
                .set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
            onopen_callback.forget();
            Ok(())
        } else {
            error!("Data channel is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }
    async fn handle_create_offer(
        &self,
    ) -> Result<RTCSessionDescriptionDX, WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let offer = JsFuture::from(peer_connection.create_offer())
                .await
                .unwrap();
            let sdp: String = Reflect::get(&offer, &JsValue::from_str("sdp"))
                .unwrap()
                .as_string()
                .unwrap();
            info!("Offer created {}", sdp);
            Ok(RTCSessionDescriptionDX {
                sdp_type: RTCSdpTypeDX::Offer,
                sdp,
            })
        } else {
            error!("Peer connection is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }

    async fn handle_add_ice_candidate(
        &self,
        candidate_init: RTCIceCandidateInitDX,
    ) -> Result<(), WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let signaling_state = peer_connection.signaling_state();

            // Ensure remote description is set
            if signaling_state != RtcSignalingState::Stable
                && signaling_state != RtcSignalingState::HaveLocalOffer
                && signaling_state != RtcSignalingState::HaveRemoteOffer
            {
                return Err(WebRTCError::MissingRemoteDescription);
            }
            let js_candidate_init =
                RtcIceCandidateInit::new(&candidate_init.candidate);
            js_candidate_init.set_sdp_mid(candidate_init.sdp_mid.as_deref());
            js_candidate_init
                .set_sdp_m_line_index(candidate_init.sdp_mline_index);
            JsFuture::from(
                peer_connection
                    .add_ice_candidate_with_opt_rtc_ice_candidate_init(Some(
                        &js_candidate_init,
                    )),
            )
            .await
            .map_err(|e| {
                error!("Failed to add ICE candidate {:?}", e);
                WebRTCError::InvalidCandidate
            })?;
            Ok(())
        } else {
            error!("Peer connection is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }

    async fn handle_set_local_description(
        &self,
        description: RTCSessionDescriptionDX,
    ) -> Result<(), WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let description_init =
                RtcSessionDescriptionInit::new(match description.sdp_type {
                    RTCSdpTypeDX::Offer => RtcSdpType::Offer,
                    RTCSdpTypeDX::Answer => RtcSdpType::Answer,
                    _ => Err(WebRTCError::InvalidSdp)?,
                });
            description_init.set_sdp(&description.sdp);
            JsFuture::from(
                peer_connection.set_local_description(&description_init),
            )
            .await
            .unwrap();
            Ok(())
        } else {
            error!("Peer connection is not initialized");
            return Err(WebRTCError::ConnectionError);
        }
    }

    async fn handle_set_remote_description(
        &self,
        description: RTCSessionDescriptionDX,
    ) -> Result<(), WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let description_init =
                RtcSessionDescriptionInit::new(match description.sdp_type {
                    RTCSdpTypeDX::Offer => RtcSdpType::Offer,
                    RTCSdpTypeDX::Answer => RtcSdpType::Answer,
                    _ => Err(WebRTCError::InvalidSdp)?,
                });
            description_init.set_sdp(&description.sdp);
            JsFuture::from(
                peer_connection.set_remote_description(&description_init),
            )
            .await
            .unwrap();
            Ok(())
        } else {
            error!("Peer connection is not initialized");
            return Err(WebRTCError::ConnectionError);
        }
    }

    async fn handle_create_answer(
        &self,
    ) -> Result<RTCSessionDescriptionDX, WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let answer = JsFuture::from(peer_connection.create_answer())
                .await
                .unwrap();
            let sdp = Reflect::get(&answer, &JsValue::from_str("sdp"))
                .unwrap()
                .as_string()
                .unwrap();
            Ok(RTCSessionDescriptionDX {
                sdp_type: RTCSdpTypeDX::Answer,
                sdp,
            })
        } else {
            error!("Peer connection is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }

    fn get_commons(&self) -> Rc<RefCell<WebRTCCommon>> {
        self.commons.clone()
    }
}

#[com_interface]
impl WebRTCJSInterfaceNew {
    pub fn new(endpoint: impl Into<Endpoint>) -> Self {
        WebRTCJSInterfaceNew {
            info: ComInterfaceInfo::default(),
            commons: Rc::new(RefCell::new(WebRTCCommon::new(endpoint))),
            peer_connection: Rc::new(None),
            data_channel: Rc::new(RefCell::new(None)),
        }
    }
    #[create_opener]
    async fn open(&mut self) -> Result<(), WebRTCError> {
        let connection =
            RtcPeerConnection::new().map_err(|_| WebRTCError::Unsupported)?;
        let remote_endpoint = self.remote_endpoint().clone().to_string();

        let commons = self.get_commons();
        let onicecandidate_callback = Closure::<dyn FnMut(_)>::new(
            move |ev: RtcPeerConnectionIceEvent| {
                if let Some(candidate) = ev.candidate() {
                    commons.clone().borrow_mut().on_ice_candidate(
                        RTCIceCandidateInitDX {
                            candidate: candidate.candidate(),
                            sdp_mid: candidate.sdp_mid(),
                            sdp_mline_index: candidate.sdp_m_line_index(),
                            username_fragment: None,
                        },
                    );
                }
            },
        );
        connection.set_onicecandidate(Some(
            onicecandidate_callback.as_ref().unchecked_ref(),
        ));
        onicecandidate_callback.forget();

        let connection = Rc::new(Some(connection));
        self.peer_connection = connection.clone();
        let connection_clone = connection.clone();
        let oniceconnectionstatechange_callback =
            Closure::<dyn FnMut()>::new(move || {
                if let Some(connection) = connection_clone.as_ref() {
                    let state = connection.ice_connection_state();
                    info!(
                        "ICE connection state of remote {}: {:?}",
                        remote_endpoint, state
                    );
                }
            });
        if let Some(connection) = connection.as_ref() {
            connection.clone().set_oniceconnectionstatechange(Some(
                oniceconnectionstatechange_callback.as_ref().unchecked_ref(),
            ));
            oniceconnectionstatechange_callback.forget();
        }
        Ok(())
    }
}

impl ComInterface for WebRTCJSInterfaceNew {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        _: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move { false })
    }

    fn init_properties(&self) -> InterfaceProperties {
        InterfaceProperties {
            interface_type: "webrtc".to_string(),
            channel: "webrtc".to_string(),
            round_trip_time: Duration::from_millis(40),
            max_bandwidth: 1000,
            ..InterfaceProperties::default()
        }
    }
    fn handle_close<'a>(
        &'a mut self,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move { false })
    }
    delegate_com_interface_info!();
    set_opener!(open);
}

define_registry!(WebRTCRegistryNew, WebRTCJSInterfaceNew);
#[wasm_bindgen]
impl WebRTCRegistryNew {
    pub async fn register(&self, endpoint: &str) -> Result<String, JsError> {
        let com_hub = self.com_hub.clone();
        let mut webrtc_interface = WebRTCJSInterfaceNew::new(endpoint);
        let uuid = webrtc_interface.get_uuid().clone();
        webrtc_interface
            .open()
            .await
            .map_err(|e| JsError::new(&format!("{e:?}")))?;

        com_hub
            .add_interface(
                Rc::new(RefCell::new(webrtc_interface)),
                InterfacePriority::default(),
            )
            .map_err(|e| JsError::new(&format!("{e:?}")))?;
        Ok(uuid.0.to_string())
    }

    pub async fn create_offer(
        &self,
        interface_uuid: String,
    ) -> Result<Vec<u8>, JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        let offer = webrtc_interface.create_offer().await?;
        Ok(offer)
    }

    pub async fn create_answer(
        &self,
        interface_uuid: String,
        offer: Vec<u8>,
    ) -> Result<Vec<u8>, JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        let answer = webrtc_interface.create_answer(offer).await?;
        Ok(answer)
    }

    pub async fn set_answer(
        &self,
        interface_uuid: String,
        answer: Vec<u8>,
    ) -> Result<(), JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        webrtc_interface.set_answer(answer).await?;
        Ok(())
    }
    pub async fn set_on_ice_candidate(
        &self,
        interface_uuid: String,
        on_ice_candidate: Function,
    ) -> Result<(), JsError> {
        let interface = self.get_interface(interface_uuid);
        let mut webrtc_interface = interface.borrow_mut();
        webrtc_interface.set_on_ice_candidate(Box::new(move |candidate| {
            on_ice_candidate
                .call1(&JsValue::NULL, &JsValue::from(candidate))
                .unwrap();
        }));
        Ok(())
    }

    pub async fn add_ice_candidate(
        &self,
        interface_uuid: String,
        candidate: Vec<u8>,
    ) -> Result<(), JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        webrtc_interface.add_ice_candidate(candidate).await?;
        Ok(())
    }
}
