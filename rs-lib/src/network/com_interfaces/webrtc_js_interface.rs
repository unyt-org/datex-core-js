use std::cell::RefCell;
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
use datex_core::network::com_interfaces::com_interface_properties::InterfaceProperties;
use datex_core::network::com_interfaces::com_interface_socket::ComInterfaceSocketUUID;
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common_new::data_channels::{DataChannel, DataChannels};
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common_new::structures::{RTCIceCandidateInitDX, RTCIceServer, RTCSdpTypeDX, RTCSessionDescriptionDX};
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common_new::utils::WebRTCError;
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common_new::webrtc_commons::WebRTCCommon;
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common_new::webrtc_trait::{WebRTCTrait, WebRTCTraitInternal};
use datex_core::network::com_interfaces::socket_provider::SingleSocketProvider;
use datex_core::stdlib::sync::Arc;
use datex_core::task::spawn_local;
use datex_core::{delegate_com_interface_info, set_opener};

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use js_sys::{Array, Function, Reflect};
use wasm_bindgen_futures::JsFuture;

use crate::define_registry;
use crate::js_utils::TryAsByteSlice;
use datex_core::network::com_hub::InterfacePriority;
use datex_macros::{com_interface, create_opener};
use log::{error, info};
use wasm_bindgen::prelude::{wasm_bindgen, Closure};
use wasm_bindgen::{JsCast, JsError, JsValue};
use web_sys::{
    MessageEvent, RtcConfiguration, RtcDataChannel, RtcDataChannelEvent,
    RtcIceCandidateInit, RtcIceServer, RtcPeerConnection,
    RtcPeerConnectionIceEvent, RtcSdpType, RtcSessionDescriptionInit,
    RtcSignalingState,
};
pub struct WebRTCJSInterface {
    info: ComInterfaceInfo,
    commons: Rc<RefCell<WebRTCCommon>>,
    peer_connection: Rc<Option<RtcPeerConnection>>,
    data_channels: Rc<RefCell<DataChannels<RtcDataChannel>>>,
}
impl SingleSocketProvider for WebRTCJSInterface {
    fn provide_sockets(&self) -> Arc<Mutex<ComInterfaceSockets>> {
        self.get_sockets()
    }
}
impl WebRTCTrait<RtcDataChannel> for WebRTCJSInterface {
    fn new(peer_endpoint: impl Into<Endpoint>) -> Self {
        WebRTCJSInterface {
            info: ComInterfaceInfo::default(),
            commons: Rc::new(RefCell::new(WebRTCCommon::new(peer_endpoint))),
            peer_connection: Rc::new(None),
            data_channels: Rc::new(RefCell::new(DataChannels::new())),
        }
    }
    fn new_with_ice_servers(
        peer_endpoint: impl Into<Endpoint>,
        ice_servers: Vec<RTCIceServer>,
    ) -> Self {
        let interface = Self::new(peer_endpoint);
        interface.set_ice_servers(ice_servers);
        interface
    }
}

#[async_trait(?Send)]
impl WebRTCTraitInternal<RtcDataChannel> for WebRTCJSInterface {
    fn provide_data_channels(
        &self,
    ) -> Rc<RefCell<DataChannels<RtcDataChannel>>> {
        self.data_channels.clone()
    }
    fn provide_info(&self) -> &ComInterfaceInfo {
        &self.info
    }

