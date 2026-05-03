# WASM Generator Implementation TODO

## Phase 1: Foundation (Critical Path)
### Boxing System & Memory Layout
- [ ] Implement i32 handle allocator
  - [ ] Create reference table structure
  - [ ] Add reference allocation methods
  - [ ] Add reference cleanup/GC
  - [ ] Test handle allocation and reuse

- [ ] String marshalling infrastructure
  - [ ] Design WASM linear memory layout
  - [ ] Implement host memory allocator
  - [ ] Add string read/write functions
  - [ ] Test string round-tripping

### Basic Compilation Pipeline
- [ ] Make WasmGenerator.compile() actually build a module
  - [ ] Allocate function locals
  - [ ] Build preamble
  - [ ] Descend script stack
  - [ ] Build entry function
  - [ ] Validate module

- [ ] Export factory function that returns a generator
  - [ ] Create WebAssembly.Module
  - [ ] Instantiate with imports
  - [ ] Return generator function
  - [ ] Test basic instantiation

### Simple End-to-End Test
- [ ] Create test script: constant number (42)
- [ ] Create test script: simple arithmetic (1 + 2)
- [ ] Create test script: variable read/write
- [ ] Verify output matches JS generator

## Phase 2: Control Flow & Yielding
### Control Flow Blocks
- [ ] Implement CONTROL_WAIT
  - [ ] Timer setup
  - [ ] Loop with timeout check
  - [ ] Proper yielding

- [ ] Implement CONTROL_REPEAT
  - [ ] Counter variable
  - [ ] Loop body descending
  - [ ] Yield between iterations

- [ ] Implement CONTROL_WHILE
  - [ ] Condition evaluation
  - [ ] Loop with condition check
  - [ ] Break on false

- [ ] Implement CONTROL_FOR
  - [ ] Counter variable setup
  - [ ] Range iteration
  - [ ] Proper loop structure

- [ ] Implement CONTROL_WAIT_UNTIL
  - [ ] Condition polling
  - [ ] Yield until true

- [ ] Implement CONTROL_IF_ELSE
  - [ ] Condition evaluation (already done)
  - [ ] Proper if structure
  - [ ] Else branch handling

### Yielding Protocol
- [ ] Add thread status management
  - [ ] Import thread status constants
  - [ ] Add host function to set status
  - [ ] Integrate with loops

- [ ] Implement program counter for resumption
  - [ ] Add PC local
  - [ ] Save PC before yield
  - [ ] Restore PC after yield

- [ ] Test yielding behavior
  - [ ] Verify yields occur at right points
  - [ ] Test resumption
  - [ ] Check thread status updates

## Phase 3: Variables, Lists & Data
### Variables
- [ ] Implement VAR_GET fully
  - [ ] Get variable object
  - [ ] Return value
  - [ ] Test with different types

- [ ] Implement DATA_SETVARIABLETO fully
  - [ ] Get variable object
  - [ ] Set value
  - [ ] Mark dirty for monitor

- [ ] Implement DATA_CHANGEVARIABLEBY
  - [ ] Get current value
  - [ ] Add delta
  - [ ] Set back
  - [ ] Handle type coercion

### Lists
- [ ] Implement list operations fully
  - [ ] Use host functions properly
  - [ ] Handle all index types (number, "last", "random")
  - [ ] Manage "all" deletion
  - [ ] Test with different item types

- [ ] Implement LIST_GET with special indices
- [ ] Implement LIST_CONTAINS with Scratch equality
- [ ] Implement LIST_INDEX_OF with Scratch equality

## Phase 4: Advanced Features
### Compatibility Layer
- [ ] Implement proper compatibility layer calls
  - [ ] Delegate unsupported blocks
  - [ ] Handle promise returns
  - [ ] Manage branch info for loops

- [ ] Move numeric-only primitives to WASM
  - [ ] Identify candidates (filtering, math ops)
  - [ ] Benchmark improvement
  - [ ] Implement in WASM

### Procedures & Recursion
- [ ] Implement PROCEDURES_CALL
  - [ ] Find procedure code
  - [ ] Call with arguments
  - [ ] Handle return values
  - [ ] Test recursion

- [ ] Implement procedure code generation
  - [ ] Generate separate function per procedure
  - [ ] Link procedures together
  - [ ] Test with nested calls

### Events & Broadcasting
- [ ] Implement EVENT_BROADCAST
  - [ ] Basic broadcast (no wait)

- [ ] Implement EVENT_BROADCASTANDWAIT
  - [ ] Yield while waiting
  - [ ] Resume when complete
  - [ ] Test multiple threads

