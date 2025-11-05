import { assertEquals } from "@std/assert/equals";
import { CoreTypeAddress } from "../../src/dif/definitions.ts";
import { TS_TYPE } from "../../src/types/ts-types.ts";

Deno.test("convert simple TS type to DIF type", () => {
    const ts_type = TS_TYPE`number`;
    assertEquals(ts_type, CoreTypeAddress.decimal_f64);

    const ts_type2 = TS_TYPE`string`;
    assertEquals(ts_type2, CoreTypeAddress.text);

    const ts_type3 = TS_TYPE`null`;
    assertEquals(ts_type3, CoreTypeAddress.null);

    const ts_type4 = TS_TYPE`boolean`;
    assertEquals(ts_type4, CoreTypeAddress.boolean);
});
