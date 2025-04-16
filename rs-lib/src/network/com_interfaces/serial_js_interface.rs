use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use datex_core::delegate_com_interface_info;
use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceInfo, ComInterfaceSockets, ComInterfaceUUID,
};
use datex_core::network::com_interfaces::com_interface_properties::{
    InterfaceDirection, InterfaceProperties,
};
use datex_core::network::com_interfaces::com_interface_socket::{
    ComInterfaceSocket, ComInterfaceSocketUUID,
};
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::WebSocketError;
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::parse_url;

use log::{debug, error, info, warn};
use tokio::sync::oneshot;
use url::Url;
use wasm_bindgen::{prelude::Closure, JsCast};
use web_sys::{js_sys, ErrorEvent, MessageEvent};
use web_sys::{Navigator, ReadableStream, Serial, SerialPort, WritableStream};

pub struct SerialJSInterface {
    port: Option<SerialPort>,
    info: ComInterfaceInfo,
}

impl SerialJSInterface {
    pub async fn open(
        address: &str,
    ) -> Result<SerialJSInterface, WebSocketError> {
        let mut interface = SerialJSInterface {
            info: ComInterfaceInfo::new(),
            port: None,
        };
        interface.start().await?;
        Ok(interface)
    }

    async fn start(&mut self) -> Result<(), WebSocketError> {
        Ok(())
    }
}

impl ComInterface for SerialJSInterface {
    fn send_block<'a>(
        &'a mut self,
        block: &'a [u8],
        _: ComInterfaceSocketUUID,
    ) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        Box::pin(async move {
            debug!("Sending block: {:?}", block);
            true
        })
    }

    fn init_properties(&self) -> InterfaceProperties {
        InterfaceProperties {
            channel: "serial".to_string(),
            round_trip_time: Duration::from_millis(40),
            max_bandwidth: 100,
            ..InterfaceProperties::default()
        }
    }
    fn close<'a>(&'a mut self) -> Pin<Box<dyn Future<Output = bool> + 'a>> {
        // TODO
        Box::pin(async move { true })
    }
    delegate_com_interface_info!();
}
