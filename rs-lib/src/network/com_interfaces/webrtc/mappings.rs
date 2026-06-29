use datex_core::network::com_interfaces::default_setup_data::webrtc::{
    RTCIceCandidateInitDX, RTCIceServerDX, RTCSdpTypeDX,
    RTCSessionDescriptionDX, WebRTCInterfaceSetupData, WebRTCSignalDX,
};
use wasm_bindgen::{JsCast, JsValue};
use web_sys::{
    RtcConfiguration, RtcDataChannelInit, RtcIceCandidateInit,
    RtcPeerConnectionIceEvent, RtcSdpType, RtcSessionDescriptionInit,
};

pub fn make_rtc_configuration(
    servers: &[RTCIceServerDX],
) -> Result<RtcConfiguration, String> {
    let ice_servers = js_sys::Array::new();

    for server in servers {
        let ice_server = js_sys::Object::new();

        let urls = js_sys::Array::new();
        for url in &server.urls {
            urls.push(&JsValue::from_str(url));
        }

        js_sys::Reflect::set(&ice_server, &JsValue::from_str("urls"), &urls)
            .expect("Failed to set urls on ICE server configuration");

        if let Some(username) = &server.username {
            js_sys::Reflect::set(
                &ice_server,
                &JsValue::from_str("username"),
                &JsValue::from_str(username),
            )
            .expect("Failed to set username on ICE server configuration");
        }

        if let Some(credential) = &server.credential {
            js_sys::Reflect::set(
                &ice_server,
                &JsValue::from_str("credential"),
                &JsValue::from_str(credential),
            )
            .expect("Failed to set credential on ICE server configuration");
        }

        ice_servers.push(&ice_server);
    }

    let config = js_sys::Object::new();

    js_sys::Reflect::set(
        &config,
        &JsValue::from_str("iceServers"),
        &ice_servers,
    )
    .expect("Failed to set iceServers on RTC configuration");
    Ok(config.unchecked_into::<RtcConfiguration>())
}

pub fn make_data_channel_init(
    setup: &WebRTCInterfaceSetupData,
) -> Result<RtcDataChannelInit, String> {
    let init = js_sys::Object::new();

    js_sys::Reflect::set(
        &init,
        &JsValue::from_str("ordered"),
        &JsValue::from_bool(setup.ordered),
    )
    .expect("Failed to set ordered on data channel init");

    if let Some(id) = setup.negotiated_data_channel_id {
        js_sys::Reflect::set(
            &init,
            &JsValue::from_str("negotiated"),
            &JsValue::from_bool(true),
        )
        .expect("Failed to set negotiated on data channel init");

        js_sys::Reflect::set(
            &init,
            &JsValue::from_str("id"),
            &JsValue::from_f64(id as f64),
        )
        .expect("Failed to set id on data channel init");
    }

    Ok(init.unchecked_into::<RtcDataChannelInit>())
}

pub fn make_js_sdp_description(
    description: RTCSessionDescriptionDX,
) -> Result<RtcSessionDescriptionInit, String> {
    let sdp_type = match description.sdp_type {
        RTCSdpTypeDX::Offer => RtcSdpType::Offer,
        RTCSdpTypeDX::Answer => RtcSdpType::Answer,
        RTCSdpTypeDX::Unspecified => {
            return Err("invalid WebRTC SDP type: unspecified".to_string());
        }
    };
    let init = RtcSessionDescriptionInit::new(sdp_type);
    init.set_sdp(&description.sdp);
    Ok(init)
}

pub fn make_dx_sdp_description(
    value: JsValue,
) -> Result<RTCSessionDescriptionDX, String> {
    let type_value = js_sys::Reflect::get(&value, &JsValue::from_str("type"))
        .expect("Failed to get type from RTCSessionDescriptionInit")
        .as_string()
        .ok_or_else(|| "missing SDP type".to_string())?;

    let sdp = js_sys::Reflect::get(&value, &JsValue::from_str("sdp"))
        .expect("Failed to get sdp from RTCSessionDescriptionInit")
        .as_string()
        .ok_or_else(|| "missing SDP body".to_string())?;

    let sdp_type = match type_value.as_str() {
        "offer" => RTCSdpTypeDX::Offer,
        "answer" => RTCSdpTypeDX::Answer,
        _ => RTCSdpTypeDX::Unspecified,
    };
    Ok(RTCSessionDescriptionDX { sdp_type, sdp })
}

pub fn make_js_ice_candidate(
    candidate: RTCIceCandidateInitDX,
) -> RtcIceCandidateInit {
    let init = RtcIceCandidateInit::new(&candidate.candidate);

    init.set_sdp_mid(candidate.sdp_mid.as_deref());
    init.set_sdp_m_line_index(candidate.sdp_mline_index);
    if let Some(username_fragment) = candidate.username_fragment {
        let _ = js_sys::Reflect::set(
            init.as_ref(),
            &JsValue::from_str("usernameFragment"),
            &JsValue::from_str(&username_fragment),
        );
    }
    init
}

pub fn make_dx_ice_candidate(
    event: RtcPeerConnectionIceEvent,
) -> Option<WebRTCSignalDX> {
    let candidate = event.candidate();
    match candidate {
        Some(candidate) => {
            let init = RTCIceCandidateInitDX {
                candidate: candidate.candidate(),
                sdp_mid: candidate.sdp_mid(),
                sdp_mline_index: candidate.sdp_m_line_index(),
                username_fragment: js_sys::Reflect::get(
                    candidate.as_ref(),
                    &JsValue::from_str("usernameFragment"),
                )
                .ok()
                .and_then(|v| v.as_string()),
            };
            Some(WebRTCSignalDX::IceCandidate(init))
        }
        None => Some(WebRTCSignalDX::EndOfCandidates),
    }
}
