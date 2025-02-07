export class WebsocketHandler {
    public static init(websocket: WebSocket) {
        return new WebsocketHandler(websocket).#init();
    }

    public get isConnected() {
        return this.#isConnected;
    }

    private constructor(readonly websocket: WebSocket) {
        this.onConnect = this.onConnect.bind(this);
        this.onDisconnect = this.onDisconnect.bind(this);
        this.onError = this.onError.bind(this);
    }
    #isConnected = false;
    private initalResolve = Promise.withResolvers<void>();

    public disconnect() {
        this.onDisconnect();
        try {
            this.websocket.close();
        } catch { /*ignore*/ }
    }

    private onConnect() {
        this.#isConnected = true;
        this.initalResolve.resolve();
    }

    private onDisconnect() {
        this.#isConnected = false;
        this.websocket.removeEventListener("open", this.onConnect);
        this.websocket.removeEventListener("error", this.onError);
        this.websocket.removeEventListener("close", this.onDisconnect);
        this.initalResolve.resolve();
    }

    private onError() {
        this.#isConnected = false;
        // don't trigger any further errorHandlers
        this.websocket.removeEventListener("close", this.onDisconnect);
        this.websocket.removeEventListener("error", this.onError);
        if (this.websocket.readyState !== WebSocket.CLOSED) {
            // make sure the socket is closed
            try {
                this.websocket.close();
            } catch { /*ignore*/ }
        }
        if (!this.#isConnected) {
            this.initalResolve.resolve();
        } else this.onDisconnect();
    }

    async #init(): Promise<WebsocketHandler> {
        this.websocket.binaryType = "arraybuffer";
        // webSocket already open, call openHandler immediately
        if (this.websocket.readyState === WebSocket.OPEN) {
            this.onConnect();
        }

        this.websocket.addEventListener("open", this.onConnect);
        this.websocket.addEventListener("error", this.onError);
        this.websocket.addEventListener("close", this.onDisconnect);
        await this.initalResolve.promise;
        return this;
    }
}
