// @ts-check

/**
 * @fileoverview Quick start guide for continuing WASM generator development
 * 
 * This file documents the current state and how to extend the implementation.
 */

/**
 * QUICK START FOR DEVELOPERS
 * 
 * Current State:
 * - Basic skeleton for WasmGenerator implemented
 * - 30+ host import functions ready
 * - 50+ input opcodes have stub/partial support
 * - 40+ stack opcodes have fallback to compatibility layer
 * 
 * Next Steps:
 * 
 * 1. BOXING SYSTEM
 *    Location: wasm-gen.js
 *    Task: Implement i32 handle allocation
 *    
 *    Pattern to use:
 *    - descendent values are i32 or f64
 *    - When converting between types, call host functions
 *    - Allocate references for JS objects/strings
 *    
 *    Example stubs already in code:
 *      allocateStringReference(value)
 *      allocateVariableReference(variableId)
 *    
 *    Missing: Actual backing store for references in WasmGenerator
 *    
 * 2. CONTROL FLOW IMPLEMENTATION
 *    Location: wasm-gen.js descendStackBlock()
 *    
 *    Methods to implement:
 *      generateWait(block)        - Wait with timer
 *      generateRepeat(block)      - Loop N times
 *      generateWhile(block)       - While condition
 *      generateFor(block)         - For loop with counter
 *      generateWaitUntil(block)   - Wait until condition
 *    
 *    Pattern:
 *      1. Evaluate condition with descendInput()
 *      2. Create loop using m.block() or m.loop()
 *      3. Call m.call('host_isStuck', ...) to yield if needed
 *      4. Recurse descendStack() for body
 * 
 * 3. STRING MARSHALLING
 *    Location: wasm-host.js
 *    
 *    The JS side needs to support reading/writing strings from WASM memory.
 *    Currently, strings are treated as references (i32 handles).
 *    
 *    To implement:
 *      1. Add WASM linear memory handling to host imports
 *      2. Create marshal/unmarshal functions
 *      3. Update descendInput() for string constants
 *      4. Implement string operations (JOIN, LENGTH, CONTAINS, etc.)
 * 
 * 4. YIELDING PROTOCOL
 *    Location: wasm-gen.js, wasm-host.js
 *    
 *    Current generator pattern (JS):
 *      function* gen() {
 *          yield;
 *          const value = ...;
 *          yield;
 *          return value;
 *      }
 *    
 *    For WASM, we need:
 *      1. A program counter local to resume from
 *      2. Host function to set thread status
 *      3. Proper cleanup before yield
 *    
 *    See generateWait() stub for pattern.
 * 
 * 5. TESTING & VALIDATION
 *    Location: test/unit/compiler/wasm-gen.test.js
 *    
 *    Use compareWasmAndJS() helper to validate implementations.
 *    Create simple test scripts (e.g., 1 + 2, repeat 3 times).
 * 
 * FILE LOCATIONS & RESPONSIBILITIES
 * 
 * wasm-gen.js (600 lines):
 *   - Main generator class
 *   - Converts IR to Binaryen calls
 *   - Manages locals, frames, control flow
 *   - Methods to extend:
 *     * descendInput() - for new opcodes
 *     * descendStackBlock() - for new commands
 *     * generate*() - for specific blocks
 * 
 * wasm-host.js (400 lines):
 *   - Host import functions
 *   - Provides JS ↔ WASM bridge
 *   - Import object creation
 *   - Methods to extend:
 *     * Add more host functions as needed
 *     * Implement memory marshalling
 * 
 * wasm-integration.js (50 lines):
 *   - Runtime integration
 *   - Fallback mechanism
 *   - Feature flags
 * 
 * test/unit/compiler/wasm-gen.test.js:
 *   - Testing utilities
 *   - WASM vs JS comparison
 * 
 * IMPORTANT PATTERNS
 * 
 * 1. Error Handling
 *    - Always fall back to JS on compilation error
 *    - Log warnings but don't crash
 *    - Use compatibility layer for unknown blocks
 * 
 * 2. Memory & References
 *    - WASM locals: f64 for numbers, i32 for booleans/references
 *    - Host references: managed by allocate*Reference() methods
 *    - Never directly access WASM memory yet (TODO)
 * 
 * 3. Type Safety
 *    - InputType bitfield used for optimization
 *    - isAlwaysType() checks whether casts are needed
 *    - Use isSometimesType() for fallback paths
 * 
 * 4. Binaryen Basics
 *    - m = this.wasmModule (Binaryen.Module instance)
 *    - m.f64.const(value) - number constant
 *    - m.i32.const(value) - integer constant
 *    - m.f64.add(a, b) - arithmetic
 *    - m.if(cond, ifTrue, ifFalse) - conditional
 *    - m.block(name, [expr1, expr2, ...]) - sequence
 *    - m.call('func_name', [arg1, arg2], returnType)
 *    - m.local.get(index, type) - read local
 *    - m.local.set(index, value) - write local
 * 
 * DEBUGGING TIPS
 * 
 * 1. Enable debug logging:
 *    target.runtime.debug = true;
 * 
 * 2. Check Binaryen module validity:
 *    if (this.wasmModule.validate() === 0) { console.error('Invalid!'); }
 * 
 * 3. Print generated IR:
 *    console.log(binaryen.emitText(this.wasmModule));
 * 
 * 4. Compare with JS generator:
 *    Use test/unit/compiler/wasm-gen.test.js compareWasmAndJS()
 * 
 * 5. Trace execution:
 *    Add host_log() calls in generated code
 * 
 * COMMON MISTAKES
 * 
 * 1. Forgetting that WASM is typed - always specify i32 vs f64
 * 2. Not calling host functions for system access
 * 3. Mixing up local indices (parameter order matters)
 * 4. Forgetting to yield in loops
 * 5. Not handling promise-based blocks
 * 
 * RESOURCES
 * 
 * - See WASM_COMPILER.md for detailed documentation
 * - src/compiler/jsgen.js is the reference implementation (JS version)
 * - src/compiler/intermediate.js for IR node definitions
 * - src/compiler/enums.js for all opcode definitions
 * - test/fixtures/* for test scripts to validate against
 */

// This is a documentation file - no code to export
