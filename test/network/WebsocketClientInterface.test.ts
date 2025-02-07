import { WebsocketClientInterface } from "../../src/network/com-interfaces/WebsocketClientInterface.ts";
import { assertThrows } from "jsr:@std/assert/throws";
import { assert, assertEquals } from 'jsr:@std/assert';

Deno.test("websocket fail test", () => {
	assertThrows(() => new WebsocketClientInterface("unknown://localhost:8080"), Error, "Invalid URL scheme");
});
Deno.test("websocket construct default", () => {
	const websocketClient = new WebsocketClientInterface("localhost:8080");
	assertEquals(websocketClient.url, "wss://localhost:8080/");
});
Deno.test("websocket construct via http", () => {
	const websocketClient = new WebsocketClientInterface("http://localhost:8080");
	assertEquals(websocketClient.url, "ws://localhost:8080/");
});
Deno.test("websocket construct via https", () => {
	const websocketClient = new WebsocketClientInterface("https://localhost:8080");
	assertEquals(websocketClient.url, "wss://localhost:8080/");
});
Deno.test("websocket construct via ws", () => {
	const websocketClient = new WebsocketClientInterface("ws://localhost:8080");
	assertEquals(websocketClient.url, "ws://localhost:8080/");
});
// Deno.test("websocket connect", async () => {
// 	const websocketClient = new WebsocketClientInterface("ws://localhost:8080");
// 	assert(await websocketClient.connect(), "Connection failed");
// });