import { assertEquals } from "jsr:@std/assert";
import { Runtime } from "../src/runtime/runtime.ts";

Deno.test("runtime initialization", () => {
	const runtime = new Runtime();
	assertEquals(runtime.JS_VERSION, "1.0");
	assertEquals(runtime.VERSION, "1.0");
});