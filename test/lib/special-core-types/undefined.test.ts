import { Runtime } from "datex-core-js/runtime/runtime.ts";
import { assertEquals } from "@std/assert";
import { DIFTypeKind, type DIFValue } from "datex-core-js/dif/definitions.ts";
import { JsLibTypeAddress } from "datex-core-js/dif/js-lib.ts";
import { CoreTypeAddress } from "datex-core-js/dif/core.ts";

const runtime = new Runtime({ endpoint: "@jonas", debug: true });

Deno.test("undefined", () => {
    // convert JS undefined to DIF representation
    const undefinedDifValue = runtime.dif.convertJSValueToDIFValueContainer(
        undefined,
    ) as DIFValue;
    assertEquals(
        undefinedDifValue.type,
        {
            def: [
                CoreTypeAddress.null,
                [JsLibTypeAddress.undefined],
            ],
            kind: DIFTypeKind.MarkedType,
        },
    );

    // pass undefined to runtime and return value
    const executionResult = runtime._runtime.execute_sync("?", [
        undefinedDifValue,
    ]) as DIFValue;
    assertEquals(executionResult, {
        value: null,
        type: undefinedDifValue.type,
    });
});
