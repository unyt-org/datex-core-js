import { Datex } from "../../src/mod.ts";
import { sleep } from "../utils.ts";

Deno.test("update loop", async () => {
    Datex.comHub.start_update_loop();
    // TODO
    await sleep(1000);
    Datex.comHub.stop_update_loop();
});
