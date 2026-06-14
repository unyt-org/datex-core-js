// @generated file -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

import type { Tagged } from "../../../lib/mod.ts";

export type FormattingOptions = {
    mode: unknown;
    json_compat: boolean;
    colorized: boolean;
    add_variant_suffix: boolean;
};

export type IndentType = Tagged<"Spaces"> | Tagged<"Tabs">;

export type DecompileOptions = {
    formatting_options: FormattingOptions;
    resolve_slots: boolean;
};