import { Runtime } from "../src/runtime/runtime.ts";

Deno.test("crypto", async () => {
    const runtime = new Runtime("@jonas");
    console.log(
        await runtime._runtime.crypto_test_tmp(),
    );
    // .then(console.log)
    // .catch(console.error);
});
