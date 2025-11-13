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

    /**
     * Gets the address of the pointer storing the reference.
     */
    get pointerAddress(): string {
        return this.#pointerAddress;
    }

    /**
     * Silently updates the value of the reference without notifying observers.
     * This should only be used internally.
     * @param newValue - The new value to set.
     */
    updateValueSilently(newValue: T) {
        this.#value = newValue;
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
        const oldValue = this.#value;
        if (oldValue === newValue) return;

        // Try to update the pointer
        this.#difHandler.triggerReplace(this.#pointerAddress, newValue);
        this.#value = newValue;
    }
}
