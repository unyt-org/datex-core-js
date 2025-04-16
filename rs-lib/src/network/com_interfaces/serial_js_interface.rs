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
use datex_core::network::com_interfaces::default_com_interfaces::serial::serial_common::SerialError;
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;
use datex_core::network::com_interfaces::default_com_interfaces::websocket::websocket_common::parse_url;

use log::{debug, error, info, warn};
use tokio::sync::oneshot;
use url::Url;
use wasm_bindgen::{prelude::Closure, JsCast};
use wasm_bindgen_futures::JsFuture;
use web_sys::js_sys::Uint8Array;
use web_sys::{
    js_sys, ErrorEvent, MessageEvent, ReadableStreamDefaultReader,
    SerialOptions,
};
use web_sys::{Navigator, ReadableStream, Serial, SerialPort, WritableStream};

pub struct SerialJSInterface {
    port: Option<SerialPort>,
    info: ComInterfaceInfo,
}

impl SerialJSInterface {
    pub async fn open(address: &str) -> Result<SerialJSInterface, SerialError> {
        let mut interface = SerialJSInterface {
            info: ComInterfaceInfo::new(),
            port: None,
        };
        interface.start().await?;
        Ok(interface)
    }

    async fn start(&mut self) -> Result<(), SerialError> {
        let window = web_sys::window()
            .ok_or(SerialError::Other("Unsupported platform".to_string()))?;
        let navigator = window.navigator();
        let serial = navigator.serial();

        let port_promise = serial.request_port();
        let port_js = JsFuture::from(port_promise)
            .await
            .map_err(|_| SerialError::PermissionError)?;
        let port: SerialPort = port_js.into();

        let options = SerialOptions::new(115200);
        JsFuture::from(port.open(&options))
            .await
            .map_err(|_| SerialError::PortNotFound)?;

        let readable = port.readable();
        let reader = readable
            .get_reader()
            .dyn_into::<ReadableStreamDefaultReader>()
            .unwrap();
        loop {
            let result = JsFuture::from(reader.read()).await;
            match result {
                Ok(value) => {
                    let value = value.dyn_into::<js_sys::Object>().unwrap();
                    let done = js_sys::Reflect::get(&value, &"done".into())
                        .unwrap()
                        .as_bool()
                        .unwrap_or(false);
                    if done {
                        break;
                    }
                    let value =
                        js_sys::Reflect::get(&value, &"value".into()).unwrap();
                    if value.is_instance_of::<Uint8Array>() {
                        let bytes =
                            value.dyn_into::<Uint8Array>().unwrap().to_vec();
                        println!("Received bytes: {:?}", bytes);
                    }
                }
                Err(_) => {
                    error!("Error reading from serial port");
                }
            }
        }
        self.port = Some(port.clone());
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
