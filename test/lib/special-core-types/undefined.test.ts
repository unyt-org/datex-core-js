import { Runtime } from "datex-core-js/runtime/runtime.ts";
import { assertEquals } from "@std/assert";
import { DIFTypeKind, type DIFValue } from "datex-core-js/dif/definitions.ts";
import { JsLibTypeAddress } from "datex-core-js/dif/js-lib.ts";
import { CoreTypeAddress } from "datex-core-js/dif/core.ts";

const runtime = new Runtime({ endpoint: "@jonas" });

Deno.test("undefined", () => {
    // convert JS undefined to DIF representation
    const undefinedDifValue = runtime.dif.convertJSValueToDIFValueContainer(
        undefined,
    ) as DIFValue;
    // TODO: add more compact dif representation DIFTypeKind.MarkedType(CoreTypeAddress.null, JsLibTypeAddress.undefined)
    assertEquals(
        undefinedDifValue.type,
        {
            def: [
                CoreTypeAddress.null,
                {
                    kind: DIFTypeKind.Marker,
                    def: JsLibTypeAddress.undefined,
                },
            ],
            kind: DIFTypeKind.Intersection,
        },
    );

    // pass undefined to runtime and return value
    const executionResult = runtime._runtime.execute_sync("?", [
        undefinedDifValue,
    ]) as DIFValue;
    // assertEquals(executionResult.value, null);
    console.log(executionResult);
});
