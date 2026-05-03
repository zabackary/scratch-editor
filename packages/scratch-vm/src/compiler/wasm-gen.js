// @ts-check

const log = require('../util/log');
const VariablePool = require('./variable-pool');
const createWasmHostImports = require('./wasm-host');
const {StackOpcode, InputOpcode, InputType} = require('./enums.js');
const {default: binaryen} = require('binaryen');

// These imports are used by jsdoc comments but eslint doesn't know that
/* eslint-disable no-unused-vars */
const {
    IntermediateStackBlock,
    IntermediateInput,
    IntermediateStack,
    IntermediateScript,
    IntermediateRepresentation
} = require('./intermediate');
/* eslint-enable no-unused-vars */

/**
 * @fileoverview Convert intermediate representations to WebAssembly modules.
 *
 * This generator follows the same IR compilation pattern as JSGenerator
 * but emits Binaryen module building calls instead of JavaScript strings.
 */

/**
 * A frame contains some information about the current substack being compiled.
 */
class Frame {
    constructor (isLoop) {
        /**
         * Whether the current stack runs in a loop (while, for)
         * @type {boolean}
         * @readonly
         */
        this.isLoop = isLoop;

        /**
         * Whether the current block is the last block in the stack.
         * @type {boolean}
         */
        this.isLastBlock = false;
    }
}

class WasmGenerator {
    /**
     * @param {IntermediateScript} script
     * @param {IntermediateRepresentation} ir
     * @param {import("../sprites/rendered-target")} target
     */
    constructor (script, ir, target) {
        this.script = script;
        this.ir = ir;
        this.target = target;

        this.isWarp = script.isWarp;
        this.isProcedure = script.isProcedure;
        this.warpTimer = script.warpTimer;

        /**
         * Stack of frames, most recent is last item.
         * @type {Frame[]}
         */
        this.frames = [];

        /**
         * The current Frame.
         * @type {Frame?}
         */
        this.currentFrame = null;

        /**
         * Local variable pool for WASM locals
         * @type {VariablePool}
         */
        this.localVariables = new VariablePool('local');

        this.debug = this.target.runtime.debug;

        /**
         * The Binaryen module for this script.
         * @type {binaryen.Module}
         */
        this.wasmModule = new binaryen.Module();

        /**
         * Map from variable IDs to host reference indices
         * (for string/object storage in JS)
         * @type {Map<string, number>}
         */
        this.variableReferenceMap = new Map();

        /**
         * Next available reference ID
         */
        this.nextReferenceId = 0;

        /**
         * Binaryen type for boxed values (i32 handles)
         */
        this.boxedType = binaryen.i32;

        /**
         * Counter for stuck check
         */
        this.stuckCheckCounter = 0;

        /**
         * List of locals needed (type, initial value)
         * @type {Array<{type: string, value: unknown}>}
         */
        this.locals = [];
    }

    /**
     * Enter a new frame
     * @param {Frame} frame New frame.
     */
    pushFrame (frame) {
        this.frames.push(frame);
        this.currentFrame = frame;
    }

    /**
     * Exit the current frame
     */
    popFrame () {
        this.frames.pop();
        this.currentFrame = this.frames[this.frames.length - 1];
    }

    /**
     * @returns {boolean} true if the current block is the last command of a loop
     */
    isLastBlockInLoop () {
        for (let i = this.frames.length - 1; i >= 0; i--) {
            const frame = this.frames[i];
            if (!frame.isLastBlock) {
                return false;
            }
            if (frame.isLoop) {
                return true;
            }
        }
        return false;
    }

    /**
     * Allocate a fresh local variable in WASM.
     * @param {binaryen.Type} _type The type of the local
     * @returns {number} The local index
     */
    allocateLocal () {
        // TODO: Implement proper local allocation
        // For now, just return a dummy index
        return 0;
    }

