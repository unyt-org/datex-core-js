import { CoreLibTypeId } from "../../dif/core.ts";
import { JsLibTypeAddress } from "../../dif/js-lib.ts";
import type { DIFValue } from "../../dif/types/mod.ts";
import type { DIFImplTypeDefinition, DIFTypeDefinition } from "../../dif/types/type.ts";

const JS_UNDEFINED_IMPL_TYPE_DEFINITION: DIFImplTypeDefinition = [
    null, // FIXME
    [JsLibTypeAddress.undefined],
];
function isJsUndefinedImplTypeDefinition(impl: unknown): impl is DIFImplTypeDefinition {
    return (
        Array.isArray(impl) &&
        impl.length === 2 &&
        impl[0] === CoreLibTypeId.Type &&
        Array.isArray(impl[1]) &&
        impl[1].length === 1 &&
        impl[1][0] === JsLibTypeAddress.undefined
    );
}

export const JS_UNDEFINED_TYPE_DEFINITION: DIFTypeDefinition = {
    impl: JS_UNDEFINED_IMPL_TYPE_DEFINITION,
};

export const JS_UNDEFINED: DIFValue = [CoreLibTypeId.Unit, null, JS_UNDEFINED_TYPE_DEFINITION];
export function isJsUndefined(value: DIFValue): boolean {
    return Array.isArray(value) &&
        value.length === 3 &&
        value[0] === CoreLibTypeId.Unit &&
        value[1] === null &&
        isJsUndefinedImplTypeDefinition(value[2]);
}
