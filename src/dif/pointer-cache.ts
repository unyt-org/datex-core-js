export class PointerCache {
    readonly #cache = new Map<string, WeakRef<WeakKey>>();
}
