# IR Opcodes Catalog

Generated from src/compiler/enums.js

## InputOpcode (Reporter Blocks - Return Values)

### Constants & Type Conversions
- `CONSTANT` - Literal value (number, string, boolean)
- `CAST_NUMBER`, `CAST_NUMBER_INDEX`, `CAST_NUMBER_OR_NAN` - To number
- `CAST_STRING` - To string
- `CAST_BOOLEAN` - To boolean  
- `CAST_COLOR` - To [R, G, B]
- `NOP` - No-op reporter

### Variables & Data
- `VAR_GET` - Read scalar variable
- `LIST_GET` - Get list item by index
- `LIST_LENGTH` - Get list length
- `LIST_CONTAINS` - Check if item in list
- `LIST_INDEX_OF` - Find item position (1-indexed)
- `LIST_CONTENTS` - Stringified list

### Motion
- `MOTION_X_GET` - Get X position
- `MOTION_Y_GET` - Get Y position
- `MOTION_DIRECTION_GET` - Get direction

### Looks
- `LOOKS_SIZE_GET` - Get sprite size
- `LOOKS_COSTUME_NAME` - Current costume name
- `LOOKS_COSTUME_NUMBER` - Current costume index (1-indexed)
- `LOOKS_BACKDROP_NAME` - Current backdrop name
- `LOOKS_BACKDROP_NUMBER` - Current backdrop index

### Operators
- `OP_ADD`, `OP_SUBTRACT`, `OP_MULTIPLY`, `OP_DIVIDE` - Arithmetic
- `OP_MOD` - Modulo (floored division)
- `OP_ROUND` - Round to integer
- `OP_ABS`, `OP_FLOOR`, `OP_CEILING`, `OP_SQRT` - Math functions
- `OP_SIN`, `OP_COS`, `OP_TAN` - Trigonometry (angle in degrees)
- `OP_ASIN`, `OP_ACOS`, `OP_ATAN` - Inverse trig
- `OP_LOG_E`, `OP_LOG_10` - Logarithms
- `OP_POW_E`, `OP_POW_10` - Powers (e^x, 10^x)
- `OP_EQUALS`, `OP_GREATER`, `OP_LESS` - Comparisons
- `OP_AND`, `OP_OR`, `OP_NOT` - Boolean logic
- `OP_JOIN` - String concatenation
- `OP_LENGTH` - String length
- `OP_CONTAINS` - Substring check
- `OP_LETTER_OF` - Character at index
- `OP_RANDOM` - Random number (supports int/float optimization hints)

### Sensing
- `SENSING_MOUSE_X`, `SENSING_MOUSE_Y` - Mouse position
- `SENSING_MOUSE_DOWN` - Is mouse button pressed
- `SENSING_KEY_DOWN` - Is key pressed
- `SENSING_TOUCHING_COLOR` - Color touching check
- `SENSING_TOUCHING_OBJECT` - Sprite touching check
- `SENSING_COLOR_TOUCHING_COLOR` - Color-color touching
- `SENSING_DISTANCE` - Distance to sprite/mouse
- `SENSING_TIMER_GET` - Timer value
- `SENSING_ANSWER` - Ask block answer
- `SENSING_USERNAME` - Username string
- `SENSING_TIME_YEAR`, `_MONTH`, `_DATE`, `_WEEKDAY`, `_HOUR`, `_MINUTE`, `_SECOND` - Date/time
- `SENSING_TIME_DAYS_SINCE_2000` - Days from epoch
- `SENSING_OF` - Generic "of" block (sprite attribute)
- `SENSING_OF_BACKDROP_NAME`, `_NUMBER` - Backdrop attribute
- `SENSING_OF_COSTUME_NAME`, `_NUMBER` - Costume attribute
- `SENSING_OF_POS_X`, `_Y` - Sprite position
- `SENSING_OF_DIRECTION` - Sprite direction
- `SENSING_OF_SIZE` - Sprite size
- `SENSING_OF_VOLUME` - Sprite volume
- `SENSING_OF_VAR` - Variable of sprite

### Procedures & Control
- `PROCEDURE_CALL` - Call procedure
- `PROCEDURE_ARGUMENT` - Parameter reference
- `CONTROL_COUNTER` - Control extension counter

### Compat & Special
- `COMPATIBILITY_LAYER` - Delegate to old Scratch VM block
- `OLD_COMPILER_COMPATIBILITY_LAYER` - Legacy fallback
- `ADDON_CALL` - Call addon block
- `TW_KEY_LAST_PRESSED` - TurboWarp: last key pressed

---

