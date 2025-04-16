import { SerialJSInterface } from "../src/datex-core.ts";
import { Datex } from "../src/mod.ts";

// @ts-ignore global variable for debugging
globalThis.Datex = Datex;

document.getElementById("serial")!.addEventListener("click", async () => {
    const serial = await SerialJSInterface.open(115200);
    console.log(serial);
});
