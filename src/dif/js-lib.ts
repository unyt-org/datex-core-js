/**
 * Creates a reserved pointer address for a js lib type with the given id.
 * The endpoint is the broadcast (reserved) endpoint. This can be used for builtin types.
 * @param id Id of the js lib type. Must be a non-negative integer that fits into 5 bytes.
 * @returns The reserved pointer address for the js lib type with the given id.
 */
export function createReservedPointerAddress(id: number): string {
    const idHex = id.toString(16);
    if (!Number.isInteger(id) || id < 0 || idHex.length > 10) {
        throw new Error("invalid id");
    }
    return "FF".repeat(21) + idHex.padStart(10, "0");
}

export const JsLibTypeAddress = {
    undefined: createReservedPointerAddress(0),
} as const;

/**
 * Type representing the unique pointer addresses of js lib types.
 */
export type JsLibTypeAddress = typeof JsLibTypeAddress[keyof typeof JsLibTypeAddress];
