# DATEX Core JS

DATEX Core Library for JavaScript, based on the Rust/WASM DATEX Core Library.

The rust adapter code can be found in the `rs_lib` directory, the generated WASM and JS glue code in the `lib` directory.

## Development

## Building the rust library
To generate new WASM and JS glue code for the rust library located in `rs_lib`, run `deno task wasmbuild`

Development follows the same scheme like the other core libraries