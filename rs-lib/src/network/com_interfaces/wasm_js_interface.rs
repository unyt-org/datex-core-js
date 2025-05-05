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
use datex_core::network::com_interfaces::socket_provider::SingleSocketProvider;
use datex_core::stdlib::sync::Arc;
use datex_core::{delegate_com_interface_info, set_opener};

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;

use crate::define_registry;
use crate::js_utils::TryAsByteSlice;
use log::{debug, error, info};
use wasm_bindgen::prelude::{wasm_bindgen, Closure};
use wasm_bindgen::{JsCast, JsError, JsValue};
use web_sys::{MessageEvent, RtcPeerConnection};
use datex_core::network::com_hub::InterfacePriority;
use datex_core::network::com_interfaces::default_com_interfaces::webrtc::webrtc_common::{RTCIceServer, WebRTCError, WebRTCInterfaceTrait};
use datex_macros::{com_interface, create_opener};

pub struct WebRTCJSInterface {
    info: ComInterfaceInfo,
    peer_connection: Option<RtcPeerConnection>,
    data_channel: Option<web_sys::RtcDataChannel>,
}

#[async_trait(?Send)]
impl WebRTCInterfaceTrait for WebRTCJSInterface {
    fn new(endpoint: impl Into<Endpoint>) -> Self {
        let endpoint = endpoint.into();
        WebRTCJSInterface {
            peer_connection: None,
            data_channel: None,
            info: ComInterfaceInfo::new(),
        }
    }

    fn set_ice_servers(self, ice_servers: Vec<RTCIceServer>) -> Self {
        self
    }
    fn new_with_media_support(endpoint: impl Into<Endpoint>) -> Self {
        let endpoint = endpoint.into();
        WebRTCJSInterface {
            data_channel: None,
            peer_connection: None,
            info: ComInterfaceInfo::new(),
        }
    }
    async fn create_offer(&mut self, use_reliable_connection: bool) -> Vec<u8> {
        let peer_connection = self.peer_connection.as_ref().unwrap();
        let data_channel = peer_connection.create_data_channel("datex");
        let sockets = self.get_sockets();
        let onmessage_callback = Self::on_receive(sockets.clone());
        data_channel
            .set_onmessage(Some(onmessage_callback.as_ref().unchecked_ref()));
        onmessage_callback.forget();
        self.data_channel = Some(data_channel.clone());

        vec![]
    }
    async fn set_remote_description(
        &self,
        description: Vec<u8>,
    ) -> Result<(), WebRTCError> {
        Ok(())
    }
    async fn add_ice_candidate(
        &mut self,
        candidate: Vec<u8>,
    ) -> Result<(), WebRTCError> {
        Ok(())
    }
    async fn create_answer(&self) -> Vec<u8> {
        vec![]
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

        let ondatachannel_callback =
            Closure::<dyn FnMut(_)>::new(move |ev: RtcDataChannelEvent| {
                let dc2 = ev.channel();

                let onmessage_callback =
                    Self::on_receive(self.get_sockets().clone());
                dc2.set_onmessage(Some(
                    onmessage_callback.as_ref().unchecked_ref(),
                ));
                onmessage_callback.forget();

                let dc2_clone = dc2.clone();
                let onopen_callback = Closure::<dyn FnMut()>::new(move || {
                    dc2_clone.send_with_str("Ping from pc2.dc!").unwrap();
                });
                dc2.set_onopen(Some(onopen_callback.as_ref().unchecked_ref()));
                onopen_callback.forget();
            });
        connection.set_ondatachannel(Some(
            ondatachannel_callback.as_ref().unchecked_ref(),
        ));
        ondatachannel_callback.forget();

        self.peer_connection = Some(connection.clone());

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

define_registry!(WebRTCRegistry);

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
}
