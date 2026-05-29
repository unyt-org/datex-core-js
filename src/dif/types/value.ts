/**
 * @module DIF Value Types
 * @description
 * This module contains all type definitions related to the representation of values in DIF.
 */
import type { CoreLibTypeId } from "../core.ts";
import type { DIFTypeDefinition } from "./type.ts";

/**
 * DIF value container, which can be either a pointer address or a value.
 */
export type DIFValueContainer = DIFPointerAddress | DIFValue;

/**
 * A DATEX pointer address representation in the DIF format.
 */
export type DIFPointerAddress = { $: string };

/**
 * A DIF value, which can be directly represented in the DIF format (e.g., primitive types) or a value including
 * additional type information.
 */
export type DIFValue =
    | DIFDirectRepresentationValue
    | [CoreLibTypeId, CoreValue]
    | [CoreLibTypeId, CoreValue, DIFTypeDefinition];

/**
 * Types of values that can be directly represented in DIF without
 * additional type information (e.g., for primitive types like text, f64, boolean, and null).
 */
export type DIFDirectRepresentationValue = boolean | string | number | null;

/**
 * Represents a list of DIFValueContainers.
 */
export type CoreValueList = Array<DIFValueContainer>;

/**
 * Represents a map of key-value pairs in DIF, where both keys and values are DIFValueContainers.
 */
export type CoreValueMap = Array<[DIFValueContainer, DIFValueContainer]>;

/**
 * Represents a range of values in DIF, defined by a start and end value container, or as a tuple of two value containers.
 */
export type CoreValueRange = [DIFValueContainer, DIFValueContainer] | {
    start: DIFValueContainer;
    end: DIFValueContainer;
};
/**
 * Represents a core value in DIF, which can be a primitive value, a structured object, a list, or a map.
 */
export type CoreValue =
    | CoreValueList // list
    | CoreValueMap // map
    | CoreValueRange // range
    | Record<string, DIFValueContainer> // StructuralMapWithStringKeys
    | string // text / endpoint
    | number // integer / decimal
    | boolean // booleans
    | null; // null
