use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;
use std::time::Duration; // FIXME no-std

use datex_core::delegate_com_interface_info;
use datex_core::network::com_interfaces::com_interface::{
    ComInterface, ComInterfaceInfo, ComInterfaceSockets, ComInterfaceUUID,
};
use datex_core::network::com_interfaces::com_interface_properties::InterfaceProperties;
use datex_core::network::com_interfaces::com_interface_socket::ComInterfaceSocketUUID;
use datex_core::network::com_interfaces::default_com_interfaces::serial::serial_common::SerialError;
use datex_core::stdlib::sync::Arc;

use datex_core::network::com_interfaces::com_interface::ComInterfaceState;

use log::{debug, error};
use tokio::task::spawn_local;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::js_sys::Uint8Array;
use web_sys::SerialPort;
use web_sys::{
    js_sys, ReadableStreamDefaultReader, SerialOptions,
    WritableStreamDefaultWriter,
};

use crate::wrap_error_for_js;

#[wasm_bindgen]
pub struct SerialJSInterface {
    port: Option<SerialPort>,
    tx: Option<Arc<Mutex<WritableStreamDefaultWriter>>>,
    info: ComInterfaceInfo,
}

wrap_error_for_js!(JsSerialError, datex_core::network::com_interfaces::default_com_interfaces::serial::serial_common::SerialError);

#[wasm_bindgen]
impl SerialJSInterface {
    pub async fn open(
        baud_rate: u32,
    ) -> Result<SerialJSInterface, JsSerialError> {
        let mut interface = SerialJSInterface {
            info: ComInterfaceInfo::new(),
            tx: None,
            port: None,
        };
        let options = SerialOptions::new(baud_rate);
        interface.start(&options).await?;
        Ok(interface)
    }

    async fn start(
        &mut self,
        options: &SerialOptions,
    ) -> Result<(), SerialError> {
        let window = web_sys::window()
            .ok_or(SerialError::Other("Unsupported platform".to_string()))?;
        let navigator = window.navigator();
        let serial = navigator.serial();

        let port_promise = serial.request_port();
        let port_js = JsFuture::from(port_promise)
            .await
            .map_err(|_| SerialError::PermissionError)?;
        let port: SerialPort = port_js.into();

        JsFuture::from(port.open(options))
            .await
            .map_err(|_| SerialError::PortNotFound)?;

        let readable = port.readable();
        let reader = readable
            .get_reader()
            .dyn_into::<ReadableStreamDefaultReader>()
            .unwrap();
        let writable = port.writable();
        let writer = writable.get_writer().unwrap();
        self.tx = Some(Arc::new(Mutex::new(writer)));
        spawn_local(async move {
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
                            js_sys::Reflect::get(&value, &"value".into())
                                .unwrap();
                        if value.is_instance_of::<Uint8Array>() {
                            let bytes = value
                                .dyn_into::<Uint8Array>()
                                .unwrap()
                                .to_vec();
                            println!("Received bytes: {:?}", bytes);
                        }
                    }
                    Err(_) => {
                        error!("Error reading from serial port");
                        break;
                    }
                }
            }
            reader.release_lock();
        });
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
        let tx = self.tx.clone();
        if tx.is_none() {
            error!("Client is not connected");
            return Box::pin(async { false });
        }
        let tx = tx.unwrap();
        Box::pin(async move {
            let js_array = Uint8Array::from(block);
            let promise = tx.lock().unwrap().write_with_chunk(&js_array);
            debug!("Sending block: {:?}", block);
            match JsFuture::from(promise).await {
                Ok(_) => true,
                Err(e) => {
                    error!("Error sending message: {:?}", e);
                    false
                }
            }
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
        // TODO add shutdown hook
        let port = self.port.as_ref();
        Box::pin(async move {
            let result = JsFuture::from(port.unwrap().close()).await;
            result.is_ok()
        })
    }
    delegate_com_interface_info!();
}
