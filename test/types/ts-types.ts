import { assertEquals } from "@std/assert/equals";
import { CoreLibTypeId } from "datex/dif/core.ts";
import { TS_TYPE } from "datex/types/ts-types.ts";

Deno.test("convert simple TS type to DIF type", () => {
    const ts_type = TS_TYPE`number`;
    assertEquals(ts_type, CoreLibTypeId.decimal_f64);

    const ts_type2 = TS_TYPE`string`;
    assertEquals(ts_type2, CoreLibTypeId.text);

    const ts_type3 = TS_TYPE`null`;
    assertEquals(ts_type3, CoreLibTypeId.null);

    const ts_type4 = TS_TYPE`boolean`;
    assertEquals(ts_type4, CoreLibTypeId.boolean);
});