### Promise Handling
- [ ] Implement promise-returning blocks
  - [ ] Ask/answer (if implemented)
  - [ ] Sensing blocks returning promises
  - [ ] Proper promise unwrapping

## Phase 5: Optimization & Polish
### Type Specialization
- [ ] Leverage InputType flags
  - [ ] Detect isAlwaysType patterns
  - [ ] Emit optimized code path
  - [ ] Benchmark improvement

- [ ] Numeric-only fast paths
  - [ ] Detect pure numeric operations
  - [ ] Skip boxing/unboxing
  - [ ] Test for correctness

### String Operations
- [ ] Implement OP_JOIN (string concatenation)
- [ ] Implement OP_LENGTH (string length)
- [ ] Implement OP_CONTAINS (substring search)
- [ ] Implement OP_LETTER_OF (character access)

### Binaryen Optimization
- [ ] Run Binaryen optimization passes
  - [ ] localcprop
  - [ ] simplify
  - [ ] vacuum
  - [ ] optimize

- [ ] Measure optimization impact
- [ ] Fine-tune optimization settings

### Memory Efficiency
- [ ] Implement proper local allocation
  - [ ] Reduce local count
  - [ ] Reuse locals where possible
  - [ ] Profile memory usage

- [ ] Optimize reference table
  - [ ] Implement weak references where possible
  - [ ] Clean up released references
  - [ ] Monitor table size

## Phase 6: Testing & Validation
### Unit Tests
- [ ] Math operator tests (all 10+ operators)
- [ ] Comparison operator tests (equals, greater, less)
- [ ] Control flow tests (if, while, repeat, for, wait)
- [ ] Variable tests (read, write, change)
- [ ] List tests (get, insert, delete, contains, indexOf)
- [ ] Type conversion tests

### Integration Tests
- [ ] Compare WASM vs JS output on fixtures
  - [ ] fixtures/math-heavy scripts
  - [ ] fixtures/list-heavy scripts
  - [ ] fixtures/ui-heavy scripts
  - [ ] fixtures/recursive-procedures

- [ ] Run existing test suite with WASM enabled
- [ ] Performance benchmarks vs JS

### Stress Tests
- [ ] Long-running loops (check for leaks)
- [ ] Many simultaneous scripts
- [ ] Large data structures (lists, strings)
- [ ] Procedure recursion limits

## Phase 7: Production Integration
### Compilation Pipeline
- [ ] Modify compile.js to use WasmGenerator
  - [ ] Check feature flag
  - [ ] Try WASM compilation
  - [ ] Fall back to JS on error
  - [ ] Track statistics

- [ ] Add runtime selection logic
  - [ ] Feature flag in runtime config
  - [ ] Environment detection (browser support)
  - [ ] Graceful degradation

### Documentation
- [ ] Update compiler documentation
- [ ] Add debugging guide
- [ ] Document performance characteristics
- [ ] Create migration guide

### Monitoring & Telemetry
- [ ] Add compilation statistics
  - [ ] WASM successes/failures
  - [ ] Performance metrics
  - [ ] Error reasons

- [ ] Add runtime metrics
  - [ ] Execution time (WASM vs JS)
  - [ ] Memory usage
  - [ ] Script yield frequency

## Known Limitations & TODOs

### Current Stubs/Incomplete
- [ ] Motion blocks (X, Y, direction reads)
- [ ] Looks blocks (costume, backdrop)
- [ ] Sensing blocks (mouse, keyboard, timer)
- [ ] Pen extension blocks
- [ ] Text-to-speech blocks
- [ ] Most extension blocks

### Future Considerations
- [ ] SIMD operations for batch processing
- [ ] Worker thread support
- [ ] Module caching
- [ ] Source map integration
- [ ] Hot reload support

## Metrics & Success Criteria

- [ ] All JSGenerator tests pass with WASM enabled
- [ ] WASM output matches JS output on 100+ test scripts
- [ ] Compilation time < 100ms per script
- [ ] Module size < 50KB per script
- [ ] Runtime execution >= 1.5x faster than JS
- [ ] Memory overhead < 10% compared to JS
- [ ] Zero memory leaks on long-running tests
- [ ] 100% fallback success rate (no crashes)

## References

- See WASM_COMPILER.md for architecture
- See WASM_DEVELOPMENT_GUIDE.js for developer tips
- See plan-wasmGenerator.prompt.md for original plan
- See wasm-generator-implementation-progress.md for detailed status
