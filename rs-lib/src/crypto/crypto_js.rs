use datex_core::stdlib::{future::Future, pin::Pin};

use datex_core::crypto::crypto::{Crypto, CryptoError};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    js_sys::{ArrayBuffer, Object, Uint8Array},
    CryptoKey, CryptoKeyPair,
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

    async fn import_crypto_key(
        key: &[u8],
        format: &str,
        algorithm: &Object,
        key_usages: &[&str],
    ) -> Result<CryptoKey, CryptoError> {
        let key = Uint8Array::from(key);
        let import_key_promise = Self::crypto_subtle()
            .import_key_with_object(
                format,
                &Object::from(key),
                algorithm,
                true,
                &js_array(key_usages),
            )
            .map_err(|_| CryptoError::KeyImportFailed)?;
        let key: JsValue = JsFuture::from(import_key_promise)
            .await
            .map_err(|_| CryptoError::KeyImportFailed)?;
        let key: CryptoKey =
            key.dyn_into().map_err(|_| CryptoError::KeyImportFailed)?;
        Ok(key)
    }

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
                algorithm,
                extractable,
                &js_array(key_usages),
            )
            .map_err(|e| CryptoError::Other(format!("{:?}", e)))?;
        let result: JsValue = JsFuture::from(key_generator_promise)
            .await
            .map_err(|_| CryptoError::KeyGeneratorFailed)?;

        let key_or_pair: T =
            result.try_into().map_err(|_: std::convert::Infallible| {
                CryptoError::KeyGeneratorFailed
            })?;
        Ok(key_or_pair)
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
        let algorithm = js_object(vec![
            ("name", JsValue::from_str("ECDSA")),
            ("namedCurve", JsValue::from_str("P-384")),
        ]);
        Self::generate_crypto_key(&algorithm, true, &["sign", "verify"]).await
    }
}

impl Crypto for CryptoJS {
    fn create_uuid(&self) -> String {
        Self::crypto().random_uuid()
    }

    fn random_bytes(&self, length: usize) -> Vec<u8> {
        let buffer = &mut vec![0u8; length];
        Self::crypto()
            .get_random_values_with_u8_array(buffer)
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
        Box::pin(async move {
            let key = Self::new_sign_key_pair().await?;
            let public_key =
                Self::export_crypto_key(&key.get_public_key(), "spki").await?;
            let private_key =
                Self::export_crypto_key(&key.get_private_key(), "pkcs8")
                    .await?;
            Ok((public_key, private_key))
        })
    }

    fn encrypt_rsa(
        &self,
        data: Vec<u8>, // FIXME how to handle lifetime and let data pass as slice
        public_key: Vec<u8>,
    ) -> Pin<Box<(dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'static)>>
    {
        Box::pin(async move {
            let key = Self::import_crypto_key(
                &public_key,
                "spki",
                &js_object(vec![
                    ("name", JsValue::from_str("RSA-OAEP")),
                    ("hash", JsValue::from_str("SHA-256")),
                ]),
                &["encrypt"],
            )
            .await?;

            let encryption_promise = Self::crypto_subtle()
                .encrypt_with_str_and_u8_array("RSA-OAEP", &key, &data)
                .map_err(|_| CryptoError::EncryptionError)?;

            let result: ArrayBuffer = JsFuture::from(encryption_promise)
                .await
                .map_err(|_| CryptoError::EncryptionError)?
                .try_into()
                .map_err(|_: std::convert::Infallible| {
                    CryptoError::EncryptionError
                })?;

            let message: Vec<u8> = result
                .as_u8_slice()
                .map_err(|_| CryptoError::EncryptionError)?;

            Ok(message)
        })
    }

    fn decrypt_rsa(
        &self,
        data: Vec<u8>,
        private_key: Vec<u8>,
    ) -> Pin<Box<(dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'static)>>
    {
        Box::pin(async move {
            let key = Self::import_crypto_key(
                &private_key,
                "pkcs8",
                &js_object(vec![
                    ("name", JsValue::from_str("RSA-OAEP")),
                    ("hash", JsValue::from_str("SHA-256")),
                ]),
                &["decrypt"],
            )
            .await?;

            let decryption_promise = Self::crypto_subtle()
                .decrypt_with_str_and_u8_array("RSA-OAEP", &key, &data)
                .map_err(|_| CryptoError::DecryptionError)?;

            let result: JsValue = JsFuture::from(decryption_promise)
                .await
                .map_err(|_| CryptoError::DecryptionError)?
                .try_into()
                .map_err(|_: std::convert::Infallible| {
                    CryptoError::DecryptionError
                })?;

            let message: Vec<u8> = result
                .as_u8_slice()
                .map_err(|_| CryptoError::DecryptionError)?;

            Ok(message)
        })
    }

    fn sign_rsa(
        &self,
        data: Vec<u8>,
        private_key: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>>>> {
        Box::pin(async move {
            let key = Self::import_crypto_key(
                &private_key,
                "pkcs8",
                &js_object(vec![
                    ("name", JsValue::from_str("ECDSA")),
                    ("namedCurve", JsValue::from_str("P-384")),
                ]),
                &["sign"],
            )
            .await?;

            let signature_promise = Self::crypto_subtle()
                .sign_with_object_and_u8_array(
                    &js_object(vec![
                        ("name", JsValue::from_str("ECDSA")),
                        (
                            "hash",
                            JsValue::from(js_object(vec![(
                                "name",
                                JsValue::from_str("SHA-384"),
                            )])),
                        ),
                    ]),
                    &key,
                    &data,
                )
                .map_err(|_| CryptoError::SigningError)?;

            let result: ArrayBuffer = JsFuture::from(signature_promise)
                .await
                .map_err(|_| CryptoError::SigningError)?
                .try_into()
                .map_err(|_: std::convert::Infallible| {
                    CryptoError::SigningError
                })?;

            let signature: Vec<u8> = result
                .as_u8_slice()
                .map_err(|_| CryptoError::SigningError)?;

            Ok(signature)
        })
    }

    fn verify_rsa(
        &self,
        data: Vec<u8>,
        signature: Vec<u8>,
        public_key: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<bool, CryptoError>>>> {
        Box::pin(async move {
            let key = Self::import_crypto_key(
                &public_key,
                "spki",
                &js_object(vec![
                    ("name", JsValue::from_str("ECDSA")),
                    ("namedCurve", JsValue::from_str("P-384")),
                ]),
                &["verify"],
            )
            .await?;

            let verified_promise = Self::crypto_subtle()
                .verify_with_object_and_u8_array_and_u8_array(
                    &js_object(vec![
                        ("name", JsValue::from_str("ECDSA")),
                        (
                            "hash",
                            JsValue::from(js_object(vec![(
                                "name",
                                JsValue::from_str("SHA-384"),
                            )])),
                        ),
                    ]),
                    &key,
                    &signature,
                    &data,
                )
                .map_err(|_| CryptoError::VerificationError)?;

            let result: bool = JsFuture::from(verified_promise)
                .await
                .map_err(|_| CryptoError::VerificationError)?
                .as_bool()
                .ok_or(CryptoError::VerificationError)?;

            Ok(result)
        })
    }
}
