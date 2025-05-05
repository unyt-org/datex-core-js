use std::cell::RefCell;
use std::collections::VecDeque;
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
use datex_core::network::com_interfaces::socket_provider::SingleSocketProvider;
use datex_core::stdlib::sync::Arc;
use datex_core::{delegate_com_interface_info, set_opener};

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use js_sys::{Function, Reflect, JSON};
use wasm_bindgen_futures::JsFuture;

use crate::define_registry;
use crate::js_utils::TryAsByteSlice;
use log::{debug, error, info};
use wasm_bindgen::prelude::{wasm_bindgen, Closure};
use wasm_bindgen::{JsCast, JsError, JsValue};
use web_sys::{MessageEvent, RtcDataChannelEvent, RtcIceCandidate, RtcIceCandidateInit, RtcPeerConnection, RtcPeerConnectionIceEvent, RtcSdpType, RtcSessionDescriptionInit};
use datex_core::network::com_hub::InterfacePriority;
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common::{deserialize, serialize, RTCIceServer, WebRTCError, WebRTCInterfaceTrait};
use datex_macros::{com_interface, create_opener};

pub struct WebRTCJSInterface {
    info: ComInterfaceInfo,
    pub remote_endpoint: Endpoint,
    peer_connection: Rc<Option<RtcPeerConnection>>,
    data_channel: Arc<Mutex<Option<web_sys::RtcDataChannel>>>,
    pub ice_candidates: Rc<RefCell<VecDeque<Vec<u8>>>>,

    on_ice_candidate: Rc<RefCell<Option<Function>>>,
}

#[async_trait(?Send)]
impl WebRTCInterfaceTrait for WebRTCJSInterface {
    fn new(endpoint: impl Into<Endpoint>) -> Self {
        let endpoint = endpoint.into();
        WebRTCJSInterface {
            remote_endpoint: endpoint,
            peer_connection: Rc::new(None),
            data_channel: Arc::new(Mutex::new(None)),
            info: ComInterfaceInfo::new(),
            on_ice_candidate: Rc::new(RefCell::new(None)),
            ice_candidates: Rc::new(RefCell::new(VecDeque::new())),
        }
    }

    fn set_ice_servers(self, ice_servers: Vec<RTCIceServer>) -> Self {
        self
    }
    fn new_with_media_support(endpoint: impl Into<Endpoint>) -> Self {
        let endpoint = endpoint.into();
        WebRTCJSInterface::new(endpoint)
    }
    async fn create_offer(&self, use_reliable_connection: bool) -> Vec<u8> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let data_channel = peer_connection.create_data_channel("xxx");

