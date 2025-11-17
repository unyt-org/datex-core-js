import {
    type DIFTypeContainer,
    type DIFUpdateData,
    DIFUpdateKind,
} from "./definitions.ts";
import type { DIFHandler, ReferenceMetadata } from "./dif-handler.ts";

export const ORIGINAL_VALUE = Symbol("ORIGINAL_VALUE");

type ImplMethod = {
    name: string;
    implementation: Function;
};

type OwnImpl = {
    methods: ImplMethod[];
};

type InterfaceImpl = {
    interfaceName: string;
    methods: ImplMethod[];
};

export type TypeDefinition = {
    name: string;
    structuralDefinition: DIFTypeContainer; // TODO: generic definition
    ownImpls?: OwnImpl[]; // e.g. impl CustomMapMap
    interfaceImpls: InterfaceImpl[]; // e.g. impl GetProperty for CustomMap
};

export type TypeBindingContext<M extends ReferenceMetadata> = {
    readonly difHandler: DIFHandler;
    getReferenceMetadata<T extends WeakKey>(
        value: T,
    ): M;
};

export type BindResult<T, M extends ReferenceMetadata> = {
    value: T;
    metadata: M;
};

export type TypeBindingDefinition<
    T,
    M extends ReferenceMetadata = ReferenceMetadata,
> = {
    typeAddress: string;
    bind(
        this: TypeBindingContext<M>,
        value: T,
        pointerAddress: string,
    ): BindResult<T, M>;
    handleSet?(
        this: TypeBindingContext<M>,
        target: T,
        key: unknown,
        value: unknown,
    ): void;
    handleAppend?(this: TypeBindingContext<M>, target: T, value: unknown): void;
    handleReplace?(
        this: TypeBindingContext<M>,
        parent: T,
        newValue: unknown,
    ): void;
    handleDelete?(this: TypeBindingContext<M>, target: T, key: unknown): void;
    handleClear?(this: TypeBindingContext<M>, target: T): void;
};

// interface GetProperty<K,V> = {
//     function getProperty<K>(self: Type, key: K) -> X;
// }

// type = {x: fn()->y),}
// impl Type {
//     fn autoSelectFamily() -> Family {
// }

// impl Type {
//     fn autoSelectFamily(self) -> Family {

//     }
// }

// Type.self(x);
// x->autoSelectFamily();
// MyTrait.autoSelectFamily(x);
// Type.autoSelectFamily(x);
// object->contains()
// obj.hasOwnPropety()

export class TypeRegistry {
    #difHandler: DIFHandler;
    #typeBindings: Map<string, TypeBinding<unknown>> = new Map();

    constructor(difHandler: DIFHandler) {
        this.#difHandler = difHandler;
    }

    /**
     * Defines a completely new nominal type with optional implementations that can be bound to JS native functions.
     * @param definition
     */
    public registerTypeDefinition(definition: TypeDefinition) {
        // TODO
    }

    /**
     * Binds an existing nominal type to a JS mirror implementation.
     * @param typePointerAddress The address of the type pointer in the Datex runtime.
     */
    public registerTypeBinding<T>(
        typeBindingDefinition: TypeBindingDefinition<T>,
    ) {
        this.#typeBindings.set(
            typeBindingDefinition.typeAddress,
            new TypeBinding(
                typeBindingDefinition as TypeBindingDefinition<
                    unknown,
                    ReferenceMetadata
                >,
                this.#difHandler,
            ),
        );
    }

    /**
     * Gets the type binding for a given type pointer address.
     */
    public getTypeBinding(
        typePointerAddress: string,
    ): TypeBinding<unknown> | null {
        const typeBinding = this.#typeBindings.get(typePointerAddress);
        if (typeBinding) {
            return typeBinding;
        } else {
            return null;
        }
    }
}

export class TypeBinding<T, M extends ReferenceMetadata = ReferenceMetadata> {
    #difHandler: DIFHandler;
    #definition: TypeBindingDefinition<T, M>;

    get difHandler() {
        return this.#difHandler;
    }

    public getReferenceMetadata<T extends WeakKey>(value: T): M {
        return this.#difHandler.getReferenceMetadata<M, T>(value);
    }

    constructor(
        definition: TypeBindingDefinition<T, M>,
        difHandler: DIFHandler,
    ) {
        this.#definition = definition;
        this.#difHandler = difHandler;
    }

    /**
     * Binds a new JS value to this type binding.
     * @returns
     */
    public bindValue(value: T, pointerAddress: string): BindResult<T, M> {
        const newValue = this.#definition.bind.call(
            this,
            value,
            pointerAddress,
        );
        return newValue;
    }

    /**
     * Sets up observers for the given value and pointer address if there are update handlers defined for this type binding.
     */
    public handleDifUpdate(
        value: T,
        pointerAddress: string,
        difUpdateData: DIFUpdateData,
    ): void {
        const updateHandlerTypes = this.getUpdateHandlerTypes();
        // add observer if there are update handlers
        if (updateHandlerTypes.size > 0) {
            console.log(
                "got update for pointer:",
                pointerAddress,
                difUpdateData,
            );
            // call appropriate handler based on update kind
            if (
                difUpdateData.kind === DIFUpdateKind.Set &&
                this.#definition.handleSet
            ) {
                this.#definition.handleSet.call(
                    this,
                    value,
                    this.#difHandler.resolveDIFPropertySync(
                        difUpdateData.key,
                    ),
                    this.#difHandler.resolveDIFValueContainerSync(
                        difUpdateData.value,
                    ),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Append &&
                this.#definition.handleAppend
            ) {
                this.#definition.handleAppend.call(
                    this,
                    value,
                    this.#difHandler.resolveDIFValueContainerSync(
                        difUpdateData.value,
                    ),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Replace &&
                this.#definition.handleReplace
            ) {
                this.#definition.handleReplace.call(
                    this,
                    value,
                    this.#difHandler.resolveDIFValueContainerSync(
                        difUpdateData.value,
                    ),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Delete &&
                this.#definition.handleDelete
            ) {
                this.#definition.handleDelete.call(
                    this,
                    value,
                    this.#difHandler.resolveDIFPropertySync(difUpdateData.key),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Clear &&
                this.#definition.handleClear
            ) {
                this.#definition.handleClear.call(this, value);
            }
        }
    }

    public getUpdateHandlerTypes(): Set<DIFUpdateKind> {
        const updateHandlerTypes = new Set<DIFUpdateKind>();
        if (this.#definition.handleSet) {
            updateHandlerTypes.add(DIFUpdateKind.Set);
        }
        if (this.#definition.handleAppend) {
            updateHandlerTypes.add(DIFUpdateKind.Append);
        }
        if (this.#definition.handleReplace) {
            updateHandlerTypes.add(DIFUpdateKind.Replace);
        }
        if (this.#definition.handleDelete) {
            updateHandlerTypes.add(DIFUpdateKind.Delete);
        }
        if (this.#definition.handleClear) {
            updateHandlerTypes.add(DIFUpdateKind.Clear);
        }
        return updateHandlerTypes;
    }
}