## StackOpcode (Stacked/Command Blocks)

### Control Flow
- `CONTROL_IF_ELSE` - If/else conditional
- `CONTROL_WHILE` - While loop
- `CONTROL_FOR` - For loop (with counter variable)
- `CONTROL_REPEAT` - Repeat N times
- `CONTROL_WAIT` - Wait N seconds
- `CONTROL_WAIT_UNTIL` - Wait until condition
- `CONTROL_STOP_ALL` - Stop all scripts
- `CONTROL_STOP_OTHERS` - Stop other scripts
- `CONTROL_STOP_SCRIPT` - Stop this script
- `CONTROL_CLEAR_COUNTER` - Clear control counter
- `CONTORL_INCR_COUNTER` - Increment counter (typo in codebase)

### Cloning
- `CONTROL_CLONE_CREATE` - Create clone of sprite
- `CONTROL_CLONE_DELETE` - Delete this clone

### Events
- `EVENT_BROADCAST` - Broadcast message (no wait)
- `EVENT_BROADCAST_AND_WAIT` - Broadcast and wait for hats

### Motion
- `MOTION_STEP` - Move N steps
- `MOTION_X_SET`, `_CHANGE` - Set/change X
- `MOTION_Y_SET`, `_CHANGE` - Set/change Y
- `MOTION_XY_SET` - Set both X and Y
- `MOTION_DIRECTION_SET` - Set direction
- `MOTION_ROTATION_STYLE_SET` - Set rotation style
- `MOTION_IF_ON_EDGE_BOUNCE` - Bounce if on edge

### Looks
- `LOOKS_SAY` - Say text bubble
- `LOOKS_THINK` - Think text bubble
- `LOOKS_COSTUME_SET`, `_NEXT` - Set/next costume
- `LOOKS_BACKDROP_SET`, `_NEXT` - Set/next backdrop
- `LOOKS_SIZE_SET`, `_CHANGE` - Set/change size
- `LOOKS_EFFECT_SET`, `_CHANGE`, `_CLEAR` - Visual effects
- `LOOKS_LAYER_FRONT`, `_BACK`, `_FORWARD`, `_BACKWARD` - Layering
- `LOOKS_SHOW`, `_HIDE` - Visibility

### Variables & Lists
- `VAR_SET` - Set variable
- `VAR_SHOW`, `_HIDE` - Show/hide variable monitor
- `LIST_ADD` - Add to list
- `LIST_INSERT` - Insert in list
- `LIST_REPLACE` - Replace in list
- `LIST_DELETE` - Delete from list
- `LIST_DELETE_ALL` - Clear list
- `LIST_SHOW`, `_HIDE` - Show/hide list monitor

### Pen
- `PEN_UP`, `PEN_DOWN` - Pen state
- `PEN_CLEAR` - Clear pen marks
- `PEN_STAMP` - Stamp pen mark
- `PEN_SIZE_SET`, `_CHANGE` - Pen size
- `PEN_COLOR_SET` - Pen color
- `PEN_COLOR_PARAM_SET`, `_CHANGE` - Pen color parameter (hue, saturation, etc.)
- `PEN_COLOR_HUE_SET_LEGACY`, `_CHANGE_LEGACY` - Old-style hue
- `PEN_COLOR_SHADE_SET_LEGACY`, `_CHANGE_LEGACY` - Old-style shade

### Sound
- (Compiled as compatibility layer calls)

### Procedures & Special
- `PROCEDURE_CALL` - Call procedure
- `PROCEDURE_RETURN` - Return from procedure
- `SENSING_TIMER_RESET` - Reset timer
- `NOP` - No-op (placeholder)
- `ADDON_CALL` - Addon block
- `COMPATIBILITY_LAYER` - Delegate to old Scratch VM
- `OLD_COMPILER_COMPATIBILITY_LAYER` - Legacy fallback
- `HAT_EDGE` - Edge-triggered hat (key pressed, etc.)
- `HAT_PREDICATE` - Predicate hat (condition check)
- `DEBUGGER` - Debugger statement
- `VISUAL_REPORT` - Stack click report display

---

## InputOpcode Input Nodes (Recursive Structure)

Each IntermediateInput has nested `inputs` object with type-specific fields:

### Binary Operations (left, right)
- `OP_ADD`, `OP_SUBTRACT`, `OP_MULTIPLY`, `OP_DIVIDE`
- `OP_MOD`, `OP_EQUALS`, `OP_GREATER`, `OP_LESS`
- `OP_AND`, `OP_OR`, `OP_JOIN`

