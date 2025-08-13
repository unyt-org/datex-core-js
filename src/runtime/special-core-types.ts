export class Endpoint {
    readonly #endpoint: string;

    // map with weak values that keeps track of all currently instantiated endpoints
    static endpoints: Map<string, WeakRef<Endpoint>> = new Map();

    private constructor(endpoint: string) {
        this.#endpoint = endpoint;
        Endpoint.registerEndpoint(this);
    }

    public static registerEndpoint(endpoint: Endpoint) {
        // set as a weak reference in the static map
        const weakRef = new WeakRef(endpoint);
        Endpoint.endpoints.set(endpoint.toString(), weakRef);
        new FinalizationRegistry((key: string) => {
            Endpoint.endpoints.delete(key);
        }).register(endpoint, endpoint.toString());
    }

    public static get(endpoint: string): Endpoint {
        if (Endpoint.endpoints.has(endpoint)) {
            const weakRef = Endpoint.endpoints.get(endpoint);
            if (weakRef) {
                const existingEndpoint = weakRef.deref();
                if (existingEndpoint) {
                    return existingEndpoint;
                }
            }
        }
        return new Endpoint(endpoint);
    }

    public toString(): string {
        return this.#endpoint;
    }
}