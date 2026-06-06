use datex_core::{
    libs::core::type_id::{
        CoreLibBaseTypeId, CoreLibTypeId, CoreLibVariantTypeId,
    },
    types::{
        literal_type_definition::LiteralTypeDefinition,
        shared_container_containing_nominal_type::SharedContainerContainingNominalType,
        shared_container_containing_type::SharedContainerContainingType,
        r#type::Type,
        type_definition::{
            callable::CallableTypeDefinition,
            intersection::IntersectionTypeDefinition, list::ListTypeDefinition,
            map::MapTypeDefinition, union::UnionTypeDefinition,
        },
        visitor::TypeFolder,
    },
    values::core_values::{
        boolean::Boolean, integer::typed_integer::TypedInteger,
    },
};
use num_bigint::BigInt as NumBigInt;

use std::collections::HashMap;

use swc_common::DUMMY_SP;
use swc_ecma_ast::{
    BigInt, BindingIdent, Bool, Expr, Ident, Lit, Module, ModuleItem, Number,
    Pat, RestPat, Str, TsArrayType, TsEntityName, TsFnParam, TsFnType,
    TsIntersectionType, TsKeywordType, TsKeywordTypeKind, TsLit, TsLitType,
    TsPropertySignature, TsTupleElement, TsTupleType, TsType, TsTypeAliasDecl,
    TsTypeAnn, TsTypeElement, TsTypeParamInstantiation, TsTypeRef, TsUnionType,
};
use swc_ecma_codegen::to_code;

#[derive(Debug, Clone)]
pub struct TsAst {
    pub module: Module,
    pub root: Box<TsType>,
}

impl TsAst {
    pub fn to_typescript(&self) -> String {
        let declarations = to_code(&self.module);
        if declarations.trim().is_empty() {
            to_code(self.root.as_ref())
        } else {
            format!(
                "{}\n{}",
                declarations.trim_end(),
                to_code(self.root.as_ref()),
            )
        }
    }
    pub fn declarations_to_typescript(&self) -> String {
        to_code(&self.module)
    }
    pub fn root_to_typescript(&self) -> String {
        to_code(self.root.as_ref())
    }
}

#[derive(Debug, Clone)]
enum AliasState {
    Visiting,
    Complete(Box<TsType>),
}

#[derive(Debug, Default)]
pub struct TsTypeFolder {
    aliases: HashMap<String, AliasState>,
    declaration_order: Vec<String>,
}

impl TsTypeFolder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn fold(mut self, ty: &Type) -> Result<TsAst, ()> {
        let root = datex_core::types::visitor::fold_type(&mut self, ty)?;
        Ok(TsAst {
            module: self.into_module(),
            root,
        })
    }

    pub fn into_module(self) -> Module {
        let body = self
            .declaration_order
            .into_iter()
            .filter_map(|name| {
                let AliasState::Complete(type_ann) =
                    self.aliases.get(&name)?.clone()
                else {
                    return None;
                };

                Some(
                    TsTypeAliasDecl {
                        span: DUMMY_SP,
                        declare: false,
                        id: ts_ident(&name),
                        type_params: None,
                        type_ann,
                    }
                    .into(),
                )
            })
            .collect::<Vec<ModuleItem>>();

        Module {
            span: DUMMY_SP,
            body,
            shebang: None,
        }
    }
}

fn ts_ident(name: &str) -> Ident {
    Ident::new_no_ctxt(sanitize_ts_identifier(name).into(), DUMMY_SP)
}

fn sanitize_ts_identifier(name: &str) -> String {
    let mut output = String::new();

    for (index, character) in name.chars().enumerate() {
        let valid = if index == 0 {
            character == '_'
                || character == '$'
                || character.is_ascii_alphabetic()
        } else {
            character == '_'
                || character == '$'
                || character.is_ascii_alphanumeric()
        };

        if valid {
            output.push(character);
        } else {
            output.push('_');
        }
    }

    if output.is_empty() {
        "_AnonymousType".to_string()
    } else {
        output
    }
}

