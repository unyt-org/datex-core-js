/**
 * Helper methods for creating update data dif structures.
 */
import type { DIFProperty, DIFValueContainer } from "./types/mod.ts";
import { type DIFUpdateData, DIFUpdateKind } from "./types/update.ts";

export enum DIFPropertyKind {
    Index,
    Text,
    ValueContainer,
}
export function createDIFProperty(
    value: string | number | DIFValueContainer,
    propertyKind: DIFPropertyKind,
) {
    switch (propertyKind) {
        case DIFPropertyKind.Index:
            if (typeof value !== "number") {
                throw new Error("Expected number for index property");
            }
            return value;
        case DIFPropertyKind.Text:
            if (typeof value !== "string") {
                throw new Error("Expected string for text property");
            }
            return value;
        case DIFPropertyKind.ValueContainer:
            return { value };
    }
}

export function clear(): DIFUpdateData {
    return [DIFUpdateKind.Clear];
}
export function replace(value: DIFValueContainer): DIFUpdateData {
    return [DIFUpdateKind.Replace, value];
}
export function appendEntry(value: DIFValueContainer): DIFUpdateData {
    return [DIFUpdateKind.AppendEntry, value];
}
export function setEntry(
    key: DIFProperty,
    value: DIFValueContainer,
): DIFUpdateData {
    return [DIFUpdateKind.SetEntry, key, value];
}
export function deleteEntry(
    key: DIFProperty,
): DIFUpdateData {
    return [DIFUpdateKind.DeleteEntry, key];
}
export function listSplice(
    start: number,
    deleteCount: number,
    items: DIFValueContainer[],
): DIFUpdateData {
    return [DIFUpdateKind.ListSplice, start, deleteCount, items];
}
