// @generated file -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

import type { Endpoint } from "../../../lib/mod.ts";
import type { InterfacePriority } from "../network/com_hub/mod.ts";

export type RuntimeConfig = {
    endpoint: Endpoint;
    interfaces: null | unknown[];
    env: null | Map<unknown, unknown>;
};

/**
 * A generic interface configuration to setup a runtime interface.
 */
export type RuntimeConfigInterface = {
    type: string;
    config: unknown;
    priority: InterfacePriority;
};