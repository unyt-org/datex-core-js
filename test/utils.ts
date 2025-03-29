export function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
export function nextTick() {
    return sleep(0);
}