    /**
     * Generate a Binaryen expression for an input (reporter block).
     * @param {IntermediateInput} block Input node to compile.
     * @returns {number} Binaryen expression index
     */
    descendInput (block) {
        const node = block.inputs;
        const m = this.wasmModule;

        switch (block.opcode) {
        case InputOpcode.NOP:
            // Return empty string handle
            // TODO: Allocate and return empty string reference
            return m.i32.const(0);

        case InputOpcode.CONSTANT:
            return this.compileConstant(block);

        case InputOpcode.PROCEDURE_ARGUMENT: {
            // Parameters are passed as locals p0, p1, etc.
            const paramIdx = node.index;
            return m.local.get(paramIdx, this.boxedType);
        }

        case InputOpcode.CAST_BOOLEAN:
            return m.call(
                'host_toBoolean',
                [this.descendInput(node.target)],
                binaryen.i32
            );

        case InputOpcode.CAST_NUMBER: {
            const targetInput = node.target.toType(InputType.NUMBER_OR_NAN);
            return m.call(
                'host_toNotNaN',
                [this.descendInput(targetInput)],
                binaryen.f64
            );
        }

        case InputOpcode.CAST_NUMBER_OR_NAN:
            return m.f64.trunc(
                m.f64.convert_s.i32(this.descendInput(node.target))
            );

        case InputOpcode.CAST_NUMBER_INDEX:
            return m.i32.trunc_s.f64(
                this.descendInput(node.target.toType(InputType.NUMBER_OR_NAN))
            );

        case InputOpcode.CAST_STRING:
            // TODO: Convert value to string
            return m.i32.const(0);

        case InputOpcode.CAST_COLOR:
            return m.call('host_colorToList', [this.descendInput(node.target)], binaryen.i32);

        // ====== OPERATORS ======
        case InputOpcode.OP_ADD: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.f64.add(left, right);
        }

        case InputOpcode.OP_SUBTRACT: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.f64.sub(left, right);
        }

