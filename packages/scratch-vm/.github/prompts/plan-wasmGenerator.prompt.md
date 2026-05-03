## Plan: WASM generator for JSGenerator

TL;DR - Replace `JSGenerator`'s string-producing codegen with a Binaryen-based emitter that builds a .wasm module. Implement a small JS host glue (imports) that exposes runtime helpers (compatibility layer, list/variable ops, yield/interrupt protocol, string helpers). Track dynamic typing in a compact boxed representation in linear memory with fast paths and per-variable specialization when `isAlwaysType` allows a native numeric/local representation. Use Binaryen for IR-to-wasm lowering and its optimisation passes to produce compact, high-performance modules.

**Steps**
1. Discovery & contract design (depends on step 2): catalog all runtime helpers the generated code expects and define the host import ABI (boxing/unboxing, memory layout, yield/interrupt protocol, compatibility-layer call conventions).
2. Design WASM value model and memory layout (parallelizable with step 1): define boxed value representation, string storage policy, and a small reference table for JS objects required by compatibility calls.
2.1. Leverage JS String builtins where available: design the string path to use the WebAssembly JS-primitive-builtins (string builtins) proposal to avoid copying or boxing strings when an input/variable is known to be a string. Provide a clear fallback that marshals into host memory when the environment lacks these builtins.
3. Implement JS host glue (parallel with step 2): `wasm-host.js` exposing imports used by WASM (e.g., `host_execute_block`, `host_retire`, `host_yield`, `host_promisewait`, `host_list_*`, `host_var_get/set`, `host_toBoolean`, `host_compare*`, `host_random*`, `host_string_*`) and helpers for memory allocation and string marshalling.
4. Replace `JSGenerator` (high-level rewrite): create `WasmGenerator` that consumes the same intermediate representation and emits Binaryen module building calls instead of JS strings. Start with a minimal subset (expressions, control, lists, variables, compatibility calls) and add more opcodes iteratively.
5. Type specialization & locals mapping: when IR signals `isAlwaysType(Number)` or `String`, generate specialized local(s) (e.g., `f64` or pointer to inline string) and fast paths that avoid boxing. Fallback paths convert to boxed representation for compatibility calls.
6. Control flow and yielding model: compile generators/yielding scripts to a state-machine style function with an explicit program-counter local and a loop that calls into host yields when necessary. Alternatively, generate a function per substack that returns a status code and uses host-scheduler to resume. Implement suspend semantics to match current generator behavior (including `waitPromise`).
7. Compatibility layer calls: compile `executeInCompatibilityLayer` to a host import that returns either a boxed immediate result or an indicator that execution suspended (and the runtime will resume the WASM execution later). Design the call to support synchronous returns and asynchronous promise-based suspensions.
8. Binaryen optimization: run Binaryen passes (localcprop, simplify, vacuum, optimize) and use module validation. Use Binaryen exports/imports to expose entry points.
9. Integration & fallback: add a feature flag to runtime to select WASM-generated scripts vs JS fallback. Add a test harness to compare behavior against `JSGenerator` on unit fixtures.
10. Performance tuning & heap/GC improvements: reduce JS<->WASM transitions via batching (pass args in memory, or use typed locals); implement string builtins through host and WebAssembly ops where appropriate; add per-project profiling loops.

**Relevant files**
- [src/compiler/jsgen.js](src/compiler/jsgen.js) — current JavaScript generator; primary reference for semantics and optimizations.
- [src/compiler/jsexecute.js](src/compiler/jsexecute.js) — runtime helpers that generated JS expects; many functions will be imported or mirrored by `wasm-host`.
- [src/compiler/irgen.js](src/compiler/irgen.js) — generator of the intermediate representation consumed by `JSGenerator`.
- [src/compiler/intermediate.js](src/compiler/intermediate.js) — IR node/type definitions and `InputType` flags (verify presence).
- [src/compiler/variable-pool.js](src/compiler/variable-pool.js) — helper for generating fresh local names; reuse for fresh wasm local indices.
- engine runtime files (thread/scheduler/ sequencer) — callers and expectations about `thread.generator`, `thread.status`, and how yielding/retire are handled (will locate exact files during implement).

