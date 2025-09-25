use datex_core::stdlib::{future::Future, pin::Pin};

use datex_core::crypto::crypto::{CryptoError, CryptoTrait};
use wasm_bindgen::{JsCast, JsValue};
use wasm_bindgen_futures::JsFuture;
use web_sys::{
    js_sys::{Array, ArrayBuffer, Object, Reflect, Uint8Array},
    CryptoKey, CryptoKeyPair, AesCtrParams, AesGcmParams,
};

use crate::js_utils::{js_array, js_object, AsByteSlice, TryAsByteSlice};

mod sealed {
    use super::*;
    pub trait CryptoKeyType: JsCast {}
    impl CryptoKeyType for CryptoKey {}
    impl CryptoKeyType for CryptoKeyPair {}
}

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
}

   
impl CryptoTrait for CryptoJS {
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

    // Signature and Verification
    fn gen_ed25519(
        &self,
    ) -> Pin<Box<dyn Future<Output = Result<(Vec<u8>, Vec<u8>), CryptoError>> + 'static>> {
        Box::pin(async move {

            let algorithm = js_object(vec![
                ("name", JsValue::from_str("Ed25519")),
            ]);
            let key_pair: CryptoKeyPair = 
                Self::generate_crypto_key(&algorithm, true, &["sign", "verify"])
                .await
                .map_err(|_| CryptoError::KeyGeneratorFailed)?;

            let pub_key =
                Self::export_crypto_key(&key_pair.get_public_key(), "spki")
                .await?;
            let pri_key =
                Self::export_crypto_key(&key_pair.get_private_key(), "pkcs8")
                .await?;

            Ok((pub_key, pri_key))
        })
    }

    fn sig_ed25519<'a>(
        &self,
        pri_key: &'a Vec<u8>,
        data: &'a Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'a>> {
        Box::pin(async move {
            let key = Self::import_crypto_key(
                &pri_key,
                "pkcs8",
                &js_object(vec![
                    ("name", JsValue::from_str("Ed25519")),
                ]),
                &["sign"],
            )
            .await?;

            let sig_prom = Self::crypto_subtle()
                .sign_with_object_and_u8_array(
                    &js_object(vec![
                        ("name", JsValue::from_str("Ed25519")),
                    ]),
                    &key,
                    &data,
                )
                .map_err(|_| CryptoError::SigningError)?;

            let result: ArrayBuffer = JsFuture::from(sig_prom)
                .await
                .map_err(|_| CryptoError::SigningError)?
                .try_into()
                .map_err(|_: std::convert::Infallible| {
                    CryptoError::SigningError
                })?;

            let sig: Vec<u8> = result.as_u8_slice();

            Ok(sig)
        })
    }

    fn ver_ed25519<'a>(
        &self,
        pub_key: &'a Vec<u8>,
        sig: &'a Vec<u8>,
        data: &'a Vec<u8>,
    ) -> Pin<Box<dyn Future<Output = Result<bool, CryptoError>> + 'a>> {
        Box::pin(async move {
            let key = Self::import_crypto_key(
                &pub_key,
                "spki",
                &js_object(vec![
                    ("name", JsValue::from_str("Ed25519")),
                ]),
                &["verify"],
            )
            .await?;

            let verified_promise = Self::crypto_subtle()
                .verify_with_object_and_u8_array_and_u8_array(
                    &js_object(vec![
                        ("name", JsValue::from_str("Ed25519")),
                    ]),
                    &key,
                    &sig,
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

    // aes ctr
    fn aes_ctr_encrypt<'a>(
        &'a self,
        hash: &'a[u8; 32],
        iv: &'a [u8; 16],
        plaintext: &'a [u8],
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'a>> {
        Box::pin(async move {

            let subtle = Self::crypto_subtle();

            let usages = Array::of1(
                &JsValue::from_str("encrypt"),
                // &JsValue::from_str("decrypt"),
            );

            let ikm_buf = Uint8Array::from(hash.as_slice()).buffer();

            let key_js = JsFuture::from(
                subtle
                .import_key_with_object(
                    "raw",
                    &ikm_buf.into(),
                    &js_object(vec![("name", "AES-CTR")]),
                    false,
                    &usages
                ).map_err(|_| CryptoError::KeyImportFailed)?,
            ).await.map_err(|_| CryptoError::KeyImportFailed)?;
            let base_key: CryptoKey = key_js.dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;

            let mut params = AesCtrParams::new(&"AES-CTR", &Uint8Array::from(iv.as_slice()), 64u8);

            let pt = Uint8Array::from(plaintext);

            let ct = JsFuture::from(
                subtle.encrypt_with_object_and_buffer_source(
                    &params.into(),
                    &base_key,
                    &pt,
                ).map_err(|_| CryptoError::EncryptionError)?)
                .await
                .map_err(|_| CryptoError::EncryptionError)?;

            let ct_buf: ArrayBuffer = ct.dyn_into()
                .map_err(|_| CryptoError::EncryptionError)?;
            let ct_bytes = Uint8Array::new(&ct_buf).to_vec();

            Ok(ct_bytes)
        })
    }

    fn aes_ctr_decrypt<'a>(
        &'a self,
        hash: &'a [u8; 32],
        iv: &'a [u8; 16],
        ciphertext: &'a [u8],
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'a>> {
        Box::pin(async move {
            let subtle = CryptoJS::crypto_subtle();

            let usages = Array::of1(
                // &JsValue::from_str("encrypt"),
                &JsValue::from_str("decrypt"),
            );

            let ikm_buf = Uint8Array::from(hash.as_slice()).buffer();

            let key_js = JsFuture::from(
                subtle
                .import_key_with_object(
                    "raw",
                    &ikm_buf.into(),
                    &js_object(vec![("name", "AES-CTR")]),
                    false,
                    &usages
                ).map_err(|_| CryptoError::KeyImportFailed)?,
            ).await.map_err(|_| CryptoError::KeyImportFailed)?;
            let base_key: CryptoKey = key_js.dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;

            let mut params = AesCtrParams::new(&"AES-CTR", &Uint8Array::from(iv.as_slice()), 64u8);

            let ct = Uint8Array::from(ciphertext);

            let pt = JsFuture::from(
                subtle.decrypt_with_object_and_buffer_source(
                    &params.into(),
                    &base_key,
                    &ct,
                ).map_err(|_| CryptoError::DecryptionError)?)
                .await
                .map_err(|_| CryptoError::DecryptionError)?;

            let pt_buf: ArrayBuffer = pt.dyn_into()
                .map_err(|_| CryptoError::DecryptionError)?;
            let pt_bytes = Uint8Array::new(&pt_buf).to_vec();

            Ok(pt_bytes)
        })
    }

    fn key_upwrap<'a>(
        &'a self,
        // Key Encryption Key (AES-256)
        kek_bytes: &'a [u8; 32],
        // The AES-CTR key to wrap
        key_to_wrap_bytes: &'a [u8; 32],   
    ) -> Pin<Box<dyn Future<Output = Result<[u8; 40], CryptoError>> + 'a>> {
        Box::pin(async move {
            let subtle = Self::crypto_subtle();

            // Import the Key Encryption Key (KEK)
            let kek_algorithm = js_object(vec![
                ("name", JsValue::from_str("AES-KW")),
            ]);

            let kek_promise = subtle.import_key_with_object(
                "raw",
                &Uint8Array::from(kek_bytes.as_slice()).buffer(),
                &kek_algorithm,
                false, // not extractable
                &Array::of2(
                    &JsValue::from_str("wrapKey"),
                    &JsValue::from_str("unwrapKey")
                ),
            );

            let kek: CryptoKey = JsFuture::from(
                kek_promise
                .map_err(|_| CryptoError::KeyImportFailed)?)
                .await
                .map_err(|_| CryptoError::KeyImportFailed)?
                .dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;

            // Import the key to be wrapped (AES-CTR key)
            let key_algorithm = js_object(vec![
                ("name", JsValue::from_str("AES-CTR")),
            ]);

            let key_promise = subtle.import_key_with_object(
                "raw",
                &Uint8Array::from(key_to_wrap_bytes.as_slice()).buffer(),
                &key_algorithm,
                true, // must be extractable to wrap it
                &Array::of2(
                    &JsValue::from_str("encrypt"),
                    &JsValue::from_str("decrypt")
                ),
            );

            let key_to_wrap: CryptoKey = JsFuture::from(key_promise
                .map_err(|_| CryptoError::KeyImportFailed)?)
                .await
                .map_err(|_| CryptoError::KeyImportFailed)?
                .dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;

            // Wrap the key
            let wrap_promise = subtle.wrap_key_with_str(
                "raw",              // format to wrap in
                &key_to_wrap,       // key to wrap
                &kek,               // wrapping key
                "AES-KW",           // wrapping algorithm
            );

            let wrapped_buffer = JsFuture::from(wrap_promise
                .map_err(|_| CryptoError::KeyImportFailed)?)
                .await
                .map_err(|_| CryptoError::KeyImportFailed)?;

            let uint8_array = Uint8Array::new(&wrapped_buffer);
            let mut result: [u8; 40] = vec![0u8; uint8_array.length() as usize]
                .try_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;
            uint8_array.copy_to(&mut result);

            Ok(result)
        })
    }

    fn key_unwrap<'a>(
        &'a self,
        kek_bytes: &'a [u8; 32], // Key Encryption Key (same as used for wrapping)
        wrapped_key: &'a [u8; 40], // The wrapped key data
    ) -> Pin<Box<dyn Future<Output = Result<[u8; 32], CryptoError>> + 'a>> {
        Box::pin(async move {
            let subtle = CryptoJS::crypto_subtle();

            // Import the Key Encryption Key (KEK)
            let kek_algorithm = js_object(vec![
                ("name", JsValue::from_str("AES-KW")),
            ]);

            let kek_promise = subtle.import_key_with_object(
                "raw",
                &Uint8Array::from(kek_bytes.as_slice()).buffer(),
                &kek_algorithm,
                false, // not extractable
                &Array::of2(
                    &JsValue::from_str("wrapKey"),
                    &JsValue::from_str("unwrapKey")
                ),
            );

            let kek: CryptoKey = JsFuture::from(kek_promise
                .map_err(|_| CryptoError::KeyImportFailed)?)
                .await
                .map_err(|_| CryptoError::KeyImportFailed)?
                .dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;

            // Unwrap the key
            let unwrapped_algorithm = js_object(vec![
                ("name", JsValue::from_str("AES-CTR")),
            ]);

            // Convert wrapped_key to Uint8Array
            let wrapped_key_array = Uint8Array::from(wrapped_key.as_slice());

            let unwrap_promise = subtle.unwrap_key_with_js_u8_array_and_str_and_object(
                "raw",                      // format the wrapped key is in
                &wrapped_key_array,         // wrapped key as Uint8Array
                &kek,                       // unwrapping key
                "AES-KW",                   // unwrapping algorithm
                &unwrapped_algorithm,       // algorithm of the unwrapped key
                true,                       // extractable
                &Array::of2(
                    &JsValue::from_str("encrypt"),
                    &JsValue::from_str("decrypt")
                ),
            );

            let unwrapped_key: CryptoKey = JsFuture::from(
                unwrap_promise
                .map_err(|_| CryptoError::KeyExportFailed)?
                )
                .await
                .map_err(|_| CryptoError::KeyExportFailed)?
                .dyn_into()
                .map_err(|_| CryptoError::KeyExportFailed)?;

            // Export the unwrapped key as raw bytes
            let export_promise = subtle
                .export_key("raw", &unwrapped_key)
                .map_err(|_| CryptoError::KeyExportFailed)?;

            let exported_buffer = JsFuture::from(export_promise)
                .await
                .map_err(|_| CryptoError::KeyExportFailed)?;

            let uint8_array = Uint8Array::new(&exported_buffer);
            let mut result: [u8; 32] = vec![0u8; uint8_array.length() as usize]
                .try_into()
                .map_err(|_| CryptoError::KeyExportFailed)?;
            uint8_array.copy_to(&mut result);

            Ok(result)
        })
    }

     // x25519 key gen
    fn gen_x25519(&self) -> Pin<Box<dyn Future<Output = Result<([u8; 44], [u8; 48]), CryptoError>>>> {
        Box::pin(async move {

            let algorithm = js_object(vec![
                ("name", JsValue::from_str("X25519")),
            ]);

            let key_pair: CryptoKeyPair = 
                Self::generate_crypto_key(&algorithm, true, &["deriveKey", "deriveBits"])
                .await
                .map_err(|_| CryptoError::KeyGeneratorFailed)?;


            let pub_key: [u8; 44] =
                Self::export_crypto_key(&key_pair.get_public_key(), "spki")
                .await
                .map_err(|_| CryptoError::KeyGeneratorFailed)?
                .try_into()
                .map_err(|_| CryptoError::KeyGeneratorFailed)?;
            let pri_key: [u8; 48] =
                Self::export_crypto_key(&key_pair.get_private_key(), "pkcs8")
                .await
                .map_err(|_| CryptoError::KeyGeneratorFailed)?
                .try_into()
                .map_err(|_| CryptoError::KeyGeneratorFailed)?;

            Ok((pub_key, pri_key))
        })
    }

    fn derive_x25519<'a>(
        &'a self,
        my_raw: &'a [u8; 48],
        peer_pub: &'a [u8; 44],
    ) -> Pin<Box<dyn Future<Output = Result<Vec<u8>, CryptoError>> + 'a>> {
        Box::pin(async move {
            let subtle = Self::crypto_subtle();
            
            // Private Key
            let pri_key_algorithm = js_object(vec![
                ("name", JsValue::from_str("X25519")),
            ]);
            
            let pri_key_promise = subtle.import_key_with_object(
                "pkcs8",
                &Uint8Array::from(my_raw.as_slice()).buffer(),
                &pri_key_algorithm,
                false, // not extractable
                &Array::of2(
                    &JsValue::from_str("deriveKey"), 
                    &JsValue::from_str("deriveBits")
                ),
            ).map_err(|_| CryptoError::KeyImportFailed)?;
            
            let pri_key: CryptoKey = JsFuture::from(pri_key_promise)
                .await
                .map_err(|_| CryptoError::KeyImportFailed)?
                .dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;
            
            // Public Key
            let pub_key_promise = subtle.import_key_with_object(
                "spki",
                &Uint8Array::from(peer_pub.as_slice()).buffer(),
                &pri_key_algorithm, // same algorithm object
                false, // not extractable
                &Array::new(), // no usage for public key
            ).map_err(|_| CryptoError::KeyImportFailed)?;
            
            let pub_key: CryptoKey = JsFuture::from(pub_key_promise)
                .await
                .map_err(|_| CryptoError::KeyImportFailed)?
                .dyn_into()
                .map_err(|_| CryptoError::KeyImportFailed)?;

            let derive_algorithm = js_object(vec![
                ("name", JsValue::from_str("X25519")),
                ("public", pub_key.into()),
            ]);
            
            // Derive bits
            let derive_promise = subtle.derive_bits_with_object(
                &derive_algorithm,
                &pri_key,
                256u32,
            ).map_err(|_| CryptoError::KeyGeneratorFailed)?;
            
            let derived_buffer = JsFuture::from(derive_promise)
                .await
                .map_err(|_| CryptoError::KeyExportFailed)?;
            
            let uint8_array = Uint8Array::new(&derived_buffer);
            let mut result = vec![0u8; uint8_array.length() as usize];
            uint8_array.copy_to(&mut result);
            
            Ok(result)
        })
    }
}