        case InputOpcode.OP_MULTIPLY: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.f64.mul(left, right);
        }

        case InputOpcode.OP_DIVIDE: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.f64.div(left, right);
        }

        case InputOpcode.OP_MOD: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.call('host_mod', [left, right], binaryen.f64);
        }

        case InputOpcode.OP_ROUND:
            return m.f64.nearest(this.descendInput(node.value));

        case InputOpcode.OP_ABS:
            return m.f64.abs(this.descendInput(node.value));

        case InputOpcode.OP_FLOOR:
            return m.f64.floor(this.descendInput(node.value));

        case InputOpcode.OP_CEILING:
            return m.f64.ceil(this.descendInput(node.value));

        case InputOpcode.OP_SQRT:
            return m.f64.sqrt(this.descendInput(node.value));

        case InputOpcode.OP_SIN:
            return m.f64.sin(m.f64.mul(this.descendInput(node.value), m.f64.const(Math.PI / 180)));

        case InputOpcode.OP_COS:
            return m.f64.cos(m.f64.mul(this.descendInput(node.value), m.f64.const(Math.PI / 180)));

        case InputOpcode.OP_TAN:
            return m.call('host_tan', [this.descendInput(node.value)], binaryen.f64);

        case InputOpcode.OP_ASIN:
            return m.f64.mul(m.f64.asin(this.descendInput(node.value)), m.f64.const(180 / Math.PI));

        case InputOpcode.OP_ACOS:
            return m.f64.mul(m.f64.acos(this.descendInput(node.value)), m.f64.const(180 / Math.PI));

        case InputOpcode.OP_ATAN:
            return m.f64.mul(m.f64.atan(this.descendInput(node.value)), m.f64.const(180 / Math.PI));

        case InputOpcode.OP_LOG_E:
            return m.f64.log(this.descendInput(node.value));

        case InputOpcode.OP_LOG_10: {
            const val = this.descendInput(node.value);
            return m.f64.div(m.f64.log(val), m.f64.const(Math.LN10));
        }

        case InputOpcode.OP_POW_E:
            return m.f64.exp(this.descendInput(node.value));

        case InputOpcode.OP_POW_10:
            return m.f64.pow(m.f64.const(10), this.descendInput(node.value));

        case InputOpcode.OP_EQUALS: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.call('host_compareEqual', [left, right], binaryen.i32);
        }

        case InputOpcode.OP_GREATER: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.call('host_compareGreaterThan', [left, right], binaryen.i32);
        }

        case InputOpcode.OP_LESS: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.call('host_compareLessThan', [left, right], binaryen.i32);
        }

        case InputOpcode.OP_AND: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.i32.and(
                m.call('host_toBoolean', [left], binaryen.i32),
                m.call('host_toBoolean', [right], binaryen.i32)
            );
        }

        case InputOpcode.OP_OR: {
            const left = this.descendInput(node.left);
            const right = this.descendInput(node.right);
            return m.i32.or(
                m.call('host_toBoolean', [left], binaryen.i32),
                m.call('host_toBoolean', [right], binaryen.i32)
            );
        }

        case InputOpcode.OP_NOT: {
            const val = this.descendInput(node.value);
            return m.i32.xor(m.call('host_toBoolean', [val], binaryen.i32), m.i32.const(1));
        }

        case InputOpcode.OP_RANDOM:
            if (node.low.isAlwaysType(InputType.NUMBER_INT) && node.high.isAlwaysType(InputType.NUMBER_INT)) {
                return m.f64.convert_s.i32(m.call('host_randomInt',
                    [m.i32.trunc_s.f64(this.descendInput(node.low)), m.i32.trunc_s.f64(this.descendInput(node.high))],
                    binaryen.i32
                ));
            }
            return m.call(
                'host_randomFloat',
                [this.descendInput(node.low), this.descendInput(node.high)],
                binaryen.f64
            );

        // ====== MOTION ======
        case InputOpcode.MOTION_X_GET:
            return m.f64.const(0); // TODO: Read from sprite object via host
        case InputOpcode.MOTION_Y_GET:
            return m.f64.const(0); // TODO: Read from sprite object via host
        case InputOpcode.MOTION_DIRECTION_GET:
            return m.f64.const(0); // TODO: Read from sprite object via host

        // ====== LOOKS ======
        case InputOpcode.LOOKS_SIZE_GET:
            return m.f64.const(100); // TODO: Read from sprite
        case InputOpcode.LOOKS_COSTUME_NAME:
            return m.i32.const(0); // TODO: String reference
        case InputOpcode.LOOKS_COSTUME_NUMBER:
            return m.f64.const(1);
        case InputOpcode.LOOKS_BACKDROP_NAME:
            return m.i32.const(0); // TODO: String reference
        case InputOpcode.LOOKS_BACKDROP_NUMBER:
            return m.f64.const(1);

        // ====== SENSING ======
        case InputOpcode.SENSING_MOUSE_X:
            return m.f64.const(0); // TODO: Call host
        case InputOpcode.SENSING_MOUSE_Y:
            return m.f64.const(0); // TODO: Call host
        case InputOpcode.SENSING_MOUSE_DOWN:
            return m.i32.const(0); // TODO: Call host
        case InputOpcode.SENSING_KEY_DOWN:
            return m.i32.const(0); // TODO: Call host with key name
        case InputOpcode.SENSING_TIMER_GET:
            return m.f64.const(0); // TODO: Call host
        case InputOpcode.SENSING_TIME_DAYS_SINCE_2000:
            return m.call('host_daysSince2000', [], binaryen.f64);

        // ====== VARIABLES & LISTS ======
        case InputOpcode.VAR_GET: {
            const varRef = this.allocateVariableReference(node.variable.id);
            return m.call('host_getVariable', [m.i32.const(varRef)], binaryen.i32);
        }

        case InputOpcode.LIST_GET:
            return m.call('host_listGet', [
                this.descendInput(node.list),
                this.descendInput(node.index)
            ], binaryen.i32);

        case InputOpcode.LIST_LENGTH:
            return m.f64.convert_s.i32(m.call('host_listLength', [this.descendInput(node.list)], binaryen.i32));

        case InputOpcode.LIST_CONTAINS:
            return m.call('host_listContains', [
                this.descendInput(node.list),
                this.descendInput(node.item)
            ], binaryen.i32);

        case InputOpcode.LIST_INDEX_OF:
            return m.f64.convert_s.i32(m.call(
                'host_listIndexOf',
                [this.descendInput(node.list), this.descendInput(node.item)],
                binaryen.i32
            ));

        case InputOpcode.LIST_CONTENTS:
            return m.call('host_listContents', [this.descendInput(node.list)], binaryen.i32);

        case InputOpcode.COMPATIBILITY_LAYER:
        case InputOpcode.OLD_COMPILER_COMPATIBILITY_LAYER:
        default:
            throw new Error(`WASM: Unhandled input opcode: ${block.opcode}`);
        }
    }

    /**
     * Compile a constant input.
     * @param {IntermediateInput} block Constant block
     * @returns {number} Binaryen expression
     */
    compileConstant (block) {
        const m = this.wasmModule;
        const constVal = block.inputs.value;

        if (block.isAlwaysType(InputType.NUMBER)) {
            if (typeof constVal !== 'number') {
                throw new Error(
                    `WASM: '${block.type}' type constant had ` +
                    `${typeof constVal} type value. Expected number.`
                );
            }
            // TODO: Box the number
            return m.f64.const(constVal);
        }
        if (block.isAlwaysType(InputType.BOOLEAN)) {
            if (typeof constVal !== 'boolean') {
                throw new Error(
                    `WASM: '${block.type}' type constant had ` +
                    `${typeof constVal} type value. Expected boolean.`
                );
            }
            return m.i32.const(constVal ? 1 : 0);
        }
        if (block.isAlwaysType(InputType.COLOR)) {
            if (!Array.isArray(constVal)) {
                throw new Error(
                    `WASM: '${block.type}' type constant was not an array.`
                );
            }
            // TODO: Allocate color array reference
            return m.i32.const(0);
        }
        // String constant
        const strRef = this.allocateStringReference(constVal.toString());
        return m.i32.const(strRef);
    }

    /**
     * Allocate a reference to a string value in the host.
     * @param {string} _value The string value
     * @returns {number} Reference ID
     */
    allocateStringReference () {
        // TODO: Store string in host and return reference ID
        return this.nextReferenceId++;
    }

    /**
     * Allocate a reference to a variable in the host.
     * @param {string} variableId The variable ID
     * @returns {number} Reference ID
     */
    allocateVariableReference (variableId) {
        if (!this.variableReferenceMap.has(variableId)) {
            this.variableReferenceMap.set(variableId, this.nextReferenceId++);
        }
        return this.variableReferenceMap.get(variableId);
    }

    /**
     * Generate Binaryen code for a command block (stack block).
     * @param {IntermediateStackBlock} block Stack block to compile
     * @returns {number} Binaryen expression index
     */
    descendStackBlock (block) {
        const m = this.wasmModule;

        switch (block.opcode) {
        case StackOpcode.NOP:
            return m.nop();

        // ====== MOTION ======
        case StackOpcode.MOTION_MOVESTEPS:
        case StackOpcode.MOTION_TURNRIGHT:
        case StackOpcode.MOTION_TURNLEFT:
        case StackOpcode.MOTION_GOTOXY:
        case StackOpcode.MOTION_GOTOX:
        case StackOpcode.MOTION_GOTOY:
        case StackOpcode.MOTION_IFLONEDGEBOUNCEBACK:
        case StackOpcode.MOTION_SETROTATIONSTYLE:
            // TODO: Delegate to compatibility layer
            return this.generateCompatibilityLayerCall(block);

        // ====== LOOKS ======
        case StackOpcode.LOOKS_SAY:
        case StackOpcode.LOOKS_SAYFORSECS:
        case StackOpcode.LOOKS_THINK:
        case StackOpcode.LOOKS_THINKFORSECS:
        case StackOpcode.LOOKS_SHOW:
        case StackOpcode.LOOKS_HIDE:
        case StackOpcode.LOOKS_SWITCHCOSTUMETO:
        case StackOpcode.LOOKS_NEXTCOSTUME:
        case StackOpcode.LOOKS_SWITCHBACKDROPTO:
        case StackOpcode.LOOKS_NEXTBACKDROP:
            // TODO: Delegate to compatibility layer
            return this.generateCompatibilityLayerCall(block);

        // ====== SOUND ======
        case StackOpcode.SOUND_PLAY:
        case StackOpcode.SOUND_PLAYUNTILDONE:
        case StackOpcode.SOUND_STOP:
            // TODO: Delegate to compatibility layer
            return this.generateCompatibilityLayerCall(block);

        // ====== CONTROL ======
        case StackOpcode.CONTROL_WAIT:
            return this.generateWait(block);

        case StackOpcode.CONTROL_REPEAT:
            return this.generateRepeat(block);

        case StackOpcode.CONTROL_WHILE:
            return this.generateWhile(block);

        case StackOpcode.CONTROL_FOR:
            return this.generateFor(block);

        case StackOpcode.CONTROL_IF_ELSE:
            return this.generateIfElse(block);

        case StackOpcode.CONTROL_WAIT_UNTIL:
            return this.generateWaitUntil(block);

        case StackOpcode.CONTROL_STOP_ALL:
        case StackOpcode.CONTROL_STOP_SCRIPT:
        case StackOpcode.CONTROL_STOP_OTHERS:
            return this.generateCompatibilityLayerCall(block);

        // ====== DATA (VARIABLES & LISTS) ======
        case StackOpcode.DATA_SETVARIABLETO:
            return this.generateSetVariable(block);

        case StackOpcode.DATA_CHANGEVARIABLEBY:
            return this.generateChangeVariable(block);

        case StackOpcode.DATA_LISTAPPEND:
        case StackOpcode.DATA_LISTREPLACEITEM:
        case StackOpcode.DATA_LISTINSERTITEM:
        case StackOpcode.DATA_LISTDELETEITEM:
            // TODO: List operations
            return this.generateCompatibilityLayerCall(block);

        // ====== EVENT ======
        case StackOpcode.EVENT_BROADCASTANDWAIT:
        case StackOpcode.EVENT_BROADCAST:
            // TODO: Handle broadcast with yielding
            return this.generateCompatibilityLayerCall(block);

        // ====== PROCEDURES ======
        case StackOpcode.PROCEDURES_CALL:
            return this.generateProcedureCall(block);

        default: {
            // Unknown opcode - delegate to compatibility layer
            const msg = `WASM: Unhandled stack opcode: ${block.opcode}, ` +
                        'falling back to compatibility layer';
            log.warn(msg);
            return this.generateCompatibilityLayerCall(block);
        }
        }
    }

    /**
     * Generate code for wait block.
     * @param {IntermediateStackBlock} _block
     * @returns {number} Binaryen expression
     */
    generateWait () {
        // TODO: Generate wait loop with yielding
        const m = this.wasmModule;
        return m.nop();
    }

    /**
     * Generate code for repeat block.
     * @param {IntermediateStackBlock} block
     * @returns {number} Binaryen expression
     */
    generateRepeat (block) {
        // TODO: Generate repeat loop with yielding
        const m = this.wasmModule;
        if (block.inputs.stack) {
            return this.descendStack(block.inputs.stack, new Frame(true));
        }
        return m.nop();
    }

    /**
     * Generate code for while block.
     * @param {IntermediateStackBlock} block
     * @returns {number} Binaryen expression
     */
    generateWhile (block) {
        // TODO: Generate while loop with condition and yielding
        const m = this.wasmModule;
        if (block.inputs.stack) {
            return this.descendStack(block.inputs.stack, new Frame(true));
        }
        return m.nop();
    }

    /**
     * Generate code for for loop.
     * @param {IntermediateStackBlock} block
     * @returns {number} Binaryen expression
     */
    generateFor (block) {
        // TODO: Generate for loop with counter variable
        const m = this.wasmModule;
        if (block.inputs.stack) {
            return this.descendStack(block.inputs.stack, new Frame(true));
        }
        return m.nop();
    }

    /**
     * Generate code for if/else block.
     * @param {IntermediateStackBlock} block
     * @returns {number} Binaryen expression
     */
    generateIfElse (block) {
        const m = this.wasmModule;
        const condition = this.descendInput(block.inputs.condition);

        let trueBranch = m.nop();
        if (block.inputs.ifStack) {
            trueBranch = this.descendStack(block.inputs.ifStack, new Frame(false));
        }

        let falseBranch = m.nop();
        if (block.inputs.elseStack) {
            falseBranch = this.descendStack(block.inputs.elseStack, new Frame(false));
        }

        return m.if(condition, trueBranch, falseBranch);
    }

    /**
     * Generate code for wait until block.
     * @returns {number} Binaryen expression
     */
    generateWaitUntil () {
        // TODO: Generate wait until loop with condition
        const m = this.wasmModule;
        return m.nop();
    }

    /**
     * Generate code for set variable block.
     * @param {IntermediateStackBlock} block
     * @returns {number} Binaryen expression
     */
    generateSetVariable (block) {
        const m = this.wasmModule;
        const varRef = this.allocateVariableReference(block.inputs.variable.id);
        const value = this.descendInput(block.inputs.value);
        
        return m.call('host_setVariableValue', [
            m.call('host_getVariable', [m.i32.const(varRef)], binaryen.i32),
            value
        ], binaryen.none);
    }

    /**
     * Generate code for change variable block.
     * @returns {number} Binaryen expression
     */
    generateChangeVariable () {
        // TODO: Get current value, add delta, set back
        const m = this.wasmModule;
        return m.nop();
    }

    /**
     * Generate code for procedure call.
     * @returns {number} Binaryen expression
     */
    generateProcedureCall () {
        // TODO: Call procedure function with proper arguments
        const m = this.wasmModule;
        return m.nop();
    }

    /**
     * Generate a compatibility layer call for unsupported blocks.
     * @returns {number} Binaryen expression
     */
    generateCompatibilityLayerCall () {
        // TODO: Call host_executeCompat
        const m = this.wasmModule;
        return m.nop();
    }

    /**
     * Descend into a stack of blocks.
     * @param {IntermediateStack} stack The stack to descend
     * @param {Frame} frame The current frame
     * @returns {number} Binaryen expression block
     */
    descendStack (stack, frame) {
        const m = this.wasmModule;
        const expressions = [];

        this.pushFrame(frame);

        if (stack) {
            for (let i = 0; i < stack.length; i++) {
                const block = stack[i];
                if (i === stack.length - 1) {
                    frame.isLastBlock = true;
                }
                const expr = this.descendStackBlock(block);
                if (typeof expr !== 'undefined' && expr !== null) {
                    expressions.push(expr);
                }
            }
        }

        this.popFrame();

        if (expressions.length === 0) {
            return m.nop();
        } else if (expressions.length === 1) {
            return expressions[0];
        }
        return m.block('stack_block', expressions);
    }

    /**
     * Build the actual WASM module body.
     * @private
     */
    buildModuleBody () {
        const m = this.wasmModule;

        // Allocate locals for parameters
        const paramLocals = [];
        for (let i = 0; i < this.script.arguments.length; i++) {
            paramLocals.push(binaryen.i32);
        }

        // Descend script body
        let body = m.nop();
        if (this.script.stack) {
            body = this.descendStack(this.script.stack, new Frame(false));
        }

        // Add return statement (implicit or explicit)
        if (this.script.yields) {
            // Generator functions yield implicitly
        } else {
            // Non-generator functions return
            body = m.block('script_body', [body]);
        }

        // Create the main function
        const funcName = this.getScriptName();
        const returnType = binaryen.none;
        const paramTypes = paramLocals;

        m.addFunction(
            funcName,
            binaryen.createType(paramTypes),
            returnType,
            paramLocals.slice(this.script.arguments.length), // Locals beyond parameters
            body
        );

        // Export the function
        m.addExport(funcName, funcName);

        // Validate module - validate() returns 0 for invalid, 1 for valid
        if (m.validate() === 0) {
            throw new Error('Generated WASM module failed validation');
        }

        // Optimize
        m.optimize();

        return m;
    }

    /**
     * Compile the script and return a factory function.
     * @returns {Function} Factory function that creates the generator function
     */
    compile () {
        try {
            // Build the WASM module
            this.buildModuleBody();

            const factory = this.createScriptFactory();

            if (this.debug) {
                log.info(`WASM: ${this.target.getName()}: compiled ${this.script.procedureCode || 'script'}`);
            }

            return factory;
        } catch (err) {
            // Fall back to JS generator on error
            const msg = `WASM: Compilation failed for ${this.script.procedureCode || 'script'}, ` +
                        `falling back to JS: ${err.message}`;
            log.warn(msg);
            throw err;
        }
    }

    /**
     * Create a factory function that instantiates the WASM module and returns a generator function.
     * @returns {Function} Factory function
     */
    createScriptFactory () {
        const self = this;
        const scriptName = this.getScriptName();

        // Convert Binaryen module to binary
        let wasmBinary;
        try {
            wasmBinary = self.wasmModule.emitBinary();
            console.log(self.wasmModule.emitText()); // For debugging
        } catch (err) {
            log.warn('Failed to emit WASM binary:', err.message);
            throw err;
        }

        return function factory (thread) {
            const target = thread.target;
            const _runtime = target.runtime;
            // TODO: Use stage for coordinate conversions

            // Create host imports with proper global state
            const globalState = {
                Timer: require('../util/timer'),
                Cast: require('../util/cast'),
                log: require('../util/log'),
                blockUtility: require('./compat-block-utility'),
                thread: thread
            };

            const imports = createWasmHostImports(globalState);

            // Instantiate WASM module
            let wasmInstance;
            try {
                const wasmModule = new WebAssembly.Module(wasmBinary);
                wasmInstance = new WebAssembly.Instance(wasmModule, imports);
            } catch (err) {
                log.error('Failed to instantiate WASM module:', err.message);
                throw err;
            }

            // Get the exported function
            const exportedFunc = wasmInstance.exports[scriptName];
            if (!exportedFunc || typeof exportedFunc !== 'function') {
                throw new Error(`WASM module missing export: ${scriptName}`);
            }

            // If the script yields, wrap in generator; otherwise just call it
            if (self.script.yields) {
                return function* gen (...args) {
                    yield;
                    const result = exportedFunc(...args);
                    return result;
                };
            }
            return function (...args) {
                return exportedFunc(...args);
            };
        };
    }

    /**
     * Get the name of the script factory function.
     * @returns {string} Factory function name
     */
    getScriptFactoryName () {
        return `wasmFactory_${this.isProcedure ? 'proc' : 'script'}`;
    }

    /**
     * Get the name of the script function.
     * @returns {string} Function/generator name
     */
    getScriptName () {
        let name = this.script.yields ? 'gen' : 'fun';
        if (this.isProcedure) {
            const simplifiedProcedureCode = this.script.procedureCode
                .replace(/%[\w]/g, '') // remove arguments
                .replace(/[^a-zA-Z0-9]/g, '_') // remove unsafe
                .substring(0, 20); // keep length reasonable
            name += `_${simplifiedProcedureCode}`;
        }
        return name;
    }
}

module.exports = WasmGenerator;
