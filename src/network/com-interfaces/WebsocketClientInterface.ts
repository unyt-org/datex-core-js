import { JSWebSocketClientInterface } from "../../datex-core.ts";

export class WebsocketClientInterface {
    #interface: JSWebSocketClientInterface;

    constructor(url: string);
    constructor(url: URL);
    constructor(url: URL | string) {
        this.#interface = new JSWebSocketClientInterface(url.toString());
    }

    public get url(): string {
        return this.#interface.url;
    }
}
