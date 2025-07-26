import type {JSComHub} from "../datex-core/datex_core_js.d.ts";

export abstract class ComInterfaceImpl<SetupData> {
    protected readonly uuid!: string;
    protected readonly setupData!: SetupData
    protected readonly jsComHub!: JSComHub;

    constructor(uuid: string, setupData: SetupData, jsComHub: JSComHub) {
        this.uuid = uuid;
        this.setupData = setupData;
        this.jsComHub = jsComHub;
    }

    init?(): Promise<void>|void;
    cleanup?(): Promise<void>|void;
}
export class ComInterface<T extends ComInterfaceImpl<unknown>> {
    readonly uuid: string;
    readonly impl: T;
    readonly #jsComHub: JSComHub;

    constructor(uuid: string, impl: T, jsComHub: JSComHub) {
        this.uuid = uuid;
        this.impl = impl;
        this.#jsComHub = jsComHub;
    }

    public async close(): Promise<boolean> {
        await this.impl.cleanup?.();
        return this.#jsComHub.close_interface(this.uuid)
    }
}