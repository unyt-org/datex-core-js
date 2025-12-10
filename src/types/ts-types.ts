import type { DIFTypeDefinition } from "../dif/definitions.ts";
import { CoreTypeAddress } from "../dif/core.ts";

/**
 * Template function for creating TypeScript types that are converted to DIF type containers.
 * Currently only supports primitive types: number, string, boolean, null.
 * NOTE: this only a proof of concept prototype impl. We should probably move this to rust in the future.
 * Template function for creating TypeScript types

 * @param def The template string defining the TypeScript type.
 * @param args Additional arguments (not used currently).
 * @returns A DIFTypeContainer representing the TypeScript type.
 */
export function TS_TYPE(
    def: TemplateStringsArray,
    ...args: unknown[]
): DIFTypeDefinition {
    let full_definition = "";
    for (let i = 0; i < def.length; i++) {
        full_definition += def[i];
        if (i < args.length) {
            full_definition += args[i];
        }
    }
    return convertTSTypeToDIFType(full_definition.trim());
}

function convertTSTypeToDIFType(ts_type_str: string): DIFTypeDefinition {
    ts_type_str = ts_type_str.trim();
    if (ts_type_str === "number") {
        return CoreTypeAddress.decimal_f64;
    } else if (ts_type_str === "string") {
        return CoreTypeAddress.text;
    } else if (ts_type_str === "null") {
        return CoreTypeAddress.null;
    } else if (ts_type_str === "boolean") {
        return CoreTypeAddress.boolean;
    } else {
        throw new Error(
            `TS type conversion not implemented for: ${ts_type_str}`,
        );
    }
}
