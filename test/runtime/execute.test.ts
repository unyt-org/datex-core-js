import { Runtime } from "../../src/runtime/runtime.ts";
import { assertEquals } from "jsr:@std/assert";
import {unescapeLeadingUnderscores} from "npm:typescript@5.8.3";
Deno.test("execute sync with string result", () => {
    const runtime = new Runtime({ endpoint: "@jonas" });
    const script = "1 + 2";
    const result = runtime.execute_sync_with_string_result(script, false);
    assertEquals(result, "3");
    console.log(result);
});

Deno.test("execute sync", () => {
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
