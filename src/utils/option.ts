import { panic } from "./exceptions.ts";

enum OptionType {
    Some,
    None,
}

export class Option<T, Type extends OptionType = OptionType> {
    private readonly kind: Type;
    private readonly value?: T;

    constructor(kind: Type, value?: T) {
        this.kind = kind;
        if (kind === OptionType.Some) {
            this.value = value as T;
        }
    }

    static Some<T>(value: T): Option<T, OptionType.Some> {
        return new Option<T, OptionType.Some>(OptionType.Some, value);
    }

    static None<T>(): Option<T, OptionType.None> {
        return new Option<T, OptionType.None>(OptionType.None);
    }

    unwrap(): Type extends OptionType.Some ? T : never {
        if (this.kind === OptionType.Some) {
            return this.value as Type extends OptionType.Some ? T : never;
        } else {
            panic("Called unwrap on a None value");
        }
    }

    expect(message: string): T {
        if (this.kind === OptionType.Some) {
            return this.value as T;
        } else {
            panic(message);
        }
    }

    isSome(): this is Option<T, OptionType.Some> {
        return this.kind === OptionType.Some;
    }

    isNone(): this is Option<T, OptionType.None> {
        return this.kind === OptionType.None;
    }
}
