import { Endpoint } from "./special-core-types.ts";

/**
 * integer types that are interpreted as JS numbers per default
 */
export const smallIntegerTypes = [
    "integer/i8",
    "integer/i16",
    "integer/i32",
    "integer/u8",
    "integer/u16",
    "integer/u32",
    "integer",
] as const;

/**
 * integer types that are interpreted as JS BigInt per default
 */
export const bigIntegerTypes = [
    "integer/i32",
    "integer/i64",
    "integer/i128",
    "integer/u32",
    "integer/u64",
    "integer/u128",
] as const;

/**
 * decimal types that are interpreted as JS numbers per default
 * note: there is currently no special handling for bigdecimal values in JS
 */
export const decimalTypes = [
    "f32",
    "f64",
    "decimal",
] as const;

export type SmallIntegerType = typeof smallIntegerTypes[number];
export type BigIntegerType = typeof bigIntegerTypes[number];
export type IntegerType = SmallIntegerType | BigIntegerType;
export type DecimalType = typeof decimalTypes[number];

export type CoreType =
    | "text"
    | "boolean"
    | "null"
    | "array"
    | "object"
    | "tuple"
    | "endpoint"
    | IntegerType
    | DecimalType;

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

export type DIFType = any

export type DIFValue = {
    ptr_id?: string;
    type: DIFType;
    value: DIFCoreValue;
};

/**
 * Resolves a DIFValue to its corresponding JS value.
 * This function handles core types and custom types (not yet implemented).
 * It returns the resolved value as the specified type T.
 * @param value
 */
export function resolveDIFValue<T extends unknown>(
    value: DIFValue,
): T {
    // if the core_type is the same as the type, we can just return a core value
    const isCoreType = value.type === value.type;
    // const isPointer = !!value.ptr_id; // TODO: handle pointers

    if (isCoreType) {
        // boolean and text types values are just returned as is
        if (value.type === "boolean" || value.type == "text") {
            return value.value as T;
        } // small integers are interpreted as JS numbers
        else if (smallIntegerTypes.includes(value.type as SmallIntegerType)) {
            return Number(value.value as number) as T;
        } // big integers are interpreted as JS BigInt
        else if (bigIntegerTypes.includes(value.type as BigIntegerType)) {
            return BigInt(value.value as number) as T;
        } // decimal types are interpreted as JS numbers
        else if (decimalTypes.includes(value.type as DecimalType)) {
            return (Number(value.value) as number) as T;
        } // TODO: wasm_bindgen returns undefined here, although it should be null. So we just return null for now.
        else if (value.type === "null") {
            return null as T;
        } // endpoint types are resolved to Endpoint instances
        else if (value.type == "endpoint") {
            return Endpoint.get(value.value as string) as T;
        } // array types are resolved to arrays of DIFValues
        else if (value.type === "array") {
            return (value.value as DIFArray).map((v) =>
                resolveDIFValue(v)
            ) as T;
        } // object types are resolved to objects with string keys and DIFValues
        else if (value.type === "object") {
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

/**
 * Converts a given JS value to its DIFValue representation.
 */
export function convertToDIFValue<T extends unknown>(
    value: T,
): DIFValue {
    // assuming core values
    // TODO: handle custom types
    if (value === null) {
        return {
            type: "null",
            value: null,
        };
    } else if (typeof value === "boolean") {
        return {
            type: "boolean",
            value,
        };
    } else if (typeof value === "number") {
        return {
            type: "f64",
            value,
        };
    } else if (typeof value === "bigint") {
        return {
            type: "integer", // todo: use typed bigint instead of integer default type
            value: value.toString(), // convert bigint to string for DIFValue
        };
    } else if (typeof value === "string") {
        return {
            type: "text",
            value,
        };
    } else if (value instanceof Endpoint) {
        return {
            type: "endpoint",
            value: value.toString(),
        };
    } else if (Array.isArray(value)) {
        return {
            type: "array",
            value: value.map((v) => convertToDIFValue(v)),
        };
    } else if (typeof value === "object") {
        const map = new Map<string, DIFValue>();
        for (const [key, val] of Object.entries(value)) {
            map.set(key, convertToDIFValue(val));
        }
        return {
            type: "object",
            value: map,
        };
    }
    throw new Error("Unsupported type for conversion to DIFValue");
}

/**
 * Converts an array of JS values to an array of DIFValues.
 * If the input is null, it returns null.
 * @param values
 */
export function convertToDIFValues<T extends unknown[]>(
    values: T | null,
): DIFValue[] | null {
    return values?.map((value) => convertToDIFValue(value)) || null;
}
