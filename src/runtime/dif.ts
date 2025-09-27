import { Endpoint } from "./special-core-types.ts";

const CoreTypeAddress = {
    // TODO:
    integer: "640000",
    integer_big: "64000C",
    decimal: "64000A",
    decimal_f64: "64000B",
    null: "640001",
    boolean: "640002",
    text: "640003",
    array: "640004",
    struct: "640005",
    list: "640006",
    map: "640007",
    endpoint: "640008",
} as const;
type CoreTypeAddress = typeof CoreTypeAddress[keyof typeof CoreTypeAddress];

const CoreTypeAddressRanges = {
    small_unsigned_integers: [0x640001, 0x640010],
    big_unsigned_integers: [0x640001, 0x640011],
    small_signed_integers: [0x640011, 0x640020],
    big_signed_integers: [0x640020, 0x640030],
    decimals: [0x64000B, 0x64000F], // Decimal and TypedDecimal
} as const;

/** 3, 5, or 26 byte hex string */
export type DIFPointerAddress = string;
export type DIFValue = {
    type: DIFTypeContainer;
    value: DIFRepresentationValue;
};
export type DIFContainer = DIFValue | DIFPointerAddress;

const DIFTypeKinds = {
    Structural: 0,
    Reference: 1,
    Intersection: 2,
    Union: 3,
    Unit: 4,
    Function: 5,
} as const;
type DIFTypeKind = typeof DIFTypeKinds[keyof typeof DIFTypeKinds];

const DIFReferenceMutability = {
    Mutable: 0,
    Immutable: 1,
    Final: 2,
} as const;
type DIFReferenceMutability =
    typeof DIFReferenceMutability[keyof typeof DIFReferenceMutability];

type DIFTypeDefinition<Kind extends DIFTypeKind = DIFTypeKind> = Kind extends
    typeof DIFTypeKinds.Structural ? DIFValue
    : Kind extends typeof DIFTypeKinds.Reference ? DIFPointerAddress
    : Kind extends typeof DIFTypeKinds.Intersection ? Array<DIFTypeContainer>
    : Kind extends typeof DIFTypeKinds.Union ? Array<DIFTypeContainer>
    : Kind extends typeof DIFTypeKinds.Unit ? null
    : Kind extends typeof DIFTypeKinds.Function ? unknown // TODO
    : never;

type DIFType<Kind extends DIFTypeKind = DIFTypeKind> = {
    name?: string;
    kind: Kind;
    def: DIFTypeDefinition<Kind>;
    mut?: DIFReferenceMutability;
};

type DIFValueContainer = DIFValue | DIFPointerAddress;
type DIFTypeContainer = DIFType | DIFPointerAddress;

// TODO: wasm_bindgen currently returns a Map here - could we also just use an object, or is a Map actually more efficient?
export type DIFObject = Map<string, DIFValueContainer>;
export type DIFArray = DIFValueContainer[];
export type DIFMap = [DIFValueContainer, DIFValueContainer][];

export type DIFRepresentationValue =
    | string
    | number
    | boolean
    | null
    | DIFObject
    | DIFMap
    | DIFArray;

// DIFProperty
export type DIFProperty =
    | { kind: "Text"; value: string }
    | { kind: "Integer"; value: number }
    | { kind: "Value"; value: DIFValueContainer };

// DIFUpdate
export type DIFUpdate =
    | { kind: "Replace"; value: DIFValueContainer }
    | { kind: "Push"; value: DIFValueContainer }
    | {
        kind: "UpdateProperty";
        value: {
            property: DIFProperty;
            value: DIFValueContainer;
        };
    };

/**
 * Resolves a DIFValue to its corresponding JS value.
 * This function handles core types and custom types (not yet implemented).
 * It returns the resolved value as the specified type T.
 * @param value
 */
