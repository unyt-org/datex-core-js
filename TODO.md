# TODO

- [ ] crate should be no_std (for wasm and embedded)
  - pad
  - tokio
  - websockets
- [ ] create a trait for everything that is platform-specific (e.g. websockets)
      put the implementations of the traits behind feature flags (or in a
      seperate crate) features should be additive
- [ ] `lazy_static` can be replaced by `core::cell::LazyCell` and
      `once_cell::sync::LazyLock`
- [ ] `static`s should be avoided (GlobalContext)
- [ ] use `log` and `defmt` for logging (instead of own implementation)
- [ ] `anyhow` should not be used in library crates (create enums for errors
      instead)
- [ ] generally generics should be preferred over dynamic dispatch (e.g. in
      network::com_hub::ComHub)
- [ ] don't use the nightly `coroutines` feature as it won't be stabilized in
      the near future
- [ ] getter methods should be split into a non-mut and a mut version (e.g.
      Memory::get_pointer_by_*)
- [ ] use a slice instead of array or Vec as parameter type if possible (e.g.
      Memory::get_pointer_by_id)
- [x] parsing of dxb_body could maybe be simplified by using a serialization
      library
- [ ] integrate clippy
- [ ] smaller binary size: https://github.com/johnthagen/min-sized-rust

---

- [ ] naming conventions: https://rust-lang.github.io/api-guidelines/naming.html
      (e.g.
- [ ] DXBBlock => DxbBlock, no `get_*` functions)
- [ ] `mopa` crate is unmaintained