            let sockets = self.get_sockets();
            let onmessage_callback = Self::on_receive(sockets.clone());
            data_channel.set_onmessage(Some(
                onmessage_callback.as_ref().unchecked_ref(),
            ));
            let data_channel_clone = data_channel.clone();
            let self_data_channel = self.data_channel.clone();
            let onopen_callback = Closure::<dyn FnMut()>::new(move || {
                info!("Data channel opened sender");
                self_data_channel
                    .clone()
                    .lock()
                    .unwrap()
                    .replace(data_channel_clone.clone());
            });
            data_channel
                .set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));

            onmessage_callback.forget();

            let offer = JsFuture::from(peer_connection.create_offer())
                .await
                .unwrap();

            // FIXME only sdp or also other fields?
            let offer_sdp = Reflect::get(&offer, &JsValue::from_str("sdp"))
                .unwrap()
                .as_string()
                .unwrap();

            info!("Offer created {}", offer_sdp);

            let offer_obj = RtcSessionDescriptionInit::new(RtcSdpType::Offer);
            offer_obj.set_sdp(&offer_sdp);
            let sld_promise = peer_connection.set_local_description(&offer_obj);
            JsFuture::from(sld_promise).await.unwrap();
            serialize::<String>(&offer_sdp).unwrap()
        } else {
            panic!("Peer connection is not initialized");
        }
    }

    async fn create_answer(&self) -> Vec<u8> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let answer = JsFuture::from(peer_connection.create_answer())
                .await
                .unwrap();
            let answer_sdp = Reflect::get(&answer, &JsValue::from_str("sdp"))
                .unwrap()
                .as_string()
                .unwrap();

            let answer_obj = RtcSessionDescriptionInit::new(RtcSdpType::Answer);
            answer_obj.set_sdp(&answer_sdp);
            let sld_promise =
                peer_connection.set_local_description(&answer_obj);
            JsFuture::from(sld_promise).await.unwrap();
            serialize::<String>(&answer_sdp).unwrap()
        } else {
            panic!("Peer connection is not initialized");
        }
    }

    async fn set_remote_description(
        &self,
        description: Vec<u8>,
    ) -> Result<(), WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let offer_obj = RtcSessionDescriptionInit::new(RtcSdpType::Offer);
            let sdp = deserialize::<String>(&description)
                .map_err(|_| WebRTCError::InvalidSdp)?;
            offer_obj.set_sdp(&sdp);
            let srd_promise =
                peer_connection.set_remote_description(&offer_obj);
            JsFuture::from(srd_promise)
                .await
                .map_err(|_| WebRTCError::InvalidSdp)?;
            Ok(())
        } else {
            error!("Peer connection is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }

    async fn add_ice_candidate(
        &self,
        candidate: Vec<u8>,
    ) -> Result<(), WebRTCError> {
        if let Some(peer_connection) = self.peer_connection.as_ref() {
            let candidate_init = deserialize::<String>(&candidate).unwrap();
            let js_val = JSON::parse(&candidate_init).unwrap();

            info!("Adding ICE candidate: {:?}", js_val);

            let candidate_init: RtcIceCandidateInit = js_val.unchecked_into();

            // Step 4: Create the candidate
            let candidate = RtcIceCandidate::new(&candidate_init).unwrap();
            let add_ice_candidate_promise = peer_connection
                .add_ice_candidate_with_opt_rtc_ice_candidate(Some(&candidate));
            JsFuture::from(add_ice_candidate_promise)
                .await
                .map_err(|_| {
                    error!("Failed to add ICE candidate");
                    WebRTCError::InvalidCandidate
                })?;
            let uuid = self.get_uuid();

            let socket = ComInterfaceSocket::new(
                uuid.clone(),
                InterfaceDirection::InOut,
                1,
            );
            let socket_uuid = socket.uuid.clone();

            if self.get_socket().is_none() {
                self.add_socket(Arc::new(Mutex::new(socket)));
                self.register_socket_endpoint(
                    socket_uuid,
                    self.remote_endpoint.clone(),
                    1,
                )
                .unwrap();
            }
            Ok(())
        } else {
            error!("Peer connection is not initialized");
            Err(WebRTCError::ConnectionError)
        }
    }
}

impl SingleSocketProvider for WebRTCJSInterface {
    fn provide_sockets(&self) -> Arc<Mutex<ComInterfaceSockets>> {
        self.get_sockets()
    }
}

#[com_interface]
impl WebRTCJSInterface {
    #[create_opener]
    async fn open(&mut self) -> Result<(), WebRTCError> {
        let connection =
            RtcPeerConnection::new().map_err(|_| WebRTCError::Unsupported)?;
        let sockets = self.get_sockets();
        let self_data_channel = self.data_channel.clone();
        let ondatachannel_callback =
            Closure::<dyn FnMut(_)>::new(move |ev: RtcDataChannelEvent| {
                info!("Data channel event");
                let data_channel = ev.channel();
                let self_data_channel_clone = self_data_channel.clone();
                let onmessage_callback = Self::on_receive(sockets.clone());
                data_channel.set_onmessage(Some(
                    onmessage_callback.as_ref().unchecked_ref(),
                ));
                onmessage_callback.forget();

                let data_channel_clone = data_channel.clone();
                let onopen_callback = Closure::<dyn FnMut()>::new(move || {
                    let mut self_channel =
                        self_data_channel_clone.lock().unwrap();
                    if self_channel.is_none() {
                        info!("Data channel received");
                        self_channel.replace(data_channel_clone.clone());
                    }
                });
                data_channel
                    .set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
                onopen_callback.forget();
            });
        connection.set_ondatachannel(Some(
            ondatachannel_callback.as_ref().unchecked_ref(),
        ));
        ondatachannel_callback.forget();
        info!("Connecting to {}...", self.remote_endpoint);

        let ice_candidates = self.ice_candidates.clone();
        let self_callback = self.on_ice_candidate.clone();
        let other_endpoint = self.remote_endpoint.to_string().clone();
        let onicecandidate_callback = Closure::<dyn FnMut(_)>::new(
            move |ev: RtcPeerConnectionIceEvent| {
                if let Some(candidate) = ev.candidate() {
                    let candidate_init = candidate.to_json();
                    let candidate_init = JSON::stringify(&candidate_init)
                        .unwrap()
                        .as_string()
                        .unwrap();
                    let candidate_init = serialize(&candidate_init).unwrap();

                    if let Some(callback) = self_callback.borrow().as_ref() {
                        let _ = callback.call1(
                            &JsValue::NULL,
                            &candidate_init.clone().into(),
                        );
                    }

                    ice_candidates.borrow_mut().push_back(candidate_init);
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
        let remote_endpoint = self.remote_endpoint.clone().to_string();
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

    fn on_receive(
        sockets: Arc<Mutex<ComInterfaceSockets>>,
    ) -> Closure<dyn FnMut(MessageEvent)> {
        Closure::<dyn FnMut(_)>::new(move |ev: MessageEvent| {
            if let Ok(data) = ev.data().try_as_u8_slice() {
                debug!("Received message: {:?}", data);
                let sockets = sockets.lock().unwrap();
                let socket = sockets.sockets.values().next().unwrap();
                let socket = socket.lock().unwrap();
                let mut receive_queue = socket.receive_queue.lock().unwrap();
                receive_queue.extend(data);
            }
        })
    }
}

impl ComInterface for WebRTCJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        _: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move {
            let data_channel = self.data_channel.lock().unwrap();
            if let Some(data_channel) = data_channel.as_ref() {
                data_channel.send_with_u8_array(&block).unwrap();
                true
            } else {
                false
            }
        })
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
        let offer = webrtc_interface.create_offer(true).await;
        Ok(offer)
    }
    pub async fn set_remote_description(
        &self,
        interface_uuid: String,
        description: Vec<u8>,
    ) -> Result<(), JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        webrtc_interface.set_remote_description(description).await?;
        Ok(())
    }
    pub async fn create_answer(
        &self,
        interface_uuid: String,
    ) -> Result<Vec<u8>, JsError> {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        let answer = webrtc_interface.create_answer().await;
        Ok(answer)
    }

    pub fn set_on_ice_candidate(
        &self,
        interface_uuid: String,
        callback: &Function,
    ) {
        let interface = self.get_interface(interface_uuid);
        let webrtc_interface = interface.borrow();
        webrtc_interface
            .on_ice_candidate
            .borrow_mut()
            .replace(callback.clone());
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
