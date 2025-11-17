/**
 * @module
 * @description
 * This module contains all definitions related to the DIF (DATEX Interchange Format) interfaces of the DATEX runtime.
 */

/**
 * A DATEX pointer address representation in the DIF format.
 * (3, 5, or 26 byte hex string)
 */
export type DIFPointerAddress = string;
/**
 * A DATEX value representation in the DIF format,
 * which may optionally include type information.
 */
export type DIFValue = {
    type?: DIFTypeContainer;
    value: DIFRepresentationValue;
};

/**
 * Mapping of DIF type kinds.
 */
export const DIFTypeKinds = {
    Structural: 0,
    Reference: 1,
    Intersection: 2,
    Union: 3,
    Unit: 4,
    Function: 5,
} as const;
/** A DIF type kind. */
export type DIFTypeKind = typeof DIFTypeKinds[keyof typeof DIFTypeKinds];

/**
 * Representation of reference mutability (mutable or immutable) in DIF.
 */
export const DIFReferenceMutability = {
    Mutable: 0,
    Immutable: 1,
} as const;
/** A DIF reference mutability. */
export type DIFReferenceMutability =
    typeof DIFReferenceMutability[keyof typeof DIFReferenceMutability];

/** A DIF type definition based on its kind. */
export type DIFTypeDefinition<Kind extends DIFTypeKind = DIFTypeKind> =
    Kind extends typeof DIFTypeKinds.Structural ? DIFValue
        : Kind extends typeof DIFTypeKinds.Reference ? DIFPointerAddress
        : Kind extends typeof DIFTypeKinds.Intersection
            ? Array<DIFTypeContainer>
        : Kind extends typeof DIFTypeKinds.Union ? Array<DIFTypeContainer>
        : Kind extends typeof DIFTypeKinds.Unit ? null
        : Kind extends typeof DIFTypeKinds.Function ? unknown // TODO
        : never;

/** A DIF type representation. */
export type DIFType<Kind extends DIFTypeKind = DIFTypeKind> = {
    name?: string;
    kind: Kind;
    def: DIFTypeDefinition<Kind>;
    mut?: DIFReferenceMutability;
};

/** A representation of a reference in DIF. */
export type DIFReference = {
    value: DIFValueContainer;
    allowed_type: DIFTypeContainer;
    mut: DIFReferenceMutability;
};

/** A representation of a value or pointer address in DIF. */
export type DIFValueContainer = DIFValue | DIFPointerAddress;
/** A representation of a type or type pointer address in DIF. */
export type DIFTypeContainer = DIFType | DIFPointerAddress;

/** A DIF object, mapping string keys to DIF value containers. */
export type DIFObject = Record<string, DIFValueContainer>;
/** A DIF array, containing DIF value containers. */
export type DIFArray = DIFValueContainer[];
/** A DIF map, containing key-value pairs of DIF value containers. */
export type DIFMap = [DIFValueContainer, DIFValueContainer][];

/** Any DIF representation value (JSON-compatible values). */
export type DIFRepresentationValue =
    | string
    | number
    | boolean
    | null
    | DIFObject
    | DIFMap
    | DIFArray;

/**
 * Representation of a property in DIF, which can be a text key, an index, or a generic value.
 */
export type DIFProperty =
    | { kind: "text"; value: string }
    | { kind: "index"; value: number } // FIXME shall we optimize this? as number of wrap pointer address in obj and use plain dif value container without nesting
    | { kind: "value"; value: DIFValueContainer };

/**
 * Kinds of updates that can be applied to a DIF value.
 */
export const DIFUpdateKind = {
    Replace: "replace",
    Append: "append", // TODO: rename to append in datex-core
    Set: "set",
    Delete: "delete", // TODO: rename to delete in datex-core
    Clear: "clear",
} as const;
/** A DIF update kind. */
export type DIFUpdateKind = typeof DIFUpdateKind[keyof typeof DIFUpdateKind];

/** Different kinds of updates that can be applied to a DIF value. */
export type DIFUpdateBaseData<Kind extends DIFUpdateKind> = {
    kind: Kind;
};
export type DIFUpdateDataReplace =
    & DIFUpdateBaseData<typeof DIFUpdateKind.Replace>
    & {
        value: DIFValueContainer;
    };
export type DIFUpdateDataPush =
    & DIFUpdateBaseData<typeof DIFUpdateKind.Append>
    & {
        value: DIFValueContainer;
    };
export type DIFUpdateDataDelete =
    & DIFUpdateBaseData<typeof DIFUpdateKind.Delete>
    & {
        key: DIFProperty;
    };
export type DIFUpdateDataSet = DIFUpdateBaseData<typeof DIFUpdateKind.Set> & {
    key: DIFProperty;
    value: DIFValueContainer;
};
export type DIFUpdateDataClear = DIFUpdateBaseData<typeof DIFUpdateKind.Clear>;

export type DIFUpdateData =
    | DIFUpdateDataReplace
    | DIFUpdateDataPush
    | DIFUpdateDataDelete
    | DIFUpdateDataSet
    | DIFUpdateDataClear;

/** A DIF update struct, associating a source ID with update data. */
export type DIFUpdate = {
    source_id: number;
    data: DIFUpdateData;
};

/** Options for observing DIF pointers. */
export type ObserveOptions = {
    relay_own_updates: boolean;
};
