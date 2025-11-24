/**
 * This test suite is used to ensure that Datex.executeSync produces the exact same results as JSON.parse for the same inputs.
 */

/**
 * Test inputs that are used to verify JSON compatibility.
 */
const TEXT_INPUTS = [
    "42",
    "-10",
    "3.14",
    '"Hello, World!"',
    "true",
    "false",
    "null",
    "[1, 2, 3]",
    '{"a": 1, "b": "test"}',
    "[]",
    "{}",
];

import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "@std/assert";

const runtime = new Runtime({ endpoint: "@jonas" });

for (const input of TEXT_INPUTS) {
    Deno.test(`JSON compatibility test for input: ${input}`, () => {
        const resultFromRuntime = runtime.executeSync(input);
        const resultFromJSON = JSON.parse(input);
        assertEquals(resultFromRuntime, resultFromJSON);
    });
}
