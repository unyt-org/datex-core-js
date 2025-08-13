import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import { Endpoint } from "../../src/runtime/special-core-types.ts";
Deno.test("execute sync with string result", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const script = "1 + 2";
    const result = runtime.execute_sync_with_string_result(script, false);
    assertEquals(result, "3");
    console.log(result);
});

Deno.test("execute sync dif value", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const script = "1 + 2";
    // NOTE: in an optimized version of DIF, we could also just return a plain number in this case.
    // For now, all DIF values are returned in the same format to reduce complexity.
    const result = runtime.execute_sync_dif(script);
    assertEquals(result, {
        core_type: "integer",
        ptr_id: undefined,
        type: "integer",
        value: 3,
    });
    console.log(result);
});

Deno.test("execute sync number", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<number>("1 + 2");
    assertEquals(result, 3);
});

Deno.test("execute sync string", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<string>("'lol'");
    assertEquals(result, "lol");
});

Deno.test("execute sync boolean", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<boolean>("true");
    assertEquals(result, true);
});

Deno.test("execute sync null", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<null>("null");
    assertEquals(result, null);
});

Deno.test("execute sync array", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<number[]>("[1, 2, 3]");
    assertEquals(result, [1, 2, 3]);
});

Deno.test("execute sync object", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<{ a: number; b: string }>(
        "{ a: 1, b: 'test' }",
    );
    assertEquals(result, { a: 1, b: "test" });
});

Deno.test("execute sync endpoint", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const result = runtime.execute_sync<Endpoint>("#endpoint");
    assertEquals(result, Endpoint.get("@jonas"));
});

Deno.test("execute with string result", async () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const script = "1 + 2";
    const result = await runtime.execute_with_string_result(script, false);
    assertEquals(result, "3");
    console.log(result);
});

Deno.test("execute remote with string result", async () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const script = "1 + 2";
    const result = await runtime.execute_with_string_result(script, false);
    assertEquals(result, "3");
    console.log(result);
});