fn ts_type_ann(ty: Box<TsType>) -> Box<TsTypeAnn> {
    Box::new(TsTypeAnn {
        span: DUMMY_SP,
        type_ann: ty,
    })
}

fn ts_keyword(kind: TsKeywordTypeKind) -> Box<TsType> {
    Box::new(TsType::TsKeywordType(TsKeywordType {
        span: DUMMY_SP,
        kind,
    }))
}

fn ts_unknown() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsUnknownKeyword)
}

fn ts_void() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsVoidKeyword)
}

fn ts_number() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsNumberKeyword)
}

fn ts_string() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsStringKeyword)
}

fn ts_boolean() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsBooleanKeyword)
}

fn ts_null() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsNullKeyword)
}

fn ts_never() -> Box<TsType> {
    ts_keyword(TsKeywordTypeKind::TsNeverKeyword)
}

fn ts_array(element: Box<TsType>) -> Box<TsType> {
    Box::new(TsType::TsArrayType(TsArrayType {
        span: DUMMY_SP,
        elem_type: element,
    }))
}

fn ts_tuple(elements: Vec<Box<TsType>>) -> Box<TsType> {
    Box::new(TsType::TsTupleType(TsTupleType {
        span: DUMMY_SP,

        elem_types: elements
            .into_iter()
            .map(|ty| TsTupleElement {
                span: DUMMY_SP,
                label: None,
                ty,
            })
            .collect(),
    }))
}

fn ts_union(types: Vec<Box<TsType>>) -> Box<TsType> {
    match types.as_slice() {
        [] => ts_never(),
        [only] => only.clone(),
        _ => Box::new(
            TsUnionType {
                span: DUMMY_SP,
                types,
            }
            .into(),
        ),
    }
}

fn ts_intersection(types: Vec<Box<TsType>>) -> Box<TsType> {
    match types.as_slice() {
        [] => ts_unknown(),
        [only] => only.clone(),
        _ => Box::new(
            TsIntersectionType {
                span: DUMMY_SP,
                types,
            }
            .into(),
        ),
    }
}

fn ts_type_reference(name: &str, parameters: Vec<Box<TsType>>) -> Box<TsType> {
    let type_params = if parameters.is_empty() {
        None
    } else {
        Some(Box::new(TsTypeParamInstantiation {
            span: DUMMY_SP,
            params: parameters,
        }))
    };

    Box::new(TsType::TsTypeRef(TsTypeRef {
        span: DUMMY_SP,
        type_name: TsEntityName::Ident(ts_ident(name)),
        type_params,
    }))
}

fn ts_string_literal(value: impl Into<String>) -> Box<TsType> {
    let value = value.into();

    Box::new(TsType::TsLitType(TsLitType {
        span: DUMMY_SP,
        lit: TsLit::Str(Str {
            span: DUMMY_SP,
            value: value.into(),
            raw: None,
        }),
    }))
}

fn ts_boolean_literal(value: &Boolean) -> Box<TsType> {
    Box::new(TsType::TsLitType(TsLitType {
        span: DUMMY_SP,
        lit: TsLit::Bool(Bool {
            span: DUMMY_SP,
            value: value.0,
        }),
    }))
}

fn ts_number_literal(value: f64) -> Box<TsType> {
    let raw = value.to_string();
    Box::new(TsType::TsLitType(TsLitType {
        span: DUMMY_SP,
        lit: TsLit::Number(Number {
            span: DUMMY_SP,
            value,
            raw: Some(raw.into()),
        }),
    }))
}
fn ts_bigint_literal(value: &NumBigInt) -> Box<TsType> {
    let raw = value.to_string();
    Box::new(TsType::TsLitType(TsLitType {
        span: DUMMY_SP,
        lit: TsLit::BigInt(BigInt {
            span: DUMMY_SP,
            value: Box::new(value.clone()),
            raw: Some(raw.into()),
        }),
    }))
}

