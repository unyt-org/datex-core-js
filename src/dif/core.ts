/**
 * @module DIF Core
 * @description
 * This module contains core library specific mappings of core type ids.
 */

/**
 * Mapping of core types to their respective type id.
 */
export const CoreLibTypeId = {
    null: 1,
    boolean: 2,
    integer: 3,
    integer_u8: 501,
    integer_u16: 502,
    integer_u32: 503,
    integer_u64: 504,
    integer_u128: 505,
    integer_i8: 506,
    integer_i16: 507,
    integer_i32: 508,
    integer_i64: 509,
    integer_i128: 510,
    integer_ibig: 511,
    decimal: 4,
    decimal_f32: 512,
    decimal_f64: 513,
    decimal_dbig: 514,
    text: 5,
    endpoint: 6,
    Unit: 7,
    Never: 8,
    Unknown: 9,
    List: 10,
    Map: 11,
    Callable: 12,
    Range: 13,
    Type: 14,
} as const;

/**
 * Type representing the core library type ids.
 */
export type CoreLibTypeId = typeof CoreLibTypeId[keyof typeof CoreLibTypeId];
