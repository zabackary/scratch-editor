# WASM Compiler Implementation

This document describes the WebAssembly code generator for the scratch-vm project, which compiles Scratch scripts to WebAssembly modules for improved performance.

## Overview

The WASM compiler replaces the JavaScript string-based code generation with Binaryen-based WebAssembly module building. This allows for better optimization and potentially faster script execution.

### Architecture

```
Scratch Script (Blocks)
    ↓
Intermediate Representation (IR)
    ↓
WasmGenerator (wasm-gen.js)
    ├─ Input expressions (descendInput)
    ├─ Stack commands (descendStackBlock)
    └─ Control flow (descendStack)
    ↓
Binaryen Module
    ├─ Validation
    └─ Optimization passes
    ↓
WebAssembly Binary
    ↓
WasmHost Import Functions (wasm-host.js)
    ├─ Type conversions
    ├─ Comparisons
    ├─ Math utilities
    ├─ List operations
    └─ Runtime integration
    ↓
Generator Function (runs in thread scheduler)
```

## File Structure

### Main Files

1. **src/compiler/wasm-gen.js** - WasmGenerator class
   - Converts IntermediateRepresentation to Binaryen module building calls
   - Handles IR traversal and expression/command compilation
   - Manages variable and reference allocation

2. **src/compiler/wasm-host.js** - Host import functions
   - Provides all runtime functions WASM code can call
   - Bridges WASM execution with Scratch runtime
   - Handles dynamic typing and value boxing

## Implementation Status

### ✅ Completed
- wasm-host.js with 30+ host functions
- WasmGenerator skeleton and class structure
- Frame management for control flow
- Input opcode compilation (50+ opcodes)
- Stack opcode compilation stubs (40+ opcodes)
- Constant compilation
- Basic arithmetic and comparison operators
- Variable reference allocation

### 🔄 In Progress
- Expression compilation expansion
- Stack command implementation

### ❌ Not Started
- Boxing system (value representation)
- WASM linear memory management
- String marshalling and storage
- Full control flow implementation (if/else, loops)
- Yielding and suspend/resume protocol
- Promise handling
- Compatibility layer calls
- Procedure calls
- Type specialization optimization
- Module validation and optimization
- Integration with runtime pipeline
- Fallback mechanism
- Comprehensive testing

## Input Opcodes Supported

### Constants & Type Conversions
- [x] CONSTANT - Literal values
- [x] CAST_NUMBER - Convert to number
- [x] CAST_NUMBER_INDEX - Convert to list index
- [x] CAST_NUMBER_OR_NAN - Convert without NaN filtering
- [x] CAST_STRING - Convert to string
- [x] CAST_BOOLEAN - Convert to boolean
- [x] CAST_COLOR - Convert to RGB array

### Variables & Lists
- [x] VAR_GET - Get variable value
- [x] LIST_GET - Get list item
- [x] LIST_LENGTH - Get list length
- [x] LIST_CONTAINS - Check list membership
- [x] LIST_INDEX_OF - Find item position
- [x] LIST_CONTENTS - Get stringified list

### Operators
- [x] OP_ADD, OP_SUBTRACT, OP_MULTIPLY, OP_DIVIDE
- [x] OP_MOD - Modulo
- [x] OP_ROUND, OP_ABS, OP_FLOOR, OP_CEILING, OP_SQRT
- [x] OP_SIN, OP_COS, OP_TAN, OP_ASIN, OP_ACOS, OP_ATAN
- [x] OP_LOG_E, OP_LOG_10, OP_POW_E, OP_POW_10
- [x] OP_EQUALS, OP_GREATER, OP_LESS
- [x] OP_AND, OP_OR, OP_NOT
- [x] OP_RANDOM (with int/float variants)

### Motion & Looks
- [ ] MOTION_X_GET, MOTION_Y_GET, MOTION_DIRECTION_GET
- [ ] LOOKS_SIZE_GET, LOOKS_COSTUME_NAME, LOOKS_COSTUME_NUMBER
- [ ] LOOKS_BACKDROP_NAME, LOOKS_BACKDROP_NUMBER

### Sensing
- [ ] SENSING_MOUSE_X, SENSING_MOUSE_Y, SENSING_MOUSE_DOWN
- [ ] SENSING_KEY_DOWN
- [ ] SENSING_TIMER_GET
- [x] SENSING_TIME_DAYS_SINCE_2000

