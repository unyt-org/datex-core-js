import { Datex } from "../../src/mod.ts";
import { sleep } from "../utils.ts";

Deno.test("update loop", async () => {
    await Datex._runtime.start_update_loop();
    // TODO
    await sleep(1000);
    await Datex._runtime._stop_update_loop();
});
