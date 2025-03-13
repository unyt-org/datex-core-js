import { Runtime } from "../src/runtime/runtime.ts";

Deno.test("crypto", async () => {
    const runtime = new Runtime();
    console.log(runtime._runtime.test);
    await runtime._runtime.test();
});
