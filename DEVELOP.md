# Development Guide

## Building the rust library

The rust adapter code can be found in the `rs_lib` directory, the generated WASM and JS glue code in the `lib` directory.

The `rs_lib` directory contains the `datex-core` submodule, which contains the complete [DATEX Core](https://github.com/unyt-org/datex-core.git) library.

To generate new WASM and JS glue code for the rust library located in `rs_lib`, run `deno task wasmbuild`
