import {
    CoreTypeAddress,
    type DIFReference,
    DIFReferenceMutability,
    type DIFRepresentationValue,
    type DIFTypeContainer,
    type DIFValueContainer,
} from "./definitions.ts";

export function mutabilityToDisplayString(mut: DIFReferenceMutability): string {
    if (mut === DIFReferenceMutability.Mutable) {
        return "&mut ";
    } else if (mut === DIFReferenceMutability.Immutable) {
        return "&";
    }
    throw new Error("Unknown mutability: " + mut);
}

export function difReferenceToDisplayString(
    reference: DIFReference,
): string {
    const typeString = difTypeContainerToDisplayString(reference.allowed_type);
    const valueString = difValueContainerToDisplayString(reference.value);
    const mutString = mutabilityToDisplayString(reference.mut);
    return `${mutString}${valueString} (allowed: ${typeString})`;
}

export function difValueContainerToDisplayString(
    container: DIFValueContainer,
): string {
    if (typeof container === "string") {
        return addressToDisplayString(container);
    } else {
        const typeString = container.type
            ? difTypeContainerToDisplayString(container.type)
            : null;
        const valueString = difRepresentationValueToDisplayString(
            container.value,
        );
        if (typeString) {
            return `{ type: ${typeString}, value: ${valueString} }`;
        } else {
            return valueString;
        }
    }
}

export function difRepresentationValueToDisplayString(
    difRepValue: DIFRepresentationValue,
): string {
    if (Array.isArray(difRepValue)) {
        return `[${
            difRepValue.map((v) => {
                if (Array.isArray(v)) {
                    return `[${
                        v.map((vv) => difValueContainerToDisplayString(vv))
                            .join(", ")
                    }]`;
                } else {
                    return difValueContainerToDisplayString(v);
                }
            }).join(
                ", ",
            )
        }]`;
    } else if (difRepValue && typeof difRepValue === "object") {
        return `{ ${
            Object.entries(difRepValue).map(([k, v]) =>
                `${k}: ${difValueContainerToDisplayString(v)}`
            ).join(", ")
        } }`;
    } else {
        return JSON.stringify(difRepValue);
    }
}

export function difTypeContainerToDisplayString(
    difType: DIFTypeContainer,
): string {
    if (typeof difType === "string") {
        return addressToDisplayString(difType);
    } else {
        return `{ name: ${difType.name}, kind: ${difType.kind}, def: ${
            JSON.stringify(difType.def)
        }, mut: ${difType.mut} }`;
    }
}

export function addressToDisplayString(address: string): string {
    const found = Object.entries(CoreTypeAddress).find(([_, addr]) => {
        return addr === address;
    });
    if (found) {
        return found[0];
    } else {
        return "$" + address;
    }
}
