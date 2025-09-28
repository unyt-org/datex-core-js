import { DIF_Replace } from "../dif/builders.ts";
import type { DIFHandler } from "../dif/dif-handler.ts";

/**
 * The Ref class is a wrapper around a value that is stored in a pointer.
 * Primitive values (string, number, boolean, null) are always wrapped in a Ref when stored in a pointer.
 */
export class Ref<T> {
    #value: T;
    #pointerAddress: string;
    #difHandler: DIFHandler;

    constructor(value: T, pointerAddress: string, difHandler: DIFHandler) {
        this.#value = value;
        this.#pointerAddress = pointerAddress;
        this.#difHandler = difHandler;
    }

    get pointerAddress(): string {
        return this.#pointerAddress;
    }

    /**
     * Gets the current value of the reference.
     */
    get value(): T {
        return this.#value;
    }

    /**
     * Replaces the current value of the reference with a new value.
     * Also notifies all observers of the pointer about the change.
     * @throws If the reference is immutable or the new value is of an incompatible type.
     */
    set value(newValue: T) {
        this.#value = newValue;
        this.#difHandler.updatePointer(
            this.#pointerAddress,
            DIF_Replace(this.#difHandler, newValue),
        );
    }
}
