import { type DIFUpdateData, DIFUpdateKind } from "./definitions.ts";
import type { DIFHandler } from "./dif-handler.ts";

/**
 * Creates a DIFUpdate object that describes replacing a pointer's value.
 */
export function DIF_Replace<T>(
    difHandler: DIFHandler,
    value: T,
): DIFUpdateData {
    const difValue = difHandler.convertJSValueToDIFValue(value);
    return {
        kind: DIFUpdateKind.Replace,
        value: difValue,
    };
}

/**
 * Creates a DIFUpdate object that describes updating a property of a pointer's value.
 */
export function DIF_UpdateProperty<K, V>(
    difHandler: DIFHandler,
    property: K,
    value: V,
): DIFUpdateData {
    const difKey = difHandler.convertJSValueToDIFValue(property);
    const difValue = difHandler.convertJSValueToDIFValue(value);
    return {
        kind: DIFUpdateKind.Set,
        key: { kind: "value", value: difKey },
        value: difValue,
    };
}
