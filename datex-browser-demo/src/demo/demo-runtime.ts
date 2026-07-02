import { Builtins, Repl, Runtime, Shared } from "datex";

export const runtime = await Runtime.create(
    {
        endpoint: Builtins.Endpoint.get("@web"),
        interfaces: [
            {
                priority: new Builtins.Tagged("None"),
                type: "websocket-client",
                config: {
                    url: "wss://example.unyt.land",
                },
            },
        ],
        env: {
            "example": "42",
        },
    },
    {
        log_level: "info",
    },
);

runtime.comHub.printMetadata();

// @ts-ignore global variable for debugging
globalThis.Datex = runtime;
// @ts-ignore global variable for debugging
globalThis.Ref = Shared.ReferencedSharedContainer;

// @ts-ignore global variable for debugging
globalThis.Range = Builtins.Range;

// @ts-ignore global variable for debugging
globalThis.Endpoint = Builtins.Endpoint;

// @ts-ignore global variable for debugging
globalThis.Repl = Repl;
