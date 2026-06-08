export const EMPTY_TAG = Symbol("EMPTY_TAG");

/**
 * A simple wrapper type that allows to associate a string tag with a value.
 */
export class Tagged<Tag extends string, const Value = typeof EMPTY_TAG> {
    #tag: Tag;
    #value: Value;

    constructor(
        tag: Tag,
        value: Value = EMPTY_TAG as Value,
    ) {
        this.#tag = tag;
        this.#value = value;
    }

    public get value(): Value {
        return this.#value;
    }

    public set value(newValue: Value) {
        this.#value = newValue;
    }

    public get tag(): Tag {
        return this.#tag;
    }
}

/**
 * Creates a new Tagged instance with the given tag and value.
 */
export function tagged<Tag extends string, const Value = typeof EMPTY_TAG>(
    tag: Tag,
    value: Value = EMPTY_TAG as Value,
): Tagged<Tag, Value> {
    return new Tagged(tag, value);
}
