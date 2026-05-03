# TurboWarp Scratch-VM Compiler Architecture Overview

## Compilation Pipeline
```
Scratch Blocks → IRGenerator → IR AST → IROptimizer → JSGenerator → JS Code
                                         ↓
                                  TypeState Analysis
```

The compiler is in `src/compiler/` with entry point `compile.js`.

---

## 1. RUNTIME HELPERS (jsexecute.js)

All runtime functions are conditionally injected into generated code only if used.

### Control Flow & Yielding
- `isStuck()` - Check if thread is stuck (warp timer every 100 calls)
- `waitPromise(promise)` - Wait for promise resolution; yields and sets thread.status to STATUS_PROMISE_WAIT
- `yieldThenCall(callback, ...args)` - Yield once then call non-generator function
- `yieldThenCallGenerator(callback, ...args)` - Yield once then delegate to generator

### Thread Management
- `startHats(requestedHat, optMatchFields)` - Start hat blocks by opcode
- `waitThreads(threads)` - Wait for array of threads to finish; yields and manages STATUS_YIELD_TICK
- `retire()` - End current script (calls sequencer.retireThread)

### Type Conversions & Casting
- `toBoolean(value)` - Scratch-compatible boolean cast; '' and '0' are false
- `toNotNaN(value)` - Convert NaN to 0, preserve -0
- `limitPrecision(value)` - Round to whole if within 1e-9

### Comparisons
- `compareEqual(v1, v2)` - Scratch-style equality (smart type coercion)
- `compareGreaterThan(v1, v2)` - Scratch > operator
- `compareLessThan(v1, v2)` - Scratch < operator
- `isNotActuallyZero(val)` - Helper for comparison (detect "0" vs 0)

### Math & Random
- `randomInt(low, high)` - Inclusive range
- `randomFloat(low, high)` - Float range
- `mod(n, modulus)` - Floored division modulo (Scratch style)
- `tan(angle)` - Handle special cases (90°, -90°, etc.)

### Variables & Lists
- `listIndex(index, length)` - Convert Scratch 1-indexed to 0-indexed; handles "last", "random"
- `listGet(list, idx)` - Get item; returns '' if out of bounds
- `listInsert(list, idx, value)` - Insert at Scratch index
- `listReplace(list, idx, value)` - Replace at Scratch index
- `listDelete(list, idx)` - Delete from list; "all" clears it
- `listContains(list, item)` - Check membership with compareEqual
- `listIndexOf(list, item)` - Find 1-indexed position
- `listContents(list)` - Join list items (smart single-char join)

### Utility
- `timer()` - Create and start Timer
- `daysSince2000()` - Get days since 2000 (hardcoded 946684800000ms offset)
- `distance(menu)` - Distance to sprite/mouse; returns 10000 on stage
- `createBranchInfo(isLoop)` - Create state object for compatibility layer conditionals/loops
- `executeInCompatibilityLayer(inputs, blockFn, isWarp, useFlags, blockId, branchInfo)` - Calls old Scratch VM blocks; handles promises, yielding, branch logic
- `colorToList(color)` - Convert color to [R, G, B] array

### Base Runtime (Always Included)
- `isStuck()` logic
- `compareEqualSlow()` and `compareEqual()` base implementation
- `listIndexSlow()` and `listIndex()` base implementation

---

## 2. INTERMEDIATE REPRESENTATION (intermediate.js)

### IntermediateScript (Entry Point)
```javascript
{
  topBlockId: string | null,           // ID of top block
  stack: IntermediateStack | null,     // Compiled block stack
  isProcedure: boolean,                // Is this a procedure?
  procedureVariant: string,            // "W" or "Z" + procedure code
  procedureCode: string,               // Original procedure identifier
  arguments: string[],                 // Procedure parameter names
  isWarp: boolean,                     // Enable warp mode (no yields)
  yields: boolean,                     // Can this script yield? Determines generator vs function
  warpTimer: boolean,                  // Use warp timer (check stuck periodically)
  dependedProcedures: string[],        // List of procedure variants needed
  executableHat: boolean,              // Is top block an executable hat?
}
```

### IntermediateStackBlock (Stacked Command)
```javascript
{
  opcode: StackOpcode,        // Type of block
  inputs: Object,             // Block inputs (varies by opcode)
  yields: boolean,            // Does this block yield?
  ignoreState: boolean,       // Testing: ignore state changes?
  entryState: TypeState,      // Type analysis entry state
  exitState: TypeState,       // Type analysis exit state
}
```

### IntermediateInput (Reporter/Value)
```javascript
{
  opcode: InputOpcode,        // Type of input
  type: InputType,            // Bitfield of possible types at runtime
  inputs: Object,             // Nested inputs (varies by opcode)
  yields: boolean,            // Does this input yield?
}
```

