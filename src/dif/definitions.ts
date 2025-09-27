export const CoreTypeAddress = {
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
export type CoreTypeAddress =
    typeof CoreTypeAddress[keyof typeof CoreTypeAddress];

export const CoreTypeAddressRanges = {
    small_unsigned_integers: [0x640001, 0x640010],
    big_unsigned_integers: [0x640001, 0x640011],
    small_signed_integers: [0x640011, 0x640020],
    big_signed_integers: [0x640020, 0x640030],
    decimals: [0x64000B, 0x64000F], // Decimal and TypedDecimal
} as const;

/** 3, 5, or 26 byte hex string */
export type DIFPointerAddress = string;
export type DIFValue = {
    type?: DIFTypeContainer;
    value: DIFRepresentationValue;
};
export type DIFContainer = DIFValue | DIFPointerAddress;

export const ReferenceMutability = {
    Mutable: 0,
    Immutable: 1,
    Final: 2,
} as const;
export type ReferenceMutability =
    typeof ReferenceMutability[keyof typeof ReferenceMutability];

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

export type DIFValueContainer = DIFValue | DIFPointerAddress;
export type DIFTypeContainer = DIFType | DIFPointerAddress;

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