**Runtime helpers & imports (recommended API surface)**
Design the WASM module to import a compact set of host functions. Conceptual signatures:
- `host_box_number(f64) -> i32` : return boxed handle
- `host_box_string(ptr,len) -> i32`
- `host_unbox_number(i32) -> f64`
- `host_is_number(i32) -> i32`
- `host_toBoolean(i32) -> i32`
- `host_compare_eq(i32,i32) -> i32`, `host_compare_lt`, `host_compare_gt`
- `host_list_get(listRef,i32_idxBox) -> i32`, `host_list_insert(...)`, `host_list_delete(...)`
- `host_execute_compat(opcodePtr, inputsPtr, inputsCount, blockIdPtr, framePtr) -> i32` : runs compatibility-layer primitive; returns boxed value or SUSPEND code
- `host_wait_promise(promiseRef) -> i32` (alternative: handled inside `host_execute_compat`)
- `host_yield_tick()` and `host_yield()` : request scheduler to yield and return control
- `host_retire()` : retire current thread
- `host_alloc(len) -> ptr`, `host_free(ptr)` : memory allocation for string marshalling
- `host_string_eq(ptrA,lenA,ptrB,lenB) -> i32` : allow leveraging JS string builtins to avoid copies
 - `host_string_eq(ptrA,lenA,ptrB,lenB) -> i32` : allow leveraging JS string builtins to avoid copies
 - `host_string_builtin_op(opcode, aPtr, aLen, bPtr, bLen) -> i32|ptr` : optional lower-level hook that maps to JS String builtins (if present) to perform fast operations without allocating.

(Exact signatures will be refined; prefer boxed i32 handles for values and use host memory for variable-sized data.)

**Prioritized technical challenges**
1. Dynamic typing & boxing cost: boxed representation vs NaN-boxing, fast numeric locals, avoiding excessive JS allocations.
2. Yielding & async behavior: mapping generator/yield semantics and promise suspensions into suspend/resume host protocol.
3. Passing/returning strings and JS objects: minimizing copies via host string builtins and a small ref-table for JS objects.
4. Compatibility-layer semantics: `executeInCompatibilityLayer` must be preserved (side-effects, promise or synchronous returns).
5. Debugging and stack traces: keep useful errors and stack info.
6. Memory management & leaks: manage host ref-table lifecycle and frees.
7. Binaryen API ergonomics: incremental emit using Binaryen builder; mapping IR ops to wasm ops.

**Verification**
1. Unit parity tests: reuse existing `test/fixtures/*`; compile fixtures with both generators and diff results (state after fixed ticks).
2. Fuzz/behavioral tests: random programs from current fuzz fixtures for regressions.
3. Performance benchmarks: compare runtime on math-heavy, list-heavy, and UI scripts.
4. Binaryen validation: call `module.validate()` after generation.
5. Memory & leak tests: repeated start/stop sequences and check host ref-table sizes.

**Decisions & assumptions**
- WASM will use integer handles (i32) for boxed values and a host-managed ref-table for JS objects/strings.
- Yielding will use an explicit program-counter/state-machine local; WASM returns to scheduler when it yields; host resumes by calling exported resume.
- Compatibility layer kept in JS as host imports initially.
- Optimize numeric locals when `isAlwaysType(Number)`; otherwise use boxed paths.
 - When `isAlwaysType(String)` or when an input is known to be a string, prefer using the JS String builtins proposal ABI (when available) to operate on strings in-place without boxing; otherwise fall back to pointer+length host marshalling.

- When `isAlwaysType(String)` or when an input is known to be a string, use JS String builtins for the optimized path (required for optimized builds). For non-optimized builds or environments without support, fall back to pointer+length host marshalling.

**Further Considerations / Questions**
1. Boxed handles vs NaN-boxing: start with simple boxed handles (recommendation). Do you want NaN-boxing early or later?
2. Resume API shape: prefer a single `resume` per compiled script (simpler host) or multiple small functions (smaller codegen)? Recommendation: per-script `resume` state-machine export.
3. Garbage lifecycle: prefer explicit `host_release_ref(i32)` calls when objects go out of scope, or rely on WeakRefs? Recommendation: explicit release + host safety fallback.
4. Compatibility layer scope: should we port numeric-only primitives to WASM early for speed, or keep all in JS at first? Recommendation: keep in JS initially, but add TODOs to the plan to identify, list, and benchmark numeric-only primitives that are good candidates to port to WASM later. Add explicit `TODO: port candidate primitives` to the implementation steps.

5. JS String builtins support: if the host environment implements the WebAssembly JS-primitive-builtins string primitives, do we want to require them for the optimized path or treat them as optional fast-paths? Decision: require JS String builtins for the optimized path (no Safari support required). Non-optimized builds may continue to use pointer+length marshalling.

Next steps after you confirm scope:
1. Inspect exact IR node definitions and `InputType` flags used for specialization.
2. Propose concrete host import signatures and a minimal `wasm-host.js` prototype implementing them using `jsexecute.runtimeFunctions`.
3. Implement a small end-to-end prototype: compile a trivial math/variable script to wasm via `WasmGenerator`, validate and run via host glue to prove suspension/resume and boxing model.