### InputType Flags (Bitfield Enum)
Used to track possible types at compile time:
- Numbers: `NUMBER_POS_INF`, `NUMBER_POS_INT`, `NUMBER_POS_FRACT`, `NUMBER_ZERO`, `NUMBER_NEG_ZERO`, `NUMBER_NEG_INT`, `NUMBER_NAN`
- Composites: `NUMBER_REAL`, `NUMBER_INT`, `NUMBER_INF`, `NUMBER_OR_NAN`, `NUMBER_INTERPRETABLE`
- Strings: `STRING_NUM`, `STRING_NAN`, `STRING_BOOLEAN`, `STRING`
- Booleans: `BOOLEAN`, `BOOLEAN_INTERPRETABLE`
- Other: `ANY`, `COLOR` (RGB array)

Helper methods:
- `isAlwaysType(type)` - Type is guaranteed at runtime
- `isSometimesType(type)` - Type might occur
- `toType(targetType)` - Cast input; compile-time if constant, else insert cast opcode

### StackOpcode (Stacked Blocks)
Control, motion, looks, sound, events, list, variable, pen, sensing, procedures opcodes. E.g.:
- `CONTROL_IF_ELSE`, `CONTROL_REPEAT`, `CONTROL_WHILE`, `CONTROL_WAIT`
- `LIST_ADD`, `LIST_DELETE`, `LIST_INSERT`, `LIST_REPLACE`
- `VAR_SET`, `MOTION_X_SET`, `LOOKS_SAY`
- `EVENT_BROADCAST`, `EVENT_BROADCAST_AND_WAIT`
- `PROCEDURE_CALL`, `PROCEDURE_RETURN`

### InputOpcode (Reporter Blocks)
Constants, variables, operators, sensing, motion, looks, procedures. E.g.:
- `CONSTANT`, `CAST_NUMBER`, `CAST_STRING`, `CAST_BOOLEAN`
- `VAR_GET`, `LIST_GET`, `LIST_LENGTH`
- `OP_ADD`, `OP_MULTIPLY`, `OP_EQUALS`, `OP_GREATER`
- `MOTION_X_GET`, `MOTION_DIRECTION_GET`
- `SENSING_MOUSE_X`, `SENSING_KEY_DOWN`, `SENSING_TIMER_GET`

---

## 3. IR GENERATION (irgen.js)

### Entry Point: IRGenerator Class
```javascript
const irgen = new IRGenerator(thread);
const ir = irgen.generate();  // Returns IntermediateRepresentation
```

### IntermediateRepresentation Output
```javascript
{
  entry: IntermediateScript,              // Main script
  procedures: {                           // Procedure variants
    "Wproccode": IntermediateScript,      // Warp variant
    "Zproccode": IntermediateScript,      // Non-warp variant
  }
}
```

### IR Generation Process

1. **ScriptTreeGenerator** - Converts Scratch block tree to IR AST
   - `descendInput(block)` - Recursively compile reporter blocks to IntermediateInput
   - `descendStackedBlock(block)` - Convert stacked block to IntermediateStackBlock
   - `walkStack(startingBlockId)` - Chain multiple stacked blocks
   - `descendSubstack(parentBlock, substackName)` - Get nested stack (if/loop body)

2. **Input Compilation** (`descendInput`)
   - Recognizes Scratch opcodes: `math_number`, `text`, `data_variable`, `data_itemoflist`
   - Compiles operators: `operator_add`, `operator_equals`, `operator_random`
   - Handles constants with type inference
   - Detects costume/sound names to preserve as strings
   - Delegates to compatibility layer for non-compiled blocks

3. **Stacked Block Compilation** (`descendStackedBlock`)
   - Motion: `motion_setx`, `motion_sety`, `motion_forward`
   - Looks: `looks_say`, `looks_setcostumeto`
   - Control: `control_if`, `control_repeat`, `control_wait`
   - Lists: `data_addtolist`, `data_deleteoflist`
   - Events: `event_broadcast`, `event_broadcastandwait`
   - Procedures: `procedures_call`, `procedures_definition`

4. **Type Analysis** - `IROptimizer.optimize()`
   - Forward pass: determine variable types
   - Enables compile-time optimizations
   - Refines InputType flags for better codegen

5. **Procedure Tracking**
   - Procedures tracked by `variant = "W" + code` or `"Z" + code`
   - "W" = warp mode, "Z" = normal
   - Recursive procedures detected and yield appropriately

### Variable Descending (`descendVariable`)
Resolves variables by ID first, then by name+type. Returns:
```javascript
{
  scope: 'target' | 'stage',
  id: string | null,
  name: string,
  isCloud: boolean
}
```

---

## 4. CURRENT JS GENERATOR (jsgen.js)

### Entry Point
```javascript
const compiler = new JSGenerator(script, ir, target);
const generatorFunction = compiler.compile();
```

### High-Level Structure
1. **Allocate local variable names** (variable pool)
2. **Generate function preamble** (parameters, closure)
3. **Recursively descend IR** to emit JS code
4. **Handle generators vs regular functions** based on `script.yields`

### Yielding & Generators

**Generator Function** (when `script.yields = true`):
```javascript
function* generatedScript(p0, p1) {
    // ... code with yield
    yield;  // Pause execution
    return value;
}
```

