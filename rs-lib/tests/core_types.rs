use datex_core::libs::core::{
    core_lib_id::CoreLibIdIndex,
    type_id::{CoreLibBaseTypeId, CoreLibVariantTypeId},
};
use strum::IntoEnumIterator;

#[test]
#[ignore]
/// Generates a TypeScript mapping of core type addresses to their names.
/// Run this test and copy the output into `src/dif/definitions.ts`.
///
/// `cargo test create_core_type_ts_mapping -- --show-output --ignored`
fn create_core_type_ts_mapping() {
    println!("export const CoreLibTypeId = {{");

    for base_id in CoreLibBaseTypeId::iter() {
        println!("    {}: {},", base_id, CoreLibIdIndex::from(base_id).0);
        for variant_id in CoreLibVariantTypeId::variant_ids(&base_id) {
            println!(
                "    {}_{}: {},",
                base_id,
                variant_id.variant_name(),
                CoreLibIdIndex::from(variant_id).0
            );
        }
    }
    println!("}} as const;");
}