fn ts_property_key_from_type(key: Box<TsType>) -> Box<Expr> {
    match *key {
        TsType::TsLitType(TsLitType {
            lit: TsLit::Str(value),
            ..
        }) => Box::new(Expr::Lit(Lit::Str(value))),

        TsType::TsLitType(TsLitType {
            lit: TsLit::Number(value),
            ..
        }) => Box::new(Expr::Lit(Lit::Num(value))),

        TsType::TsLitType(TsLitType {
            lit: TsLit::Bool(value),
            ..
        }) => Box::new(Expr::Lit(Lit::Bool(value))),

        unsupported => todo!(
            "unsupported TypeScript property key type: {:?}",
            unsupported
        ),
    }
}

fn ts_object_type(entries: Vec<(Box<TsType>, Box<TsType>)>) -> Box<TsType> {
    let members = entries
        .into_iter()
        .map(|(key, value)| {
            TsTypeElement::TsPropertySignature(TsPropertySignature {
                span: DUMMY_SP,
                readonly: false,
                key: ts_property_key_from_type(key),
                computed: false,
                optional: false,
                type_ann: Some(ts_type_ann(value)),
            })
        })
        .collect::<Vec<_>>();

    Box::new(TsType::TsTypeLit(swc_ecma_ast::TsTypeLit {
        span: DUMMY_SP,
        members,
    }))
}

fn ts_function_parameter(
    name: impl Into<String>,
    ty: Box<TsType>,
) -> TsFnParam {
    TsFnParam::Ident(BindingIdent {
        id: ts_ident(&name.into()),
        type_ann: Some(ts_type_ann(ty)),
    })
}

fn ts_rest_parameter(name: impl Into<String>, ty: Box<TsType>) -> TsFnParam {
    TsFnParam::Rest(RestPat {
        span: DUMMY_SP,
        dot3_token: DUMMY_SP,
        arg: Box::new(Pat::Ident(BindingIdent {
            id: ts_ident(&name.into()),
            type_ann: None,
        })),
        type_ann: Some(ts_type_ann(ty)),
    })
}

fn ts_function_type(
    parameters: Vec<TsFnParam>,
    return_type: Box<TsType>,
) -> Box<TsType> {
    Box::new(
        TsFnType {
            span: DUMMY_SP,
            params: parameters,
            type_params: None,
            type_ann: ts_type_ann(return_type),
        }
        .into(),
    )
}

impl TypeFolder for TsTypeFolder {
    type Output = Box<TsType>;
    type Error = ();

    fn begin_named_alias(&mut self, name: &str) -> Result<bool, Self::Error> {
        match self.aliases.get(name) {
            None => {
                self.aliases.insert(name.to_string(), AliasState::Visiting);

                Ok(true)
            }

            Some(AliasState::Visiting | AliasState::Complete(_)) => Ok(false),
        }
    }

    fn end_named_alias(
        &mut self,
        name: &str,
        definition: Self::Output,
    ) -> Result<(), Self::Error> {
        self.aliases
            .insert(name.to_string(), AliasState::Complete(definition));

        if !self
            .declaration_order
            .iter()
            .any(|existing| existing == name)
        {
            self.declaration_order.push(name.to_string());
        }

        Ok(())
    }

    fn fold_named_alias_reference(
        &mut self,
        name: &str,
    ) -> Result<Self::Output, Self::Error> {
        Ok(ts_type_reference(name, vec![]))
    }

    fn fold_literal(
        &mut self,
        literal: &LiteralTypeDefinition,
    ) -> Result<Self::Output, Self::Error> {
        Ok(match literal {
            LiteralTypeDefinition::Text(text) => {
                ts_string_literal(text.0.to_string())
            }

            LiteralTypeDefinition::Integer(integer) => {
                ts_number_literal(integer.as_f64())
            }

            LiteralTypeDefinition::TypedInteger(integer) => match integer {
                TypedInteger::I8(_)
                | TypedInteger::I16(_)
                | TypedInteger::I32(_)
                | TypedInteger::I64(_)
                | TypedInteger::I128(_)
                | TypedInteger::U8(_)
                | TypedInteger::U16(_)
                | TypedInteger::U32(_)
                | TypedInteger::U64(_)
                | TypedInteger::U128(_) => ts_number_literal(integer.as_f64()),
                TypedInteger::IBig(big) => ts_bigint_literal(&big.0),
            },

            LiteralTypeDefinition::Decimal(decimal) => {
                ts_number_literal(decimal.into_f64())
            }

            LiteralTypeDefinition::TypedDecimal(decimal) => {
                ts_number_literal(decimal.as_f64())
            }

            LiteralTypeDefinition::Boolean(boolean) => {
                ts_boolean_literal(boolean)
            }

            LiteralTypeDefinition::Endpoint(endpoint) => ts_type_reference(
                "Endpoint",
                vec![ts_string_literal(endpoint.to_string())],
            ),
        })
    }