**Regular Function** (when `script.yields = false`):
```javascript
function generatedScript(p0, p1) {
    // ... code without yield
    return value;
}
```

**Yielding Triggers**:
- Loops: `yieldLoop()` - check stuck or warp timer
- Hat blocks: always yield
- Promise wait: `yield* waitPromise(promise)`
- Thread wait: `yield* waitThreads(threads)`
- Compatibility layer blocks that might yield
- Between recursive procedure calls (non-warp mode)

### Type Conversions & Boxing

**Compile-time Optimization**:
- If input `isAlwaysType(NUMBER)`: emit bare number `123`
- If input `isAlwaysType(STRING)`: emit string `"hello"`
- If input `isAlwaysType(BOOLEAN)`: emit boolean `true`

**Runtime Casting**:
```javascript
case InputOpcode.CAST_BOOLEAN:
    return `toBoolean(${descendInput(target)})`;
case InputOpcode.CAST_NUMBER:
    return `toNotNaN(+${descendInput(target)})`;
case InputOpcode.CAST_NUMBER_INDEX:
    return `(${descendInput(target)} | 0)`;  // Bitwise OR for integer
case InputOpcode.CAST_STRING:
    return `("" + ${descendInput(target)})`;
```

### Comparison Optimizations
- Both operands number: use `===` directly
- One operand safe non-zero number: use `===`
- One operand never number: use `.toLowerCase()` string compare
- Otherwise: call `compareEqual()` for full Scratch semantics

### Compatibility Layer Calls

Blocks not compiled get delegated to old Scratch VM via `executeInCompatibilityLayer`:
```javascript
yield* executeInCompatibilityLayer(
    {inputs: values},
    blockFunction,
    isWarp,
    useFlags,
    blockId,
    branchInfo  // for IF/LOOP blocks
)
```

**BranchInfo** object manages conditional/loop branching:
```javascript
{
    defaultIsLoop: boolean,  // Is this a loop by default?
    isLoop: boolean,         // Was it a loop?
    branch: number,          // Which substack to execute
    stackFrame: {}           // Maintain state across yields
}
```

### Variables & Lists

**Variable Access**:
- Stored as `target.variables[variableId]` (Variable objects)
- Access value: `varRef.value`
- Set value: `varRef.value = newValue`
- Mark dirty: `varRef._monitorUpToDate = false`

**List Operations**:
- `listGet(list.value, idx)` - 1-indexed with "last", "random"
- `listInsert(list, idx, value)` - Insert helper
- `listDelete(list, idx)` - Delete helper with "all" support
- `listContains(list, item)` - Membership check

### Local Variables & Closure

**Variable Pools** (generate unique names):
- `localVariables` - Loop counters, temporaries
- `_setupVariables` - Variables set during preamble
- `functionNameVariablePool` - Generated function names
- `generatorNameVariablePool` - Generated generator names

**Closure References**:
```javascript
const target = thread.target;
const stage = runtime.getTargetForStage();
const runtime = thread.target.runtime;
const thread = globalState.thread;  // Set by execute.js
```

### Generated Function Signature
```javascript
function* (p0, p1, p2) {  // Parameters for procedure arguments
    const target = thread.target;
    const stage = runtime.getTargetForStage();
    // ... compiled script body
}
```

### Optimization Techniques
- **Constant folding**: Constants are evaluated at compile time
- **Dead code elimination**: Empty branches are not emitted
- **Type narrowing**: Uses InputType flags to avoid runtime type checks
- **Procedure inlining**: Non-recursive procedures might be optimized
- **Warp mode**: Skip yielding when safe

---

## Key Contracts for WASM Generator

### 1. Host Imports Needed
A WASM generator must import these categories:
- **Runtime helpers**: comparisons, type casts, list operations
- **Math functions**: trigonometry, logarithms, modulo
- **System access**: variables, sprites, runtime state
- **Threading**: yield points, promise handling
- **Compatibility layer**: fallback to JS for uncompiled blocks

### 2. Type System
- Must track 20+ InputType flags to enable optimizations
- Must support compile-time type inference
- Must handle "ANY" type with fallback path

### 3. Control Flow
- Must emit proper yield points for loops, waits, broadcasts
- Must handle recursive procedures with yield
- Must support both generator and non-generator modes
- Must manage thread status codes (RUNNING, YIELD, PROMISE_WAIT, etc.)

### 4. Variable System
- Variables are mutable references in target scope
- List operations mutate backing array
- Monitor state tracking (_monitorUpToDate flag)

### 5. Procedure Handling
- Procedure variants track warp mode
- Recursive calls need special yield handling
- Procedures can be cached after compilation

---

## Analysis Passes

**IROptimizer** runs after IR generation:
```javascript
class IROptimizer {
    optimize() {
        while (analyzeScript(entry)) {
            // Loop until fixed point for type analysis
        }
    }
}
```

Sets TypeState on each block for type-directed optimization.
