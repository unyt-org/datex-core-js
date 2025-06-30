import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
Deno.test("execute", () => {
    const runtime = new Runtime("@jonas");
    const script = "1 + 2";
    const result = runtime.execute(script, true);
    assertEquals(result, "3");
    console.log(result);
});
