import { ReferencedSharedContainer, SharedReferenceMutability } from "./reference.ts";
import type { BaseSharedContainer, SharedContainerMutability } from "./base-shared-container.ts";

export class OwnedSharedContainer<T, Mutability extends SharedContainerMutability> {
    #baseSharedContainer: BaseSharedContainer<T, Mutability>;

    public constructor(baseSharedContainer: BaseSharedContainer<T, Mutability>) {
        this.#baseSharedContainer = baseSharedContainer;
    }

    /**
     * Derives a new mutable reference from the current reference if the current reference is mutable.
     * Otherwise returns an error
     * @returns A new mutable reference derived from the current reference if the current reference is mutable, otherwise throws an error.
     */
    public deriveMutableReference(): Mutability extends typeof SharedReferenceMutability.Mutable
        ? ReferencedSharedContainer<
            T,
            Mutability,
            typeof SharedReferenceMutability.Mutable
        >
        : never {
        if (this.#baseSharedContainer.isContainerMutable()) {
            return new ReferencedSharedContainer<
                T,
                Mutability,
                typeof SharedReferenceMutability.Mutable
            >(
                this.#baseSharedContainer,
                SharedReferenceMutability.Mutable,
                // deno-lint-ignore no-explicit-any
            ) as any;
        } else {
            throw new Error("Cannot derive a mutable reference from an immutable reference.");
        }
    }

    /**
     * Derives a new immutable reference from the current reference. The derived reference will have the same underlying shared container,
     * @returns A new ReferencedSharedContainer instance with immutable reference mutability.
     */
    public deriveImmutableReference(): ReferencedSharedContainer<
        T,
        Mutability,
        typeof SharedReferenceMutability.Immutable
    > {
        return new ReferencedSharedContainer<
            T,
            Mutability,
            typeof SharedReferenceMutability.Immutable
        >(this.#baseSharedContainer, SharedReferenceMutability.Immutable);
    }
}
