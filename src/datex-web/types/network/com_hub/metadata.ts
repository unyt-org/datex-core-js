// @generated file -- do not edit
// deno-lint-ignore-file
// deno-fmt-ignore-file

import type { Endpoint } from "../../../../lib/mod.ts";
import type { ComInterfaceProperties, InterfaceDirection } from "../com_interfaces/com_interface/properties.ts";
import type { DynamicEndpointProperties } from "./managers/socket_manager.ts";

export type ComHubMetadata = {
    endpoint: Endpoint;
    interfaces: ComHubMetadataInterface[];
};

export type ComHubMetadataInterface = {
    uuid: string;
    properties: ComInterfaceProperties;
    sockets: ComHubMetadataInterfaceSocket[];
    is_waiting_for_socket_connections: boolean;
};

export type ComHubMetadataInterfaceSocket = {
    uuid: string;
    direction: InterfaceDirection;
    endpoint: null | Endpoint;
    properties: null | DynamicEndpointProperties;
};