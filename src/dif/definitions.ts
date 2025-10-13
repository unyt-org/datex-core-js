export const CoreTypeAddress = {
    null: "010000",
    type: "020000",
    boolean: "030000",
    endpoint: "070000",
    text: "080000",
    list: "090000",
    unit: "0b0000",
    map: "0c0000",
    decimal: "2c0100",
    decimal_f32: "2d0100",
    decimal_f64: "2e0100",
    decimal_big: "2f0100",
    integer: "640000",
    integer_u8: "650000",
    integer_u16: "660000",
    integer_u32: "670000",
    integer_u64: "680000",
    integer_u128: "690000",
    integer_i8: "6a0000",
    integer_i16: "6b0000",
    integer_i32: "6c0000",
    integer_i64: "6d0000",
    integer_i128: "6e0000",
    integer_big: "6f0000",
} as const;
export type CoreTypeAddress =
    typeof CoreTypeAddress[keyof typeof CoreTypeAddress];

export const CoreTypeAddressRanges = {
    small_unsigned_integers: new Set([
        CoreTypeAddress.integer_u8,
        CoreTypeAddress.integer_u16,
        CoreTypeAddress.integer_u32,
        CoreTypeAddress.integer_u64,
        CoreTypeAddress.integer_u128,
    ]),
    big_unsigned_integers: new Set([CoreTypeAddress.integer_big]),
    small_signed_integers: new Set([
        CoreTypeAddress.integer_i8,
        CoreTypeAddress.integer_i16,
        CoreTypeAddress.integer_i32,
        CoreTypeAddress.integer_i64,
        CoreTypeAddress.integer_i128,
    ]),
    big_signed_integers: new Set([CoreTypeAddress.integer_big]),
    decimals: new Set([
        CoreTypeAddress.decimal,
        CoreTypeAddress.decimal_f32,
        CoreTypeAddress.decimal_f64,
        CoreTypeAddress.decimal_big,
    ]),
} as const;

/** 3, 5, or 26 byte hex string */
export type DIFPointerAddress = string;
export type DIFValue = {
    type?: DIFTypeContainer;
    value: DIFRepresentationValue;
};
export type DIFContainer = DIFValue | DIFPointerAddress;

export const DIFTypeKinds = {
    Structural: 0,
    Reference: 1,
    Intersection: 2,
    Union: 3,
    Unit: 4,
    Function: 5,
} as const;
export type DIFTypeKind = typeof DIFTypeKinds[keyof typeof DIFTypeKinds];

export const DIFReferenceMutability = {
    Mutable: 0,
    Immutable: 1,
    Final: 2,
} as const;
export type DIFReferenceMutability =
    typeof DIFReferenceMutability[keyof typeof DIFReferenceMutability];

export type DIFTypeDefinition<Kind extends DIFTypeKind = DIFTypeKind> =
    Kind extends typeof DIFTypeKinds.Structural ? DIFValue
        : Kind extends typeof DIFTypeKinds.Reference ? DIFPointerAddress
        : Kind extends typeof DIFTypeKinds.Intersection
            ? Array<DIFTypeContainer>
        : Kind extends typeof DIFTypeKinds.Union ? Array<DIFTypeContainer>
        : Kind extends typeof DIFTypeKinds.Unit ? null
        : Kind extends typeof DIFTypeKinds.Function ? unknown // TODO
        : never;

// FIXME shall we split up actualType and allowedType, as the actual type does not need
// to represent unions and intersections?
export type DIFType<Kind extends DIFTypeKind = DIFTypeKind> = {
    name?: string;
    kind: Kind;
    def: DIFTypeDefinition<Kind>;
    mut?: DIFReferenceMutability;
};

export type DIFReference = {
    value: DIFValueContainer;
    allowed_type: DIFTypeContainer;
    mut: DIFReferenceMutability;
};

export type DIFValueContainer = DIFValue | DIFPointerAddress;
export type DIFTypeContainer = DIFType | DIFPointerAddress;

export type DIFObject = Record<string, DIFValueContainer>;
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
    | { kind: "text"; value: string }
    | { kind: "index"; value: number }
    | { kind: "value"; value: DIFValueContainer };

export const DIFUpdateKind = {
    Replace: "replace",
    Push: "push",
    Set: "set",
    Remove: "remove",
    Clear: "clear",
} as const;
export type DIFUpdateKind = typeof DIFUpdateKind[keyof typeof DIFUpdateKind];

export type DIFUpdateData =
    | { kind: typeof DIFUpdateKind.Replace; value: DIFValueContainer }
    | { kind: typeof DIFUpdateKind.Push; value: DIFValueContainer }
    | { kind: typeof DIFUpdateKind.Remove; key: DIFProperty }
    | {
        kind: typeof DIFUpdateKind.Set;
        key: DIFProperty;
        value: DIFValueContainer;
    }
    | { kind: typeof DIFUpdateKind.Clear };

export type DIFUpdate = {
    source_id: number;
    data: DIFUpdateData;
};

export type ObserveOptions = {
    relay_own_updates: boolean;
};
