/**
 * Sleeps for the given number of milliseconds.
 * @param ms Number of milliseconds to sleep
 * @returns A promise that resolves after the specified time
 */
export function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Waits for the next event loop tick.
 * @returns A promise that resolves on the next event loop tick
 */
export function nextTick() {
    return sleep(0);
}
