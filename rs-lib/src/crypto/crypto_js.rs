use datex_core::crypto::crypto::Crypto;
use wasm_bindgen::prelude::wasm_bindgen;
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = crypto)]
    fn randomUUID() -> String;
}
pub struct CryptoJS;
impl Crypto for CryptoJS {
  fn encrypt(&self, data: &[u8]) -> Vec<u8> {
    todo!()
  }

  fn decrypt(&self, data: &[u8]) -> Vec<u8> {
    todo!()
  }

  fn create_uuid(&self) -> String {
    return randomUUID();
  }
}