    fn fold_list(
        &mut self,
        _source: &ListTypeDefinition,
        elements: Vec<Self::Output>,
    ) -> Result<Self::Output, Self::Error> {
        Ok(ts_tuple(elements))
    }

    fn fold_map(
        &mut self,
        _source: &MapTypeDefinition,
        entries: Vec<(Self::Output, Self::Output)>,
    ) -> Result<Self::Output, Self::Error> {
        Ok(ts_object_type(entries))
    }

    fn fold_nested(
        &mut self,
        _source: &Type,
        inner: Self::Output,
    ) -> Result<Self::Output, Self::Error> {
        Ok(inner)
    }

    fn fold_union(
        &mut self,
        _source: &UnionTypeDefinition,
        members: Vec<Self::Output>,
    ) -> Result<Self::Output, Self::Error> {
        Ok(ts_union(members))
    }

    fn fold_intersection(
        &mut self,
        _source: &IntersectionTypeDefinition,
        members: Vec<Self::Output>,
    ) -> Result<Self::Output, Self::Error> {
        Ok(ts_intersection(members))
    }

    fn fold_callable(
        &mut self,
        _source: &CallableTypeDefinition,
        parameters: Vec<(Option<String>, Self::Output)>,
        rest_parameter: Option<(Option<String>, Self::Output)>,
        return_type: Option<Self::Output>,
        yeet_type: Option<Self::Output>,
    ) -> Result<Self::Output, Self::Error> {
        let mut parameters = parameters
            .into_iter()
            .enumerate()
            .map(|(index, (name, ty))| {
                ts_function_parameter(
                    name.unwrap_or_else(|| format!("arg{index}")),
                    ty,
                )
            })
            .collect::<Vec<_>>();

        if let Some((name, ty)) = rest_parameter {
            parameters.push(ts_rest_parameter(
                name.unwrap_or_else(|| "rest".to_string()),
                ty,
            ));
        }

        let _ = yeet_type;

        Ok(ts_function_type(
            parameters,
            return_type.unwrap_or_else(ts_void),
        ))
    }

    fn fold_shared_reference(
        &mut self,
        _shared: &SharedContainerContainingType,
    ) -> Result<Self::Output, Self::Error> {
        todo!()
    }

    fn fold_nominal_reference(
        &mut self,
        _nominal: &SharedContainerContainingNominalType,
    ) -> Result<Self::Output, Self::Error> {
        todo!()
    }

