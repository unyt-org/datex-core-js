import {
    type DIFTypeContainer,
    type DIFUpdateData,
    DIFUpdateKind,
} from "./definitions.ts";
import type { DIFHandler } from "./dif-handler.ts";

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

export type TypeBindingDefinition<T, P = T> = {
    typeAddress: string;
    bind(value: T, pointerAddress: string, difHandler: DIFHandler): P;
    handleSet?(parent: P, key: unknown, value: unknown): void;
    handleAppend?(parent: P, value: unknown): void;
    handleReplace?(parent: P, newValue: unknown): void;
    handleDelete?(parent: P, key: unknown): void;
    handleClear?(parent: P): void;
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
                typeBindingDefinition as TypeBindingDefinition<unknown>,
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

export class TypeBinding<T> {
    #difHandler: DIFHandler;
    #definition: TypeBindingDefinition<T>;

    constructor(definition: TypeBindingDefinition<T>, difHandler: DIFHandler) {
        this.#definition = definition;
        this.#difHandler = difHandler;
    }

    /**
     * Binds a new JS value to this type binding.
     * @returns
     */
    public bindValue(value: T, pointerAddress: string): T {
        const newValue = this.#definition.bind(
            value,
            pointerAddress,
            this.#difHandler,
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
                this.#definition.handleSet(
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
                this.#definition.handleAppend(
                    value,
                    this.#difHandler.resolveDIFValueContainerSync(
                        difUpdateData.value,
                    ),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Replace &&
                this.#definition.handleReplace
            ) {
                this.#definition.handleReplace(
                    value,
                    this.#difHandler.resolveDIFValueContainerSync(
                        difUpdateData.value,
                    ),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Delete &&
                this.#definition.handleDelete
            ) {
                this.#definition.handleDelete(
                    value,
                    this.#difHandler.resolveDIFPropertySync(difUpdateData.key),
                );
            } else if (
                difUpdateData.kind === DIFUpdateKind.Clear &&
                this.#definition.handleClear
            ) {
                this.#definition.handleClear(value);
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
