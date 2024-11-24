import { assertEquals } from "jsr:@std/assert";
import { Runtime } from "../src/runtime/runtime.ts";

Deno.test("runtime initialization", () => {
	const runtime = new Runtime();
	assertEquals(runtime.js_version, "0.0.1");
	assertEquals(runtime.version, "0.0.1");
	console.log(runtime)
});