export function resolveDIFValue<T extends unknown>(
    value: DIFValue,
): T | Promise<T> {
    // if the core_type is the same as the type, we can just return a core value
    const isCoreType = value.type === value.type;
    // const isPointer = !!value.ptr_id; // TODO: handle pointers

    if (isCoreType) {
        // boolean and text types values are just returned as is
        if (
            value.type === CoreTypeAddress.boolean ||
            value.type == CoreTypeAddress.text
        ) {
            return value.value as T;
        } // small integers are interpreted as JS numbers
        else if (
            typeof value.type === "string" && (
                value.type == CoreTypeAddress.integer ||
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.small_signed_integers,
                ) ||
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.small_unsigned_integers,
                )
            )
        ) {
            return Number(value.value as number) as T;
        } // big integers are interpreted as JS BigInt
        else if (
            typeof value.type === "string" && (
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.big_signed_integers,
                ) ||
                isPointerAddressInRange(
                    value.type,
                    CoreTypeAddressRanges.big_unsigned_integers,
                )
            )
        ) {
            return BigInt(value.value as number) as T;
        } // decimal types are interpreted as JS numbers
        else if (
            typeof value.type === "string" &&
            isPointerAddressInRange(value.type, CoreTypeAddressRanges.decimals)
        ) {
            return (Number(value.value) as number) as T;
        } // TODO: wasm_bindgen returns undefined here, although it should be null. So we just return null for now.
        else if (value.type === CoreTypeAddress.null) {
            return null as T;
        } // endpoint types are resolved to Endpoint instances
        else if (value.type === CoreTypeAddress.endpoint) {
            return Endpoint.get(value.value as string) as T;
        } // array types are resolved to arrays of DIFValues
        else if (value.type === CoreTypeAddress.array) {
            return promiseAllOrSync(
                (value.value as DIFArray).map((v) =>
                    resolveDIFValueContainer(v)
                ),
            ) as T | Promise<T>;
        } else if (value.type === CoreTypeAddress.list) {
            return promiseAllOrSync(
                (value.value as DIFArray).map((v) =>
                    resolveDIFValueContainer(v)
                ),
            ) as T | Promise<T>;
        } // object types are resolved to objects with string keys and DIFValues
        else if (value.type === CoreTypeAddress.struct) {
            const resolvedObj: { [key: string]: unknown } = {};
            for (const [key, val] of (value.value as DIFObject).entries()) {
                resolvedObj[key] = resolveDIFValueContainer(val);
            }
            return promiseFromObjectOrSync(resolvedObj) as T | Promise<T>;
        }
    } else {
        throw new Error("custom types not supported yet");
    }

    return undefined as T;
}

export function resolveDIFContainer<T extends unknown>(
    value: DIFContainer,
): T | Promise<T> {
    if (typeof value === "string") {
        throw new Error("Pointer resolution not implemented yet");
    } else {
        return resolveDIFValue<T>(value);
    }
}

function promiseAllOrSync<T>(values: (T | Promise<T>)[]): Promise<T[]> | T[] {
    if (values.some((v) => v instanceof Promise)) {
        return Promise.all(values);
    } else {
        return values as T[];
    }
}

function promiseFromObjectOrSync<T>(
    values: { [key: string]: T | Promise<T> },
): Promise<{ [key: string]: T }> | { [key: string]: T } {
    const valueArray = Object.values(values);
    if (valueArray.some((v) => v instanceof Promise)) {
        return Promise.all(valueArray).then((resolvedValues) => {
            const resolvedObj: { [key: string]: T } = {};
            let i = 0;
            for (const key of Object.keys(values)) {
                resolvedObj[key] = resolvedValues[i++];
            }
            return resolvedObj;
        });
    } else {
        return values as { [key: string]: T };
    }
}

export function resolveDIFValueContainer<T extends unknown>(
    value: DIFValueContainer,
): T | Promise<T> {
    if (typeof value !== "string") {
        return resolveDIFValue(value);
    } else {
        // todo resolve pointer id
        return undefined as T;
    }
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
            type: CoreTypeAddress.null,
            value: null,
        };
    } else if (typeof value === "boolean") {
        return {
            type: CoreTypeAddress.boolean,
            value,
        };
    } else if (typeof value === "number") {
        return {
            type: CoreTypeAddress.decimal_f64,
            value,
        };
    } else if (typeof value === "bigint") {
        return {
            type: CoreTypeAddress.integer_big,
            value: value.toString(), // convert bigint to string for DIFValue
        };
    } else if (typeof value === "string") {
        return {
            type: CoreTypeAddress.text,
            value,
        };
    } else if (value instanceof Endpoint) {
        return {
            type: CoreTypeAddress.endpoint,
            value: value.toString(),
        };
    } else if (Array.isArray(value)) {
        return {
            type: CoreTypeAddress.array,
            value: value.map((v) => convertToDIFValue(v)),
        };
    } else if (typeof value === "object") {
        const map = new Map<string, DIFValue>();
        for (const [key, val] of Object.entries(value)) {
            map.set(key, convertToDIFValue(val));
        }
        return {
            type: CoreTypeAddress.struct,
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

/**
 * Returns true if the given address is within the specified address range.
 */
function isPointerAddressInRange(
    address: DIFPointerAddress,
    range: readonly [number, number],
): boolean {
    const addressNum = parseInt(address, 16);
    return addressNum >= range[0] && addressNum < range[1];
}
