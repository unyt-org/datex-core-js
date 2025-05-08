import { Datex } from "../../src/mod.ts";
import { sleep } from "../utils.ts";

Deno.test("update loop", async () => {
    setTimeout(() => {
        throw new Error("Timeout");
    }, 5000);
    Datex.comHub.start_update_loop();

    await sleep(10000);
});
