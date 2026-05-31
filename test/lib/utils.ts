import type { Runtime } from "datex/runtime/mod.ts";
import type { DIFTransceiverId, DIFUpdate, DIFUpdateData } from "datex/dif/types/update.ts";
import type { PointerAddress } from "datex/shared-container/mod.ts";

export function performFakeRemoteUpdate(runtime: Runtime, address: PointerAddress, data: DIFUpdateData) {
    return runtime.dif._handle.update(address, [42 as DIFTransceiverId, ...data] as DIFUpdate);
}
