import { sleep } from "../utils.ts";
import { Runtime } from "../../src/runtime/runtime.ts";

Deno.test("update loop", async () => {
    const runtime = await Runtime.create({ endpoint: "@unyt" });
    // TODO
    await sleep(1000);
    await runtime._stop();
});
