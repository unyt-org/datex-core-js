import { Endpoint } from "./special-core-types.ts";

export type CoreType =
    | "integer"
    | "decimal"
    | "text"
    | "boolean"
    | "null"
    | "array"
    | "object"
    | "tuple"
    | "endpoint";

// TODO: wasm_bindgen currently returns a Map here - could we also just use an object, or is a Map actually more efficient?
export type DIFMap = Map<string, DIFValue>;
export type DIFArray = DIFValue[];
export type DIFCoreValue =
    | string
    | number
    | boolean
    | null
    | DIFMap
    | DIFArray;

export type DIFValue = {
    core_type: CoreType;
    ptr_id?: string;
    type: CoreType; // TODO: this will not be a CoreType in the future, but a more complex type
    value: DIFCoreValue;
};

export function resolveDIFValue<T extends unknown>(
    value: DIFValue,
): T {
    // if the core_type is the same as the type, we can just return a core value
    const isCoreType = value.core_type === value.type;
    const isPointer = !!value.ptr_id; // TODO: handle pointers

    if (isCoreType) {
        if (
            value.type === "boolean" || value.type == "text" ||
            value.type === "integer" || value.type === "decimal"
        ) {
            return value.value as T;
        } else if (value.type === "null") {
            // TODO: wasm_bindgen returns undefined here, although it should be null. So we just return null for now.
            return null as T;
        } else if (value.type == "endpoint") {
            return Endpoint.get(value.value as string) as T;
        } else if (value.type === "array") {
            return (value.value as DIFArray).map((v) =>
                resolveDIFValue(v)
            ) as T;
        } else if (value.type === "object") {
            const resolvedObj: { [key: string]: unknown } = {};
            for (const [key, val] of (value.value as DIFMap).entries()) {
                resolvedObj[key] = resolveDIFValue(val);
            }
            return resolvedObj as T;
        }
        // TODO: handle tuple (map to custom class?)
        // TODO: handle bigint/bigdecimal and other variants, map to bigint/number
    } else {
        throw new Error("custom types not supported yet");
    }

    return undefined as T;
}