    fn fold_core_type(
        &mut self,
        core_type: CoreLibTypeId,
    ) -> Result<Self::Output, Self::Error> {
        match core_type {
            CoreLibTypeId::Base(base) => match base {
                CoreLibBaseTypeId::Boolean => Ok(ts_boolean()),
                CoreLibBaseTypeId::Text => Ok(ts_string()),
                CoreLibBaseTypeId::Integer => Ok(ts_number()),
                CoreLibBaseTypeId::Decimal => Ok(ts_number()),
                CoreLibBaseTypeId::Null => Ok(ts_null()),
                CoreLibBaseTypeId::Endpoint => {
                    Ok(ts_type_reference("Endpoint", vec![]))
                }
                CoreLibBaseTypeId::Unit => Ok(ts_void()),
                CoreLibBaseTypeId::Never => Ok(ts_never()),
                CoreLibBaseTypeId::Unknown => Ok(ts_unknown()),
                CoreLibBaseTypeId::List => Ok(ts_array(ts_unknown())),
                CoreLibBaseTypeId::Map => Ok(ts_type_reference(
                    "Map",
                    vec![ts_unknown(), ts_unknown()],
                )),
                CoreLibBaseTypeId::Callable => Ok(ts_function_type(
                    vec![ts_rest_parameter("args", ts_array(ts_unknown()))],
                    ts_unknown(),
                )),
                CoreLibBaseTypeId::Range => Ok(ts_unknown()),
                CoreLibBaseTypeId::Type => Ok(ts_unknown()),
            },

            CoreLibTypeId::Variant(variant) => match variant {
                CoreLibVariantTypeId::Decimal(_)
                | CoreLibVariantTypeId::Integer(_) => Ok(ts_number()),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::ts::TsTypeFolder;
    use datex_core::{
        datex_proxy::DatexProxyTypes, macros::Datex, runtime::memory::Memory,
        values::core_values::endpoint::Endpoint,
    };

    use swc_common::DUMMY_SP;
    use swc_ecma_ast::{
        Decl, Expr, Ident, Lit, ModuleItem, Stmt, Str, TsEntityName,
        TsKeywordType, TsKeywordTypeKind, TsPropertySignature, TsType,
        TsTypeAliasDecl, TsTypeAnn, TsTypeElement, TsTypeLit, TsTypeRef,
    };

    fn ident(name: &str) -> Ident {
        Ident::new_no_ctxt(name.into(), DUMMY_SP)
    }

    fn keyword(kind: TsKeywordTypeKind) -> Box<TsType> {
        Box::new(TsType::TsKeywordType(TsKeywordType {
            span: DUMMY_SP,
            kind,
        }))
    }

    fn number() -> Box<TsType> {
        keyword(TsKeywordTypeKind::TsNumberKeyword)
    }

    fn string() -> Box<TsType> {
        keyword(TsKeywordTypeKind::TsStringKeyword)
    }

    fn type_ref(name: &str) -> Box<TsType> {
        Box::new(TsType::TsTypeRef(TsTypeRef {
            span: DUMMY_SP,
            type_name: TsEntityName::Ident(ident(name)),
            type_params: None,
        }))
    }

    fn property(name: &str, ty: Box<TsType>) -> TsTypeElement {
        TsTypeElement::TsPropertySignature(TsPropertySignature {
            span: DUMMY_SP,
            readonly: false,
            key: Box::new(Expr::Lit(Lit::Str(Str {
                span: DUMMY_SP,
                value: name.into(),
                raw: None,
            }))),
            computed: false,
            optional: false,

            type_ann: Some(Box::new(TsTypeAnn {
                span: DUMMY_SP,
                type_ann: ty,
            })),
        })
    }

    fn type_literal(members: Vec<TsTypeElement>) -> Box<TsType> {
        Box::new(TsType::TsTypeLit(TsTypeLit {
            span: DUMMY_SP,
            members,
        }))
    }

    fn type_alias(name: &str, definition: Box<TsType>) -> ModuleItem {
        TsTypeAliasDecl {
            span: DUMMY_SP,
            declare: false,
            id: ident(name),
            type_params: None,
            type_ann: definition,
        }
        .into()
    }

    #[derive(Datex, Debug, Clone, PartialEq)]
    struct Example {
        a: u8,
        b: String,
        c: Endpoint,
    }

    #[test]
    fn test_simple_struct() {
        let ty = Example::datex_type(&mut Memory::default());
        let ast = TsTypeFolder::new().fold(&ty).unwrap();
        assert_eq!(ast.root, type_ref("Example"),);
        assert_eq!(
            ast.module.body,
            vec![type_alias(
                "Example",
                type_literal(vec![
                    property("a", number()),
                    property("b", string()),
                    property("c", type_ref("Endpoint")),
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
        let ast = TsTypeFolder::new().fold(&ty).unwrap();

        assert_eq!(ast.root, type_ref("WrappedStruct"));
        assert_eq!(
            ast.module.body,
            vec![
                type_alias(
                    "Example",
                    type_literal(vec![
                        property("a", number()),
                        property("b", string()),
                        property("c", type_ref("Endpoint")),
                    ]),
                ),
                type_alias(
                    "WrappedStruct",
                    type_literal(vec![property("inner", type_ref("Example")),]),
                ),
            ],
        );
    }
}
