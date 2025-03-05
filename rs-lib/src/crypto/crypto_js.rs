use datex_core::crypto::crypto::Crypto;

pub struct CryptoJS {
}
impl Crypto for CryptoJS {
	fn encrypt(&self, data: &[u8]) -> Vec<u8> {
		todo!()
	}

	fn decrypt(&self, data: &[u8]) -> Vec<u8> {
		todo!()
	}

	fn create_uuid(&self) -> String {
		return "CryptoJS".to_string();
	}
}