### Other
- [x] PROCEDURE_ARGUMENT - Parameter references
- [ ] COMPATIBILITY_LAYER - Delegate to old VM
- [ ] ADDON_CALL - Call addon blocks

## Stack Opcodes Supported

### Control Flow
- [ ] CONTROL_IF_ELSE - If/else conditional
- [ ] CONTROL_WHILE - While loop
- [ ] CONTROL_FOR - For loop with counter
- [ ] CONTROL_REPEAT - Repeat N times
- [ ] CONTROL_WAIT - Wait N seconds
- [ ] CONTROL_WAIT_UNTIL - Wait until condition

### Variables & Lists
- [ ] DATA_SETVARIABLETO - Set variable
- [ ] DATA_CHANGEVARIABLEBY - Change variable by delta
- [ ] DATA_LISTAPPEND - Add to list
- [ ] DATA_LISTREPLACEITEM - Replace list item
- [ ] DATA_LISTINSERTITEM - Insert in list
- [ ] DATA_LISTDELETEITEM - Delete from list

### Motion, Looks, Sound
- [ ] All delegated to compatibility layer for now

### Procedures & Events
- [ ] PROCEDURES_CALL - Call procedure
- [ ] EVENT_BROADCASTANDWAIT - Broadcast with wait
- [ ] EVENT_BROADCAST - Broadcast

## Key Design Decisions

### 1. Value Representation
**Decision**: Currently using direct f64 for numbers, i32 for booleans, i32 references for objects/strings.

**TODO**: Implement proper boxing system with i32 handles and a host reference table.

### 2. Memory Layout
**Current**: No WASM linear memory allocated yet.

**Plan**: 
- First 1MB reserved for strings and temporary buffers
- Reference table maintained in JS for objects and lists
- String pointers encoded as (offset, length) pairs

### 3. Yielding Model
**Current**: Stubs return control to scheduler.

**Plan**:
- Explicit program-counter local for resumption
- Loop-based execution with yield points
- Host integration via generator protocol

### 4. Compatibility Layer
**Current**: Delegating most non-math blocks.

**Plan**:
- Batch numeric-only primitives for WASM
- Keep complex operations in JS
- Maintain full fallback path

## How to Use

```javascript
const WasmGenerator = require('./src/compiler/wasm-gen.js');

// Create generator for a script
const generator = new WasmGenerator(script, ir, target);

// Compile to WASM
const factory = generator.compile();

// The factory creates a generator function:
const thread = {target: sprite, ...};
const gen = factory(thread);

// Run in scheduler:
thread.generator = gen;
thread.generator.next(); // Yields to scheduler
```

## Testing

Tests should compare WASM-generated scripts against JS-generated scripts:

```javascript
// test/comparison/wasm-vs-js.test.js
const JSGenerator = require('../src/compiler/jsgen.js');
const WasmGenerator = require('../src/compiler/wasm-gen.js');

describe('WASM vs JS Generator', () => {
    it('should produce equivalent results', () => {
        const jsGen = new JSGenerator(script, ir, target);
        const wasmGen = new WasmGenerator(script, ir, target);
        
        const jsFn = jsGen.compile();
        const wasmFn = wasmGen.compile();
        
        // Compare outputs on fixed inputs
        // ...
    });
});
```

## Performance Considerations

1. **Transition costs**: Each JS ↔ WASM call has overhead
2. **Memory efficiency**: Unboxed locals vs boxed handles
3. **Specialization**: Leverage `isAlwaysType` for fast paths
4. **String handling**: Use JS String builtins when available

## Troubleshooting

### Compilation Fails
- Check console for Binaryen validation errors
- Ensure all referenced host functions are exported
- Verify input types match WASM expectations

### Incorrect Results
- Compare generated module with JSGenerator output
- Check boxing/unboxing logic
- Validate variable reference table
- Trace through Binaryen IR

### Performance Regressions
- Profile with Chrome DevTools
- Check for excessive JS ↔ WASM transitions
- Verify unboxing is working
- Ensure warp mode optimization active

## References

- [Intermediate Representation](./intermediate.js)
- [Binaryen Documentation](https://github.com/WebAssembly/binaryen)
- [Scratch VM Runtime](./engine/runtime.js)
- [JavaScript Generator](./jsgen.js)

## Next Steps

1. Implement complete boxing system with handle allocation
2. Add string marshalling to/from WASM linear memory
3. Implement yielding protocol
4. Add full control flow support
5. Create comprehensive test suite
6. Performance profiling and optimization
7. Integration with compilation pipeline
8. Production rollout with fallback
