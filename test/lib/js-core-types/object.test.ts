import { assertEquals } from "@std/assert/equals";
import { mapTypeBinding } from "datex/lib/js-core-types/map.ts";
import { Runtime } from "datex/runtime/runtime.ts";
import { Endpoint } from "datex/lib/mod.ts";
import { assert } from "@std/assert";

const runtime = await Runtime.create({ endpoint: Endpoint.get("@test") });
runtime.dif.type_registry.registerTypeBinding(mapTypeBinding);

Deno.test("JS object", () => {
    const obj = runtime.executeSync<Record<string, unknown>>("?", [
        { a: 1, b: "test" },
    ]);
    assert(obj !== null && typeof obj === "object", "Result should be an object");
    assertEquals(obj as Record<string, unknown>, { a: 1, b: "test" });
});

Deno.test("JS object with nested values", () => {
    const obj = runtime.executeSync<Record<string, unknown>>("?", [
        { a: 1, b: { c: 2, d: "nested" } },
    ]);
    assert(obj !== null && typeof obj === "object", "Result should be an object");
    assertEquals(obj as Record<string, unknown>, { a: 1, b: { c: 2, d: "nested" } });
});

Deno.test("JS empty object", () => {
    const obj = runtime.executeSync<Record<string, unknown>>("?", [{}]);
    assert(obj !== null && typeof obj === "object", "Result should be an object");
    assertEquals(obj as Record<string, unknown>, {});
});

Deno.test("object from datex", () => {
    const obj = runtime.executeSync<Record<string, unknown>>("{x: 2, y: 5}");
    assert(obj !== null && typeof obj === "object", "Result should be an object");
    assertEquals(obj as Record<string, unknown>, { x: 2, y: 5 });
});
