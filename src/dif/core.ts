/**
 * Mapping of core types to their respective type id.
 */
export const CoreLibTypeId = {
    null: 1,
    boolean: 2,
    integer: 3,
    integer_u8: 3,
    integer_u16: 3,
    integer_u32: 3,
    integer_u64: 3,
    integer_u128: 3,
    integer_i8: 3,
    integer_i16: 3,
    integer_i32: 3,
    integer_i64: 3,
    integer_i128: 3,
    integer_ibig: 3,
    decimal: 4,
    decimal_f32: 4,
    decimal_f64: 4,
    decimal_dbig: 4,
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
