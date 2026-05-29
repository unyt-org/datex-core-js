import type { BaseSharedContainer, SharedContainerMutability } from "./base-shared-container.ts";

export enum SharedReferenceMutability {
    Immutable = 0,
    Mutable = 1,
}
export class ReferencedSharedContainer<
    T,
    Mutability extends SharedContainerMutability,
    ReferenceMutability extends SharedReferenceMutability,
> {
    #baseSharedContainer: BaseSharedContainer<T, Mutability>;
    #referenceMutability: ReferenceMutability;

    public constructor(
        baseSharedContainer: BaseSharedContainer<T, Mutability>,
        referenceMutability: ReferenceMutability,
    ) {
        this.#baseSharedContainer = baseSharedContainer;
        this.#referenceMutability = referenceMutability;
    }

    get value(): T {
        return this.#baseSharedContainer.value;
    }

    set value(newValue: T) {
        this.#baseSharedContainer.value = newValue;
    }

    public isMutable(): boolean {
        return this.#referenceMutability === SharedReferenceMutability.Mutable;
    }

    /**
     * Derives an immutable reference from the current reference. The derived reference will have the same underlying shared container,
     * @returns A new ReferencedSharedContainer instance with immutable reference mutability.
     */
    public deriveImmutableReference(): ReferencedSharedContainer<
        T,
        Mutability,
        typeof SharedReferenceMutability.Immutable
    > {
        return new ReferencedSharedContainer<T, Mutability, typeof SharedReferenceMutability.Immutable>(
            this.#baseSharedContainer,
            SharedReferenceMutability.Immutable,
        );
    }
}

// export function deriveImmutableReference<
//     T,
//     Mutability extends SharedContainerMutability,
// >(
//     reference: SharedReferenced<T, Mutability, SharedReferenceMutability>,
// ): SharedReferenced<T, Mutability, SharedReferenceMutability.Immutable> {
//     return reference as SharedReferenced<T, Mutability, SharedReferenceMutability.Immutable>;
// }
