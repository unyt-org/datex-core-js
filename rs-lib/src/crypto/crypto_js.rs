use datex_core::crypto::crypto::Crypto;

pub struct CryptoJS;
impl CryptoJS {
    fn window() -> web_sys::Window {
        web_sys::window().unwrap()
    }
    fn crypto() -> web_sys::Crypto {
        Self::window().crypto().unwrap()
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
}
