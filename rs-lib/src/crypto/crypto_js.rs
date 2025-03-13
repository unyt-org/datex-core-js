use std::{array, fmt::format};

use datex_core::crypto::{
    self,
    crypto::{Crypto, CryptoError},
};
use wasm_bindgen::{convert::IntoWasmAbi, JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    js_sys::{self, Array, Object, Uint8Array},
    CryptoKey, CryptoKeyPair, EcdsaParams, RsaOaepParams,
};

use crate::js_utils::{js_array, js_object, AsByteSlice};

mod sealed {
    use super::*;
    pub trait CryptoKeyType: JsCast {}
    impl CryptoKeyType for CryptoKey {}
    impl CryptoKeyType for CryptoKeyPair {}
}

pub struct CryptoJS;
impl CryptoJS {
    fn window() -> web_sys::Window {
        web_sys::window().expect("no global window exists.")
    }
    fn crypto() -> web_sys::Crypto {
        Self::window().crypto().expect("no global crypto exists.")
    }
    fn crypto_subtle() -> web_sys::SubtleCrypto {
        Self::crypto().subtle()
    }
    fn generate_key_pair(&self) {}

    async fn export_crypto_key(
        key: &CryptoKey,
        format: &str,
    ) -> Result<Vec<u8>, CryptoError> {
        let export_key_promise = Self::crypto_subtle()
            .export_key(format, key)
            .map_err(|_| CryptoError::KeyExportFailed)?;
        let key: JsValue = JsFuture::from(export_key_promise)
            .await
            .map_err(|_| CryptoError::KeyExportFailed)?;
        let bytes = key
            .as_u8_slice()
            .map_err(|_| CryptoError::KeyExportFailed)?;
        Ok(bytes)
    }

    // async fn generate_crypto_key(
    //     algorithm: &Object,
    //     extractable: bool,
    //     key_usages: &[&str],
    // ) -> Result<CryptoKeyPair, CryptoError> {
    //     let key_generator_promise = Self::crypto_subtle()
    //         .generate_key_with_object(
    //             &algorithm,
    //             extractable,
    //             &js_array(&key_usages),
    //         )
    //         .map_err(|e| CryptoError::Other(format!("{:?}", e)))?;
    //     let key: JsValue = JsFuture::from(key_generator_promise)
    //         .await
    //         .map_err(|_| CryptoError::KeyGeneratorFailed)?;
    //     key.try_into()
    //         .map_err(|e| CryptoError::Other(format!("cast: {:?}", e)))
    // }

    // This method can either create a crypto key pair or a symmetric key
    async fn generate_crypto_key<T>(
        algorithm: &Object,
        extractable: bool,
        key_usages: &[&str],
    ) -> Result<T, CryptoError>
    where
        T: sealed::CryptoKeyType + std::convert::From<wasm_bindgen::JsValue>,
    {
        let key_generator_promise = Self::crypto_subtle()
            .generate_key_with_object(
                &algorithm,
                extractable,
                &js_array(&key_usages),
            )
            .map_err(|e| CryptoError::Other(format!("{:?}", e)))?;
        let result: JsValue = JsFuture::from(key_generator_promise)
            .await
            .map_err(|_| CryptoError::KeyGeneratorFailed)?;

        let key_or_pair: T = result
            .try_into()
            .map_err(|e| CryptoError::KeyGeneratorFailed)?;

        Ok(key_or_pair)
        // if let Some(key_pair) = key.dyn_ref::<CryptoKeyPair>() {
        //     // If it's a CryptoKeyPair, return the key pair
        //     // Assuming you want to return the type T which could be a CryptoKeyPair.

        //     // let p: T = key_pair
        //     //     .try_into()
        //     //     .map_err(|e| CryptoError::Other(format!("cast: {:?}", e)))?;
        //     // Ok(p)
        // } else if let Some(crypto_key) = key.dyn_ref::<CryptoKey>() {
        //     // If it's a CryptoKey, return the single key
        //     // Assuming you want to return the type T which could be a CryptoKey.
        //     crypto_key
        //         .try_into()
        //         .map_err(|e| CryptoError::Other(format!("cast: {:?}", e)))
        // } else {
        //     // If the result isn't a CryptoKey or CryptoKeyPair, return an error
        //     Err(CryptoError::Other("Unexpected key type".to_string()))
        // }
    }

    async fn new_encryption_key_pair() -> Result<CryptoKeyPair, CryptoError> {
        let algorithm = js_object(vec![
            ("name", JsValue::from_str("RSA-OAEP")),
            ("modulusLength", JsValue::from_f64(4096.0)),
            (
                "publicExponent",
                JsValue::from(Uint8Array::from(&[1, 0, 1][..])),
            ),
            ("hash", JsValue::from_str("SHA-256")),
        ]);
        Self::generate_crypto_key(&algorithm, true, &["encrypt", "decrypt"])
            .await
    }
    async fn new_sign_key_pair() -> Result<CryptoKeyPair, CryptoError> {
        Self::generate_crypto_key(
            &EcdsaParams::new("RSA-OAEP", &JsValue::from_str("SHA-256")),
            true,
            &["sign", "verify"],
        )
        .await
    }
}
impl Crypto for CryptoJS {
    fn encrypt(&self, data: &[u8]) -> Vec<u8> {
        todo!()
    }

    fn decrypt(&self, data: &[u8]) -> Vec<u8> {
        todo!()
    }

    fn create_uuid(&self) -> String {
        Self::crypto().random_uuid()
    }

    fn random_bytes(&self, length: usize) -> Vec<u8> {
        let mut buffer = &mut vec![0u8; length];
        Self::crypto()
            .get_random_values_with_u8_array(&mut buffer)
            .unwrap();
        buffer.to_vec()
    }

    fn new_encryption_key_pair<'a>(
        &self,
    ) -> std::pin::Pin<
        Box<
            dyn std::prelude::rust_2024::Future<
                Output = Result<(Vec<u8>, Vec<u8>), CryptoError>,
            >,
        >,
    > {
        Box::pin(async move {
            let key = Self::new_encryption_key_pair().await?;
            let public_key =
                Self::export_crypto_key(&key.get_public_key(), "spki").await?;
            let private_key =
                Self::export_crypto_key(&key.get_private_key(), "pkcs8")
                    .await?;
            Ok((public_key, private_key))
        })
    }

    fn new_sign_key_pair(
        &self,
    ) -> std::pin::Pin<
        Box<
            dyn std::prelude::rust_2024::Future<
                Output = Result<(Vec<u8>, Vec<u8>), CryptoError>,
            >,
        >,
    > {
        todo!()
    }
}
