use datex_core::{
    collections::HashMap,
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
            map::MapTypeDefinition, tagged_type::TaggedTypeDefinition,
            union::UnionTypeDefinition,
        },
        visitor::TypeFolder,
    },
    values::core_values::{
        boolean::Boolean, integer::typed_integer::TypedInteger,
    },
};
use num_bigint::BigInt as NumBigInt;

use swc_common::DUMMY_SP;
use swc_ecma_ast::{
    BigInt, BindingIdent, Bool, Expr, Ident, Lit, Module, ModuleItem, Number,
    Pat, RestPat, Str, TsArrayType, TsEntityName, TsFnParam, TsFnType,
    TsIntersectionType, TsKeywordType, TsKeywordTypeKind, TsLit, TsLitType,
    TsPropertySignature, TsTupleElement, TsTupleType, TsType, TsTypeAliasDecl,
    TsTypeAnn, TsTypeElement, TsTypeParamInstantiation, TsTypeRef, TsUnionType,
};

use crate::ts::{
    TsExport,
    ast::{TsAst, TsDeclaration, TsModuleAst},
    swc::*,
};
#[derive(Debug, Clone)]
enum AliasState {
    Visiting,
    Complete(Box<TsType>),
}

#[derive(Debug, Default)]
pub struct TsTypeFolder {
    aliases: HashMap<String, AliasState>,
    declaration_order: Vec<String>,
    docs: HashMap<String, String>,
}

impl TsTypeFolder {
    pub fn new() -> Self {
        Self::default()
    }

    fn into_module(self) -> Module {
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

    pub fn fold_inline(mut self, ty: &Type) -> Result<TsAst, ()> {
        let root = datex_core::types::visitor::fold_type(&mut self, ty)?;

        Ok(TsAst {
            module: self.into_module(),
            root,
        })
    }

    /// Generate a complete TypeScript file.
    pub fn fold_module<'a>(
        mut self,
        exports: impl IntoIterator<Item = TsExport<'a>>,
    ) -> Result<TsModuleAst, ()> {
        for export in exports {
            self.add_docs(export.name, export.docs);
            datex_core::types::visitor::fold_type(&mut self, &export.ty)?;
        }

        Ok(self.into_module_ast())
    }

    fn add_docs(&mut self, name: &str, docs: Option<&str>) {
        let Some(docs) = docs else {
            return;
        };
        if docs.trim().is_empty() {
            return;
        }
        match self.docs.get(name) {
            Some(existing) if existing != docs => {
                panic!(
                    "Conflicting documentation for TypeScript alias `{name}`"
                );
            }
            Some(_) => {}
            None => {
                self.docs.insert(name.to_string(), docs.to_string());
            }
        }
    }

    fn into_module_ast(self) -> TsModuleAst {
        let declarations = self
            .declaration_order
            .into_iter()
            .filter_map(|name| {
                let AliasState::Complete(type_ann) =
                    self.aliases.get(&name)?.clone()
                else {
                    return None;
                };

                Some(TsDeclaration {
                    docs: self.docs.get(&name).cloned(),
                    declaration: TsTypeAliasDecl {
                        span: DUMMY_SP,
                        declare: false,
                        id: ts_ident(&name),
                        type_params: None,
                        type_ann,
                    },
                })
            })
            .collect();

        TsModuleAst { declarations }
    }
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

    fn fold_tagged_type(
        &mut self,
        source: &TaggedTypeDefinition,
        payload: Option<Self::Output>,
    ) -> Result<Self::Output, Self::Error> {
        let mut members = vec![ts_string_property(
            "tag",
            ts_string_literal(source.tag.clone()),
        )];

        if let Some(payload) = payload {
            members.push(ts_string_property("value", payload));
        }

        Ok(ts_type_literal(members))
    }
}
