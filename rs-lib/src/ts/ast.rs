use swc_common::DUMMY_SP;
use swc_ecma_ast::{Module, TsType, TsTypeAliasDecl};
use swc_ecma_codegen::to_code;

use crate::ts::utils::to_jsdoc;

pub struct TsAst {
    pub module: Module,
    pub root: Box<TsType>,
}

impl TsAst {
    pub fn to_typescript(&self) -> String {
        let declarations = to_code(&self.module);
        let root = to_code(self.root.as_ref());

        if declarations.trim().is_empty() {
            root
        } else {
            format!("{}\n{}", declarations.trim_end(), root,)
        }
    }

    pub fn declarations_to_typescript(&self) -> String {
        to_code(&self.module)
    }

    pub fn root_to_typescript(&self) -> String {
        to_code(self.root.as_ref())
    }
}

#[derive(Debug)]
pub struct TsDeclaration {
    pub docs: Option<String>,
    pub declaration: TsTypeAliasDecl,
}

#[derive(Debug)]
pub struct TsModuleAst {
    pub declarations: Vec<TsDeclaration>,
}

impl TsModuleAst {
    pub fn to_typescript(&self) -> String {
        self.declarations
            .iter()
            .map(|declaration| {
                let module = Module {
                    span: DUMMY_SP,
                    body: vec![declaration.declaration.clone().into()],
                    shebang: None,
                };

                let code = to_code(&module);
                let code = code.trim_end();

                match declaration.docs.as_deref() {
                    Some(docs) if !docs.trim().is_empty() => {
                        format!("{}\n{}", to_jsdoc(docs), code,)
                    }

                    _ => code.to_string(),
                }
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    }
}
