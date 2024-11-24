# Development Guide

## Building the rust library

The rust adapter code can be found in the `rs-lib` directory, the generated WASM and JS glue code in the `lib` directory.

The `rs-lib` directory contains the `datex-core` submodule, which contains the complete [DATEX Core](https://github.com/unyt-org/datex-core.git) library.

To generate new WASM and JS glue code for the rust library located in `rs-lib`, run `deno task wasmbuild`.

Rust nightly is required for coroutines:

```sh
rustup install nightly
rustup default nightly
```

## Testing

The JS runtime can be tested by running `deno task test`.
This runs all tests in the `test` directory.