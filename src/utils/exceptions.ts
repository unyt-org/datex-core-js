export function panic(message: string): never {
    throw new Error(`Panic: ${message}`);
}

export function unreachable(message: string): never {
    throw new Error(`Unreachable code reached: ${message}`);
}

export function unimplemented(message: string): never {
    throw new Error(`Not implemented: ${message}`);
}
