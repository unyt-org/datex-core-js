import type { JSComHub } from "../datex-core/datex_core_js.d.ts";
import { ComInterface, type ComInterfaceImpl } from "./com-interface.ts";

export class ComHub {
    static #interfaceImpls = new Map<
        string,
        typeof ComInterfaceImpl<unknown>
    >();
    static #interfaceImplsByClass = new Map<
        typeof ComInterfaceImpl<unknown>,
        string
    >();

    readonly #jsComHub: JSComHub;

    constructor(jsComHub: JSComHub) {
        this.#jsComHub = jsComHub;
    }

    static registerInterfaceImpl<N extends string>(
        interfaceType: N,
        impl: typeof ComInterfaceImpl<unknown>,
    ) {
        if (this.#interfaceImpls.has(interfaceType)) {
            throw new Error(
                `Interface implementation for ${interfaceType} already registered.`,
            );
        }
        this.#interfaceImpls.set(interfaceType, impl);
        this.#interfaceImplsByClass.set(impl, interfaceType);
    }

    async createInterface<T extends typeof ComInterfaceImpl<unknown>>(
        interfaceType: T,
        setupData: T extends typeof ComInterfaceImpl<infer P> ? P : never,
    ): Promise<ComInterface<InstanceType<T>>>;
    async createInterface<
        T extends ComInterfaceImpl<unknown>,
    >(
        interfaceType: string,
        setupData: T extends ComInterfaceImpl<infer P> ? P : never,
    ): Promise<ComInterface<T>>;
    async createInterface(
        interfaceType: string | typeof ComInterfaceImpl,
        setupData: unknown,
    ): Promise<ComInterface<ComInterfaceImpl<unknown>>> {
        const type = typeof interfaceType === "string"
            ? interfaceType
            : ComHub.#interfaceImplsByClass.get(interfaceType);
        if (type === undefined) {
            throw new Error(
                `Interface implementation for ${
                    (interfaceType as typeof ComInterfaceImpl).name
                } not registered.`,
            );
        }
        const implClass = ComHub.#interfaceImpls.get(type);
        if (implClass === undefined) {
            throw new Error(
                `Interface implementation for ${type} not registered.`,
            );
        }
        const uuid = await this.#jsComHub.create_interface(
            type,
            JSON.stringify(setupData),
        );
        const impl = new (implClass as (new (
            uuid: string,
            setupData: unknown,
            comHub: JSComHub,
        ) => ComInterfaceImpl<unknown>))(uuid, setupData, this.#jsComHub);
        await impl.init?.();
        return new ComInterface(uuid, impl, this.#jsComHub);
    }

    public _update(): Promise<void> {
        return this.#jsComHub.update();
    }

    public _drain_incoming_blocks(): Uint8Array<ArrayBufferLike>[] {
        return this.#jsComHub._drain_incoming_blocks();
    }
}
