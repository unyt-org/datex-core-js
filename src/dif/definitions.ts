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
    | { kind: "index"; value: number } // FIXME shall we optimize this? as number of wrap pointer address in obj and use plain dif value container without nesting
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
