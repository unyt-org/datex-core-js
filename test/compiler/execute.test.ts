import { Runtime } from "../../src/runtime/runtime.ts";

Deno.test("execute", async () => {
    const runtime = new Runtime("@jonas");
    const script = "1 + 2";
    const result = runtime.execute(script, true);
    console.log(result);
});
