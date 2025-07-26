import { Datex } from "../../src/mod.ts";
import { sleep } from "../utils.ts";

Deno.test("update loop", async () => {
    await Datex.start();
    // TODO
    await sleep(1000);
    await Datex._stop();
});
