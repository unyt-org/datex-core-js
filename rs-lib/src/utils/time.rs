use datex_core::utils::time::TimeTrait;
use js_sys::Date;
use web_sys::js_sys;
pub struct TimeJS;
impl TimeTrait for TimeJS {
    fn now(&self) -> u64 {
        Date::now() as u64
    }
}
