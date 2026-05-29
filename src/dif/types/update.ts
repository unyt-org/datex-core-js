/**
 * @module DIF Update Types
 * @description
 * This module contains all type definitions related to the representation of updates in DIF.
 */

import type { DIFValueContainer } from "./value.ts";

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
    AppendEntry: "append_entry",
    SetEntry: "set_entry",
    DeleteEntry: "delete_entry",
    Clear: "clear",
    ListSplice: "list_splice",
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
    & DIFUpdateBaseData<typeof DIFUpdateKind.AppendEntry>
    & {
        value: DIFValueContainer;
    };
export type DIFUpdateDataDelete =
    & DIFUpdateBaseData<typeof DIFUpdateKind.DeleteEntry>
    & {
        key: DIFProperty;
    };
export type DIFUpdateDataSet = DIFUpdateBaseData<typeof DIFUpdateKind.SetEntry> & {
    key: DIFProperty;
    value: DIFValueContainer;
};
export type DIFUpdateDataClear = DIFUpdateBaseData<typeof DIFUpdateKind.Clear>;
export type DIFUpdateDataListSplice =
    & DIFUpdateBaseData<typeof DIFUpdateKind.ListSplice>
    & {
        start: number;
        delete_count: number;
        items: DIFValueContainer[];
    };

export type DIFUpdateData =
    | DIFUpdateDataReplace
    | DIFUpdateDataPush
    | DIFUpdateDataDelete
    | DIFUpdateDataSet
    | DIFUpdateDataClear
    | DIFUpdateDataListSplice;

/** A DIF update struct, associating a source ID with update data. */
export type DIFUpdate = {
    source_id: number;
    data: DIFUpdateData;
};

/** Options for observing DIF pointers. */
export type ObserveOptions = {
    relay_own_updates: boolean;
};
