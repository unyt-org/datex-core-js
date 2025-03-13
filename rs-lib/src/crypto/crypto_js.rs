use std::array;

use datex_core::crypto::{
    self,
    crypto::{Crypto, CryptoError},
};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    js_sys::{self, Array, Object},
    CryptoKey, CryptoKeyPair, EcdsaParams, RsaOaepParams,
};

use crate::js_utils::AsByteSlice;

fn js_array(values: &[&str]) -> JsValue {
    return JsValue::from(
        values
            .iter()
            .map(|x| JsValue::from_str(x))
            .collect::<js_sys::Array>(),
    );
}

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

    // This method can either create a crypto key pair or a symmetric key
    async fn generate_crypto_key<T>(
        algorithm: &Object,
        extractable: bool,
        key_usages: &[&str],
    ) -> Result<T, CryptoError>
    where
        T: sealed::CryptoKeyType + JsCast,
    {
        let key_generator_promise = Self::crypto_subtle()
            .generate_key_with_object(
                &algorithm,
                extractable,
                &js_array(&key_usages),
            )
            .map_err(|_| CryptoError::KeyGeneratorFailed)?;
        let key: JsValue = JsFuture::from(key_generator_promise)
            .await
            .map_err(|_| CryptoError::KeyGeneratorFailed)?;
        key.dyn_into::<T>()
            .map_err(|_| CryptoError::KeyGeneratorFailed)
    }

    async fn new_encryption_key_pair() -> Result<CryptoKeyPair, CryptoError> {
        Self::generate_crypto_key(
            &RsaOaepParams::new("RSA-OAEP"),
            true,
            &["encrypt", "decrypt"],
        )
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
        // let crypto_key = Self::crypto_subtle().generate_key_with_str(
        //     "AES-GCM", true, &["encrypt", "decrypt"]
        // ).unwrap();
        // Self::crypto_subtle().encrypt_with_str_and_u8_array(
        //     "xx", key, data)
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
