import {
    CoreTypeAddress,
    type DIFRepresentationValue,
    type DIFTypeContainer,
    type DIFValueContainer,
} from "./definitions.ts";

export function difValueContainerToDisplayString(
    difValue: DIFValueContainer,
): string {
    if (typeof difValue === "string") {
        return addressToDisplayString(difValue);
    } else {
        const typeString = difValue.type
            ? difTypeContainerToDisplayString(difValue.type)
            : null;
        const valueString = difRepresentationValueToDisplayString(
            difValue.value,
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
    const found = Object.entries(CoreTypeAddress).find(([name, addr]) => {
        return addr === address;
    });
    if (found) {
        return found[0];
    } else {
        return "$" + address;
    }
}
