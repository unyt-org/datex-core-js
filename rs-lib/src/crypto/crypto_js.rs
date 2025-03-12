use datex_core::crypto::crypto::Crypto;
use wasm_bindgen::prelude::wasm_bindgen;
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = crypto)]
    fn randomUUID() -> String;
}
pub struct CryptoJS;
impl CryptoJS {
    fn crypto() -> web_sys::Crypto {
        let window_instance = web_sys::window().unwrap();
        window_instance.crypto().unwrap()
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
        randomUUID()
        //return Self::crypto().randomUUID();
    }

    fn random_bytes(&self, length: usize) -> Vec<u8> {
        let mut buffer = &mut vec![0u8; length];
        Self::crypto()
            .get_random_values_with_u8_array(&mut buffer)
            .unwrap();
        buffer.to_vec()
    }
}
