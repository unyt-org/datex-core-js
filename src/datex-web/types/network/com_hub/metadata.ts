// @generated file -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

import type { Endpoint } from "../../../../lib/mod.ts";
import type { ComInterfaceProperties } from "../com_interfaces/com_interface/properties.ts";

export type ComHubMetadata = {
    endpoint: Endpoint;
    interfaces: unknown[];
};

export type ComHubMetadataInterface = {
    uuid: string;
    properties: ComInterfaceProperties;
    sockets: unknown;
    is_waiting_for_socket_connections: boolean;
};