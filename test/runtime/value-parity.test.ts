/**
 * This test suite is used as a verification that all JS values that are passed to
 * the DATEX runtime come out as the exact same values after execution.
 * This is a test for the full integration of the JS runtime with the DATEX runtime.
 * NOTE: as more JS values are supported, this test should be extended to cover all of them.
 */
import { Endpoint } from "datex/lib/special-core-types/endpoint.ts";
import { Runtime } from "datex/runtime/runtime.ts";
import { Range } from "datex/lib/special-core-types/range.ts";
import { assertEquals } from "@std/assert";

/**
 * Test values that are used to verify the value parity.
 * These values should cover all basic JS types and some complex types.
 * If you add new types, make sure to also add them to the `TEST_VALUES`
 * array below.
 */
const TEST_VALUES = [
    // simple JSON values
    42,
    -10,
    3.14,
    "Hello, World!",
    true,
    false,
    null,
    0,
    // arrays and objects
    [1, 2, 3],
    [],
    { a: 1, b: "test" },
    {},
    // non-JSON values
    // TODO: map type gets lost during DATEX execution, special JS map marker type needed here
    // new Map([["key", "value"]]),
    // new Map(),
    new Map([[1, 2]]),
    undefined,
    NaN,
    Infinity,
    -Infinity,
    2000n,
    Endpoint.get("@test"),
    new Range(1, 2),
] as const;

Deno.test(`test value parity for various JS values`, async (t) => {
    for (const value of TEST_VALUES) {
        const runtime = await Runtime.create({
            endpoint: Endpoint.get("@jonas"),
        });
        const valueType = value === null
            ? "null"
            : typeof value === "undefined"
            ? "undefined"
            : value?.constructor.name;
        await t.step(`Testing value: ${valueType}`, () => {
            const result = runtime.executeSync<typeof value>(
                "?",
                [value],
            );
            assertEquals(result, value);
        });
    }
});
