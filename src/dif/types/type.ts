/**
 * @module DIF Types
 * @description
 * This module contains all type definitions related to the representation of types in DIF.
 */

import type { CoreLibTypeId } from "../core.ts";
import type { DIFPointerAddress } from "./value.ts";

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

export type DIFTypeTypeDefinition = null; // TODO alias / nominal

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
    | [typeof CoreLibTypeId.decimal_f32, string | number]
    | [typeof CoreLibTypeId.decimal_f64, string | number]
    | [typeof CoreLibTypeId.decimal_dbig, string]
    | [typeof CoreLibTypeId.endpoint, string];

export type DIFListTypeDefinition = DIFTypeTypeDefinition[];

export type DIFMapTypeDefinition = Array<[DIFTypeTypeDefinition, DIFTypeTypeDefinition]>;

export type DIFRangeTypeDefinition = [DIFTypeTypeDefinition, DIFTypeTypeDefinition];

export type DIFNestedTypeDefinition = DIFTypeTypeDefinition;

export type DIFImplTypeDefinition = [DIFTypeTypeDefinition, Array<DIFPointerAddress>];

export type DIFIntersectionTypeDefinition = Array<DIFTypeTypeDefinition>;

export type DIFUnionTypeDefinition = Array<DIFTypeTypeDefinition>;

export type DIFTaggedTypeDefinition = [string, DIFTypeTypeDefinition];

export type DIFTypeMarker = "";

export type DIFSharedTypeDefinition = null; // TODO
export type DIFCallableTypeDefinition = null; // TODO

export type DIFCollectionTypeDefinition =
    | DIFCollectionListTypeDefinition
    | DIFCollectionListSliceTypeDefinition
    | DIFCollectionMapTypeDefinition
    | DIFRangeTypeDefinition;

export type DIFCollectionListTypeDefinition = DIFTypeTypeDefinition;
export type DIFCollectionListSliceTypeDefinition = [DIFTypeTypeDefinition, number];
export type DIFCollectionMapTypeDefinition = Array<[DIFTypeTypeDefinition, DIFTypeTypeDefinition]>;
