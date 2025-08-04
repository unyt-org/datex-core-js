# Development Guide

## Building the rust library

The rust adapter code can be found in the `rs-lib` directory, the generated WASM
and JS glue code in the `src/datex-core` directory.

The `rs-lib` directory contains the `datex-core` submodule, which contains the
complete [DATEX Core](https://github.com/unyt-org/datex-core.git) library.

To generate new WASM and JS glue code for the rust library located in `rs-lib`,
run `deno task build`.

Rust nightly is required for coroutines:

```sh
rustup install nightly
rustup default nightly
```

## Testing

The JS runtime can be tested by running `deno task test`. This compiles the rust
library, generates the WASM and JS glue code, and runs all tests in the `test`
directory. If you only want to run the tests without rebuilding the rust
library, you can run `deno task test-no-build`.

## Running in the browser

You can test the library in the browser by running `deno task serve`. Now, you
can open `http://localhost:8042/test/browser.html` in your browser. A new Datex
runtime instance is automatically created and can be accessed in the developer
console via the global `Datex` variable.


## Creating a new release

**Important steps before creating a release**:
 * Run `deno task release` to ensure that the generated d.ts files contain the types for the release build.
 * Set the `datex-core` crate to the correct version in the `Cargo.toml` file.