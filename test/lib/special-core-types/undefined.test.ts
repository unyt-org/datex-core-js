import { Runtime } from "datex/runtime/runtime.ts";
import { assertEquals } from "@std/assert";
import type { DIFValue } from "datex/dif/types/value.ts";
import { Endpoint } from "datex/lib/mod.ts";
import { JS_UNDEFINED } from "datex/lib/special-core-types/undefined.ts";

const runtime = await Runtime.create({ endpoint: Endpoint.get("@jonas") });

Deno.test("undefined DIF representation", () => {
    const undefinedDifValue = runtime.dif.convertJSValueToDIFValueContainer(
        undefined,
    ) as DIFValue;

    assertEquals(
        undefinedDifValue,
        JS_UNDEFINED,
    );
});

Deno.test("undefined execution", () => {
    const executionResult = runtime.executeSync<undefined>("?", [undefined]);
    assertEquals(executionResult, undefined);
});
