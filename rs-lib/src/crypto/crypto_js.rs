use datex_core::stdlib::{future::Future, pin::Pin};

use datex_core::crypto::crypto::{CryptoError, CryptoTrait};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    js_sys::{Array, ArrayBuffer, Object, Reflect, Uint8Array},
    CryptoKey, CryptoKeyPair, AesGcmParams,
};

use crate::js_utils::{js_array, js_object, AsByteSlice, TryAsByteSlice};

mod sealed {
    use super::*;
    pub trait CryptoKeyType: JsCast {}
    impl CryptoKeyType for CryptoKey {}
    impl CryptoKeyType for CryptoKeyPair {}
}

pub const KEY_LEN: usize = 32;
pub const IV_LEN: usize = 12;
pub const TAG_LEN: u8 = 16;
pub const TAG_LEN_BITS: u32 = 128;
pub const SALT_LEN: usize = 16;
pub const SIG_LEN: usize = 64;


pub struct CryptoJS;
impl CryptoJS {
    fn window() -> web_sys::Window {
        js_sys::global().unchecked_into::<web_sys::Window>()
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
            .try_as_u8_slice()
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
        T: sealed::CryptoKeyType + From<JsValue>,
    {
        let key_generator_promise = Self::crypto_subtle()
            .generate_key_with_object(
                algorithm,
                extractable,
                &js_array(key_usages),
            )
            .map_err(|e| CryptoError::Other(format!("{e:?}")))?;
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

    pub async fn hkdf(
        &self, 
        ikm: &[u8], 
        salt: &[u8], 
        info: &[u8], 
        out_len: usize
    ) -> Result<[u8; KEY_LEN], CryptoError> {
        let subtle = CryptoJS::crypto_subtle();

        let usages = Array::new();
        usages.push(&JsValue::from_str("deriveBits"));
        let ikm_buf = Uint8Array::from(ikm).buffer();

        let key_js = JsFuture::from(
            subtle
            .import_key_with_object(
                "raw",
                &ikm_buf.into(),
                &js_object(vec![("name", "HKDF")]),
                false,
                &usages
            ).map_err(|_| CryptoError::KeyImportFailed)?,
        ).await.map_err(|_| CryptoError::KeyImportFailed)?;
        let base_key: CryptoKey = key_js.dyn_into()
            .map_err(|_| CryptoError::KeyImportFailed)?;

        let params = Object::new();
        Reflect::set(&params, &"name".into(), &"HKDF".into())
            .map_err(|_| CryptoError::KeyImportFailed)?;
        Reflect::set(&params, &"hash".into(), &"SHA-256".into())
            .map_err(|_| CryptoError::KeyImportFailed)?;
        Reflect::set(&params, &"salt".into(), &Uint8Array::from(salt))
            .map_err(|_| CryptoError::KeyImportFailed)?;
        Reflect::set(&params, &"info".into(), &Uint8Array::from(info))
            .map_err(|_| CryptoError::KeyImportFailed)?;

        let bit_len: u32 = (out_len as u32) * 8;
        let bits = JsFuture::from(
            subtle.derive_bits_with_object(&params.into(), &base_key, bit_len)
            .map_err(|_| CryptoError::KeyImportFailed)?,
        ).await
        .map_err(|_| CryptoError::KeyImportFailed)?;

        let okm: [u8; KEY_LEN] = Uint8Array::new(&bits).to_vec().try_into().unwrap();
        if okm.len() != out_len {
            return Err(CryptoError::KeyImportFailed);
        }
        Ok(okm)
    }

    pub async fn aes_gcm_encrypt(
        hash: &[u8],
        iv: &[u8],
        plaintext: &[u8],
        aad: &[u8],
    ) -> Result<Vec<u8>, CryptoError> {
        let subtle = CryptoJS::crypto_subtle();

        let usages = Array::new();
        usages.push(&JsValue::from_str("encrypt"));
        usages.push(&JsValue::from_str("decrypt"));

        let ikm_buf = Uint8Array::from(hash).buffer();

        let key_js = JsFuture::from(
            subtle
            .import_key_with_object(
                "raw",
                &ikm_buf.into(),
                &js_object(vec![("name", "AES-GCM")]),
                false,
                &usages
            ).map_err(|_| CryptoError::KeyImportFailed)?,
        ).await.map_err(|_| CryptoError::KeyImportFailed)?;
        let base_key: CryptoKey = key_js.dyn_into()
            .map_err(|_| CryptoError::KeyImportFailed)?;

        let mut params = AesGcmParams::new(&"AES-GCM", &Uint8Array::from(iv));
        let _ = params.set_additional_data(&Uint8Array::from(aad));
        let _ = params.set_tag_length(128u8);

        let pt = Uint8Array::from(plaintext);

        let ct = JsFuture::from(
            subtle.encrypt_with_object_and_buffer_source(
                &params.into(),
                &base_key,
                &pt,
            ).map_err(|_| CryptoError::KeyImportFailed)?)
            .await
            .map_err(|_| CryptoError::KeyImportFailed)?;

        let ct_buf: ArrayBuffer = ct.dyn_into()
            .map_err(|_| CryptoError::KeyImportFailed)?;
        let ct_bytes = Uint8Array::new(&ct_buf).to_vec();

        Ok(ct_bytes)
    }

    pub async fn aes_gcm_decrypt(
        hash: &[u8],
        iv: &[u8],
        ciphertext: &[u8],
        aad: &[u8],
    ) -> Result<Vec<u8>, CryptoError> {
        let subtle = CryptoJS::crypto_subtle();

        let usages = Array::new();
        usages.push(&JsValue::from_str("encrypt"));
        usages.push(&JsValue::from_str("decrypt"));

        let ikm_buf = Uint8Array::from(hash).buffer();

        let key_js = JsFuture::from(
            subtle
            .import_key_with_object(
                "raw",
                &ikm_buf.into(),
                &js_object(vec![("name", "AES-GCM")]),
                false,
                &usages
            ).map_err(|_| CryptoError::KeyImportFailed)?,
        ).await.map_err(|_| CryptoError::KeyImportFailed)?;
        let base_key: CryptoKey = key_js.dyn_into()
            .map_err(|_| CryptoError::KeyImportFailed)?;

        let mut params = AesGcmParams::new(&"AES-GCM", &Uint8Array::from(iv));
        let _ = params.set_additional_data(&Uint8Array::from(aad));
        let _ = params.set_tag_length(128u8);

        let ct = Uint8Array::from(ciphertext);

        let pt = JsFuture::from(
            subtle.decrypt_with_object_and_buffer_source(
                &params.into(),
                &base_key,
                &ct,
            ).map_err(|_| CryptoError::KeyImportFailed)?)
            .await
            .map_err(|_| CryptoError::KeyImportFailed)?;

        let pt_buf: ArrayBuffer = pt.dyn_into()
            .map_err(|_| CryptoError::KeyImportFailed)?;
        let pt_bytes = Uint8Array::new(&pt_buf).to_vec();

        Ok(pt_bytes)
    }

}

impl CryptoTrait for CryptoJS {
    fn encrypt_rsa(
        &self,
        data: Vec<u8>, // FIXME how to handle lifetime and let data pass as slice
        public_key: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'static>>
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

            let message: Vec<u8> = result.as_u8_slice();

            Ok(message)
        })
    }

    fn decrypt_rsa(
        &self,
        data: Vec<u8>,
        private_key: Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'static>>
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
                .try_as_u8_slice()
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

            let signature: Vec<u8> = result.as_u8_slice();

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
    ) -> Pin<Box<dyn Future<Output = Result<(Vec<u8>, Vec<u8>), CryptoError>>>>
    {
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
    ) -> Pin<Box<dyn Future<Output = Result<(Vec<u8>, Vec<u8>), CryptoError>>>>
    {
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
}
