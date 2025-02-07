import {
    JSWebSocketClientInterface,
} from "../../datex-core.ts";
import { WebsocketHandler } from "./WebsocketHandler.ts";

export class WebsocketClientInterface {
	#interface: JSWebSocketClientInterface;
	#websocket?: WebsocketHandler;

	constructor(url: string);
	constructor(url: URL);
	constructor(url: URL | string) {
		this.#interface = new JSWebSocketClientInterface(url.toString());
	}

	public get url(): string {
		return this.#interface.url;
	}

	public async connect() {
		if (this.#websocket)
			throw new Error("Already constructed");
		this.#websocket = await WebsocketHandler.init(new WebSocket(this.#interface.url));
		return this.#websocket.isConnected;
	}
	
	#send(data: ArrayBuffer): void {
		// this.#interface.send_block(data);
	}
	#receive(data: ArrayBuffer): void {
		// this.#interface.setReceive(this);
	}
}