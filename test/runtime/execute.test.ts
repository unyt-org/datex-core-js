import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
Deno.test("execute sync", () => {
    const runtime = new Runtime("@jonas");
    const script = "1 + 2";
    const result = runtime.execute_sync(script, false);
    assertEquals(result, "3");
    console.log(result);
});

Deno.test("execute", async () => {
    const runtime = new Runtime("@jonas");
    const script = "1 + 2";
    const result = await runtime.execute(script, false);
    assertEquals(result, "3");
    console.log(result);
});

Deno.test("execute remote ", async () => {
    const runtime = new Runtime("@jonas");
    const script = "1 + 2";
    const result = await runtime.execute(script, false);
    assertEquals(result, "3");
    console.log(result);
});