### Unary Operations (value)
- `OP_ROUND`, `OP_ABS`, `OP_FLOOR`, `OP_CEILING`, `OP_SQRT`
- `OP_SIN`, `OP_COS`, `OP_TAN`, `OP_ASIN`, `OP_ACOS`, `OP_ATAN`
- `OP_LOG_E`, `OP_LOG_10`, `OP_POW_E`, `OP_POW_10`

### String Operations
- `OP_LENGTH` - {string}
- `OP_CONTAINS` - {string, contains}
- `OP_LETTER_OF` - {letter, string}
- `OP_JOIN` - {left, right}

### Casting (target)
- `CAST_BOOLEAN`, `CAST_NUMBER`, `CAST_NUMBER_INDEX`, `CAST_NUMBER_OR_NAN`
- `CAST_STRING`, `CAST_COLOR`

### List Operations
- `LIST_GET` - {list, index}
- `LIST_LENGTH` - {list}
- `LIST_CONTAINS` - {list, item}
- `LIST_INDEX_OF` - {list, item}
- `LIST_CONTENTS` - {list}

### Variable & Sensing
- `VAR_GET` - {variable: {scope, id, name, isCloud}}
- `SENSING_OF` - {object, property}
- `SENSING_OF_POS_X/Y` - {object}
- `SENSING_OF_DIRECTION` - {object}
- `SENSING_OF_SIZE` - {object}
- `SENSING_OF_COSTUME_NUMBER/NAME` - {object}
- `SENSING_OF_BACKDROP_NUMBER/NAME` - {object}
- `SENSING_OF_VOLUME` - {object}
- `SENSING_OF_VAR` - {object, property}

### Sensing with Inputs
- `SENSING_TOUCHING_COLOR` - {color}
- `SENSING_TOUCHING_OBJECT` - {object}
- `SENSING_COLOR_TOUCHING_COLOR` - {target, mask}
- `SENSING_DISTANCE` - {target}
- `SENSING_KEY_DOWN` - {key}
- `OP_RANDOM` - {low, high, useInts, useFloats}

### Procedure
- `PROCEDURE_CALL` - {code, variant, arguments: [IntermediateInput[]]}
- `PROCEDURE_ARGUMENT` - {index}

---

## StackOpcode Input Nodes (Command Parameters)

### Conditionals & Loops
- `CONTROL_IF_ELSE` - {condition, whenTrue: Stack, whenFalse: Stack}
- `CONTROL_WHILE` - {condition, do: Stack, warpTimer: boolean}
- `CONTROL_FOR` - {count, variable, do: Stack}
- `CONTROL_REPEAT` - {times, do: Stack}
- `CONTROL_WAIT` - {seconds}
- `CONTROL_WAIT_UNTIL` - {condition}

### Motion
- `MOTION_STEP` - {steps}
- `MOTION_X_SET`/`_CHANGE` - {dx}
- `MOTION_Y_SET`/`_CHANGE` - {dy}
- `MOTION_XY_SET` - {x, y}
- `MOTION_DIRECTION_SET` - {direction}
- `MOTION_ROTATION_STYLE_SET` - {style}

### Looks
- `LOOKS_SAY`/`_THINK` - {message}
- `LOOKS_COSTUME_SET`/`_NEXT` - {costume}
- `LOOKS_BACKDROP_SET`/`_NEXT` - {backdrop}
- `LOOKS_SIZE_SET`/`_CHANGE` - {size}
- `LOOKS_EFFECT_SET`/`_CHANGE` - {effect, value}
- `LOOKS_LAYER_*` - {layers}

### Variables
- `VAR_SET` - {variable, value}
- `LIST_ADD` - {list, item}
- `LIST_INSERT` - {list, index, item}
- `LIST_REPLACE` - {list, index, item}
- `LIST_DELETE` - {list, index}

### Events
- `EVENT_BROADCAST`/`_AND_WAIT` - {broadcast}

### Procedure
- `PROCEDURE_CALL` - {code, variant, arguments: [IntermediateInput[]]}
- `PROCEDURE_RETURN` - {value}

### Pen
- `PEN_SIZE_SET`/`_CHANGE` - {size}
- `PEN_COLOR_SET` - {color}
- `PEN_COLOR_PARAM_SET`/`_CHANGE` - {param, value}

### Control
- `CONTROL_CLONE_CREATE` - {target}
- `CONTROL_CLONE_DELETE` - (none)

### Hats
- `HAT_EDGE` - {condition, id}
- `HAT_PREDICATE` - {condition}

### Visual Report
- `VISUAL_REPORT` - {input}
