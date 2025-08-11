export type CoreType = "integer" | "text" | "boolean"; // ...

export type JSONObject = { [key: string]: JSONValue };
export type JSONArray = JSONValue[];
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;

export type DIFValue = {
    core_type: CoreType,
    ptr_id?: string,
    type: CoreType, // TODO: this will not be a CoreType in the future, but a more complex type
    value: JSONValue,
}