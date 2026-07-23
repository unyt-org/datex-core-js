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

export function clear(path: DIFProperty[] = []): DIFUpdateData {
    return [path, DIFUpdateKind.Clear];
}
export function replace(value: DIFValueContainer, path: DIFProperty[] = []): DIFUpdateData {
    return [path, DIFUpdateKind.Replace, value];
}
export function appendEntry(value: DIFValueContainer, path: DIFProperty[] = []): DIFUpdateData {
    return [path, DIFUpdateKind.AppendEntry, value];
}
export function setEntry(
    key: DIFProperty,
    value: DIFValueContainer,
    path: DIFProperty[] = []
): DIFUpdateData {
    return [path, DIFUpdateKind.SetEntry, key, value];
}
export function deleteEntry(
    key: DIFProperty,
    path: DIFProperty[] = []
): DIFUpdateData {
    return [path, DIFUpdateKind.DeleteEntry, key];
}
export function listSplice(
    start: number,
    deleteCount: number,
    items: DIFValueContainer[],
    path: DIFProperty[] = []
): DIFUpdateData {
    return [path, DIFUpdateKind.ListSplice, start, deleteCount, items];
}
