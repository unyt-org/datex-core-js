use std::{collections::HashMap, path::PathBuf};

use datex_core::{
    datex_registry::all_datex_registrations, runtime::memory::Memory,
    types::r#type::Type,
};

use crate::ts::type_folder::TsTypeFolder;
mod ast;
mod swc;
mod type_folder;
mod utils;

/// A TypeScript export, consisting of a type, a name and optional documentation comments
pub struct TsExport<'a> {
    pub ty: &'a Type,
    pub name: &'a str,
    pub docs: Option<&'a str>,
}

struct ResolvedExport {
    ty: Type,
    name: &'static str,
    docs: Option<&'static str>,
}

pub fn resolve_registry_types(memory: &mut Memory) -> HashMap<PathBuf, String> {
    let mut exports_by_file: HashMap<&'static str, Vec<ResolvedExport>> =
        HashMap::new();

    for registration in all_datex_registrations() {
        let metadata = &registration.metadata;

        let Some(path) = metadata.export_ts else {
            continue;
        };

        exports_by_file
            .entry(path)
            .or_default()
            .push(ResolvedExport {
                ty: registration.resolve(memory),
                name: metadata.name,
                docs: metadata.docs,
            });
    }
    let mut result = HashMap::new();
    for (path, exports) in exports_by_file {
        let ast = TsTypeFolder::new()
            .fold_module(exports.iter().map(|export| TsExport {
                ty: &export.ty,
                name: export.name,
                docs: export.docs,
            }))
            .unwrap();

        result.insert(path.into(), ast.to_typescript());
    }
    result
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use datex_core::{
        datex_proxy::DatexProxyTypes,
        datex_registry::{all_datex_registrations, all_datex_types},
        macros::Datex,
        runtime::memory::Memory,
        types::r#type::Type,
        values::core_values::endpoint::Endpoint,
    };

    use log::info;
    use swc_common::DUMMY_SP;
    use swc_ecma_ast::{
        Decl, Expr, Ident, Lit, ModuleItem, Stmt, Str, TsEntityName,
        TsKeywordType, TsKeywordTypeKind, TsLit, TsLitType,
        TsPropertySignature, TsTupleElement, TsTupleType, TsType,
        TsTypeAliasDecl, TsTypeAnn, TsTypeElement, TsTypeLit, TsTypeRef,
        TsUnionType,
    };

    use crate::ts::{
        resolve_registry_types,
        swc::{
            ts_number, ts_string, ts_string_literal, ts_string_property,
            ts_tuple, ts_type_alias, ts_type_literal, ts_type_reference,
            ts_union,
        },
        type_folder::TsTypeFolder,
    };

    #[derive(Datex, Debug, Clone, PartialEq)]
    struct Example {
        a: u8,
        b: String,
        c: Endpoint,
    }

    #[derive(Datex, Debug, Clone, PartialEq)]
    enum ExampleEnum {
        VariantA { x: i32, y: String },
        VariantB(u8, Endpoint),
        VariantC,
    }

    #[test]
    fn enum_type() {
        let ty = ExampleEnum::datex_type(&mut Memory::default());
        let ast = TsTypeFolder::new().fold_inline(&ty).unwrap();
        assert_eq!(ast.root, ts_type_reference("ExampleEnum", vec![]),);
        assert_eq!(
            ast.module.body,
            vec![ts_type_alias(
                "ExampleEnum",
                ts_union(vec![
                    ts_type_literal(vec![
                        ts_string_property(
                            "tag",
                            ts_string_literal("VariantA"),
                        ),
                        ts_string_property(
                            "value",
                            ts_type_literal(vec![
                                ts_string_property("x", ts_number()),
                                ts_string_property("y", ts_string()),
                            ]),
                        ),
                    ]),
                    ts_type_literal(vec![
                        ts_string_property(
                            "tag",
                            ts_string_literal("VariantB"),
                        ),
                        ts_string_property(
                            "value",
                            ts_tuple(vec![
                                ts_number(),
                                ts_type_reference("Endpoint", vec![]),
                            ]),
                        ),
                    ]),
                    ts_type_literal(vec![ts_string_property(
                        "tag",
                        ts_string_literal("VariantC"),
                    ),]),
                ]),
            ),],
        );
    }

    #[test]
    fn test_simple_struct() {
        let ty = Example::datex_type(&mut Memory::default());
        let ast = TsTypeFolder::new().fold_inline(&ty).unwrap();
        assert_eq!(ast.root, ts_type_reference("Example", vec![]),);
        assert_eq!(
            ast.module.body,
            vec![ts_type_alias(
                "Example",
                ts_type_literal(vec![
                    ts_string_property("a", ts_number()),
                    ts_string_property("b", ts_string()),
                    ts_string_property(
                        "c",
                        ts_type_reference("Endpoint", vec![])
                    ),
                ]),
            ),],
        );
    }

    #[derive(Datex, Debug, Clone, PartialEq)]
    struct WrappedStruct {
        inner: Example,
    }

    #[test]
    fn test_nested_struct() {
        let ty = WrappedStruct::datex_type(&mut Memory::default());
        let ast = TsTypeFolder::new().fold_inline(&ty).unwrap();

        assert_eq!(ast.root, ts_type_reference("WrappedStruct", vec![]));
        assert_eq!(
            ast.module.body,
            vec![
                ts_type_alias(
                    "Example",
                    ts_type_literal(vec![
                        ts_string_property("a", ts_number()),
                        ts_string_property("b", ts_string()),
                        ts_string_property(
                            "c",
                            ts_type_reference("Endpoint", vec![])
                        ),
                    ]),
                ),
                ts_type_alias(
                    "WrappedStruct",
                    ts_type_literal(vec![ts_string_property(
                        "inner",
                        ts_type_reference("Example", vec![])
                    ),]),
                ),
            ],
        );
    }

    // TODO WASM bingen file writer here
    #[test]
    fn types() {
        let memory = &mut Memory::default();
        for (file, content) in resolve_registry_types(memory) {
            println!("// File: {}", file.display());
            println!("{}", content);
        }
    }
}
