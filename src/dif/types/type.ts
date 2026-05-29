/**
 * @module DIF Types
 * @description
 * This module contains all type definitions related to the representation of types in DIF.
 */

import type { CoreLibTypeId } from "../core.ts";

/**
 * A core lib is directly serialized as number.
 */
type DIFCoreLibTypeDefinition = CoreLibTypeId;

type DIFTypeDefinitionMap = {
    literal: DIFLiteralTypeDefinition;
    list: DIFListTypeDefinition;
    map: DIFMapTypeDefinition;
    range: DIFRangeTypeDefinition;
    collection: DIFCollectionTypeDefinition;
    shared: DIFSharedTypeDefinition;
    nested: DIFNestedTypeDefinition;
    callable: DIFCallableTypeDefinition;
    impl: DIFImplTypeDefinition;
    intersection: DIFIntersectionTypeDefinition;
    union: DIFUnionTypeDefinition;
    tagged: DIFTaggedTypeDefinition;
    marker: DIFTypeMarker;
};

export type DIFTypeMetadata = {
    kind: "local";
    mutability: "mut" | "";
    referenceMutability?: "&" | "&mut";
} | {
    kind: "shared";
    mutability: "" | "mut";
    ownership: "'mut" | "'" | "";
};

export type DIFTypeDefinitionWithMetadata = [
    DIFTypeMetadata,
    DIFTypeDefinition,
];
export type SharedContainerContainingNominalType = string; // $address
export type DIFType = DIFTypeDefinitionWithMetadata | SharedContainerContainingNominalType; // TODO alias / nominal

/**
 * The DIFTypeDefinition represents a structural (only for now) type definition in the DIF format.
 */
export type DIFTypeDefinition =
    | DIFCoreLibTypeDefinition
    | {
        [K in keyof DIFTypeDefinitionMap]: {
            [P in K]: DIFTypeDefinitionMap[K];
        };
    }[keyof DIFTypeDefinitionMap];

export type DIFLiteralTypeDefinition =
    | boolean // boolean
    | string // text
    | [typeof CoreLibTypeId.integer, number]
    | [typeof CoreLibTypeId.integer_u8, number]
    | [typeof CoreLibTypeId.integer_u16, number]
    | [typeof CoreLibTypeId.integer_u32, number]
    | [typeof CoreLibTypeId.integer_u64, number]
    | [typeof CoreLibTypeId.integer_u128, string]
    | [typeof CoreLibTypeId.integer_i8, number]
    | [typeof CoreLibTypeId.integer_i16, number]
    | [typeof CoreLibTypeId.integer_i32, number]
    | [typeof CoreLibTypeId.integer_i64, number]
    | [typeof CoreLibTypeId.integer_i128, string]
    | [typeof CoreLibTypeId.integer_ibig, string]
    | [typeof CoreLibTypeId.decimal, string]
    | [typeof CoreLibTypeId.decimal_f32, "nan" | "infinity" | "-infinity" | number]
    | [typeof CoreLibTypeId.decimal_f64, "nan" | "infinity" | "-infinity" | number]
    | [typeof CoreLibTypeId.decimal_dbig, string]
    | [typeof CoreLibTypeId.endpoint, string];

export type DIFListTypeDefinition = DIFType[];

export type DIFMapTypeDefinition = Array<[DIFType, DIFType]>;

export type DIFRangeTypeDefinition = [DIFType, DIFType];

export type DIFNestedTypeDefinition = DIFType;

export type DIFImplTypeDefinition = [DIFType, Array<string>];

export type DIFIntersectionTypeDefinition = Array<DIFType>;

export type DIFUnionTypeDefinition = Array<DIFType>;

export type DIFTaggedTypeDefinition = [string, DIFType];

export type DIFTypeMarker = "";

export type DIFSharedTypeDefinition = null; // TODO
export type DIFCallableTypeDefinition = null; // TODO

export type DIFCollectionTypeDefinition =
    | DIFCollectionListTypeDefinition
    | DIFCollectionListSliceTypeDefinition
    | DIFCollectionMapTypeDefinition
    | DIFRangeTypeDefinition;

export type DIFCollectionListTypeDefinition = DIFType;
export type DIFCollectionListSliceTypeDefinition = [DIFType, number];
export type DIFCollectionMapTypeDefinition = Array<[DIFType, DIFType]>;