    async fn handle_create_data_channel(
        &self,
    ) -> Result<DataChannel<RtcDataChannel>, WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let data_channel = peer_connection.create_data_channel("DATEX");
            Ok(DataChannel::new(data_channel.label(), data_channel))
        } else {
            error!("Peer connection is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }

    async fn handle_setup_data_channel(
        channel: Rc<RefCell<DataChannel<RtcDataChannel>>>,
    ) -> Result<(), WebRTCError> {
        let channel_clone = channel.clone();
        {
            let onopen_callback = Closure::<dyn FnMut()>::new(move || {
                if let Some(ref open_channel) =
                    channel_clone.borrow().open_channel
                {
                    info!("Data channel opened to");
                    open_channel(channel_clone.clone());
                }
            });
            channel
                .clone()
                .borrow()
                .data_channel
                .set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
            onopen_callback.forget();
        }
        let channel_clone = channel.clone();
        {
            let onmessage_callback = Closure::<dyn FnMut(MessageEvent)>::new(
                move |message_event: MessageEvent| {
                    let data_channel = channel_clone.borrow();
                    if let Some(ref on_message) = data_channel.on_message {
                        let data = message_event.data().try_as_u8_slice();
                        if let Ok(data) = data {
                            on_message(data);
                        }
                    }
                },
            );
            channel.clone().borrow().data_channel.set_onmessage(Some(
                onmessage_callback.as_ref().unchecked_ref(),
            ));
            onmessage_callback.forget();
        }
        Ok(())
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
            info!("Offer created {sdp}");
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
            info!(
                "Adding ICE candidate for {}: {:?}",
                self.remote_endpoint(),
                js_candidate_init
            );
            JsFuture::from(
                peer_connection
                    .add_ice_candidate_with_opt_rtc_ice_candidate_init(Some(
                        &js_candidate_init,
                    )),
            )
            .await
            .map_err(|e| {
                error!("Failed to add ICE candidate {e:?}");
                WebRTCError::InvalidCandidate
            })?;
            info!("ICE candidate added {}", self.remote_endpoint());
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
impl WebRTCJSInterface {
    #[create_opener]
    async fn open(&mut self) -> Result<(), WebRTCError> {
        let config = RtcConfiguration::new();

        {
            // ICE servers
            let ice_servers = self.get_commons().borrow().ice_servers.clone();
            let js_ice_servers = js_sys::Array::new();
            for server in ice_servers {
                let js_server = RtcIceServer::new();
                let urls_array = Array::new();
                for url in &server.urls {
                    urls_array.push(&JsValue::from_str(url));
                }
                js_server.set_urls(&urls_array);

                if let Some(username) = server.username {
                    js_server.set_username(&username);
                }
                if let Some(credential) = server.credential {
                    js_server.set_credential(&credential);
                }
                js_ice_servers.push(&js_server);
            }
            config.set_ice_servers(&js_ice_servers);
        }

        let connection = RtcPeerConnection::new_with_configuration(&config)
            .map_err(|_| WebRTCError::Unsupported)?;
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

        let data_channels = self.data_channels.clone();
        let ondatachannel_callback =
            Closure::<dyn FnMut(_)>::new(move |ev: RtcDataChannelEvent| {
                let data_channels = data_channels.clone();
                spawn_local(async move {
                    data_channels
                        .clone()
                        .borrow_mut()
                        .create_data_channel(
                            "DATEX".to_string(),
                            ev.channel().clone(),
                        )
                        .await;
                });
            });

        let connection_clone = connection.clone();
        let oniceconnectionstatechange_callback = Closure::<dyn FnMut()>::new(
            move || {
                if let Some(connection) = connection_clone.as_ref() {
                    let state = connection.ice_connection_state();
                    info!(
                        "ICE connection state of remote {remote_endpoint}: {state:?}"
                    );
                }
            },
        );
        if let Some(connection) = connection.as_ref() {
            connection.set_oniceconnectionstatechange(Some(
                oniceconnectionstatechange_callback.as_ref().unchecked_ref(),
            ));
            oniceconnectionstatechange_callback.forget();

            connection.set_ondatachannel(Some(
                ondatachannel_callback.as_ref().unchecked_ref(),
            ));
            ondatachannel_callback.forget();
        }
        self.setup_listeners();
        Ok(())
    }
}

impl ComInterface for WebRTCJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        _: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        let success = {
            if let Some(channel) =
                self.data_channels.borrow().get_data_channel("DATEX")
            {
                channel
                    .clone()
                    .borrow_mut()
                    .data_channel
                    .send_with_u8_array(block)
                    .is_ok()
            } else {
                error!("Failed to send message, data channel not found");
                false
            }
        };
        Box::pin(async move { success })
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
        let success = {
            if let Some(peer_connection) = self.peer_connection.as_ref() {
                peer_connection.close();
                let mut commons = self.commons.borrow_mut();
                commons.is_remote_description_set = false;
                commons.candidates.clear();
                commons.on_ice_candidate = None;
                self.peer_connection = Rc::new(None);

                let mut data_channels = self.data_channels.borrow_mut();
                data_channels.data_channels.clear();
                data_channels.on_add = None;

                true
            } else {
                false
            }
        };
        Box::pin(async move { success })
    }
    delegate_com_interface_info!();
    set_opener!(open);
}

define_registry!(WebRTCRegistry, WebRTCJSInterface);
#[wasm_bindgen]
impl WebRTCRegistry {
    pub async fn register(&self, endpoint: &str) -> Result<String, JsError> {
        let com_hub = self.com_hub.clone();
        let mut webrtc_interface = WebRTCJSInterface::new(endpoint);
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
    pub fn set_on_ice_candidate(
        &self,
        interface_uuid: String,
        on_ice_candidate: Function,
    ) -> Result<(), JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
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
