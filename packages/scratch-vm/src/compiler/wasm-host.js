// @ts-check
/**
 * @fileoverview Host imports for WASM-compiled scripts.
 *
 * This module provides all the host functions that WASM-generated code
 * can call to access the Scratch runtime. These functions bridge the gap
 * between pure computation in WASM and system access in JavaScript.
 */

/* eslint-disable no-unused-vars */
/* eslint-disable no-extend-native */

/**
 * Creates a host import object for a WASM module.
 *
 * @param {Object} globalState - The global execution state containing thread, runtime, etc.
 * @returns {Object} An object with all host import functions
 */
const createWasmHostImports = globalState => {
    const imports = {
        /** @type {Record<string, Function>} */
        env: {}
    };

    // ============================================================================
    // TYPE CONVERSIONS & CASTING
    // ============================================================================

    /**
     * Scratch cast to boolean.
     * Similar to Cast.toBoolean()
     * @param {unknown} value The value to cast
     * @returns {number} The value cast to a boolean (0 = false, 1 = true)
     */
    imports.env.host_toBoolean = value => {
        if (typeof value === 'boolean') {
            return value ? 1 : 0;
        }
        if (typeof value === 'string') {
            if (value === '' || value === '0' || value.toLowerCase() === 'false') {
                return 0;
            }
            return 1;
        }
        return value ? 1 : 0;
    };

    /**
     * Converts NaN to zero. Used to match Scratch's string-to-number.
     * @param {number} value A number. Might be NaN.
     * @returns {number} A number. Never NaN.
     */
    imports.env.host_toNotNaN = value => (Number.isNaN(value) ? 0 : value);

    /**
     * If a number is very close to a whole number, round to that whole number.
     * @param {number} value Value to round
     * @returns {number} Rounded number or original number
     */
    imports.env.host_limitPrecision = value => {
        const rounded = Math.round(value);
        const delta = value - rounded;
        return (Math.abs(delta) < 1e-9) ? rounded : value;
    };

    // ============================================================================
    // COMPARISONS (Scratch semantics)
    // ============================================================================

    /**
     * Helper to check if a value should not be treated as zero.
     * @private
     */
    const isNotActuallyZero = val => {
        if (typeof val !== 'string') return false;
        for (let i = 0; i < val.length; i++) {
            const code = val.charCodeAt(i);
            if (code === 48 || code === 9) { // '0' or tab
                return false;
            }
        }
        return true;
    };

    /**
     * Determine if two values are equal (Scratch semantics).
     * @param {unknown} v1 First value
     * @param {unknown} v2 Second value
     * @returns {number} 1 if equal, 0 otherwise
     */
    imports.env.host_compareEqual = (v1, v2) => {
        if ((typeof v1 === 'number' && typeof v2 === 'number' && !Number.isNaN(v1) && !Number.isNaN(v2)) || v1 === v2) {
            return (v1 === v2) ? 1 : 0;
        }
        const n1 = +v1;
        if (Number.isNaN(n1) || (n1 === 0 && isNotActuallyZero(v1))) {
            return ((`${v1}`).toLowerCase() === (`${v2}`).toLowerCase()) ? 1 : 0;
        }
        const n2 = +v2;
        if (Number.isNaN(n2) || (n2 === 0 && isNotActuallyZero(v2))) {
            return ((`${v1}`).toLowerCase() === (`${v2}`).toLowerCase()) ? 1 : 0;
        }
        return (n1 === n2) ? 1 : 0;
    };

    /**
     * Determine if one value is greater than another.
     * @param {unknown} v1 First value
     * @param {unknown} v2 Second value
     * @returns {number} 1 if v1 > v2, 0 otherwise
     */
    imports.env.host_compareGreaterThan = (v1, v2) => {
        if (typeof v1 === 'number' && typeof v2 === 'number' && !Number.isNaN(v1)) {
            return (v1 > v2) ? 1 : 0;
        }
        let n1 = +v1;
        let n2 = +v2;
        if (n1 === 0 && isNotActuallyZero(v1)) {
            n1 = NaN;
        } else if (n2 === 0 && isNotActuallyZero(v2)) {
            n2 = NaN;
        }
        if (Number.isNaN(n1) || Number.isNaN(n2)) {
            const s1 = (`${v1}`).toLowerCase();
            const s2 = (`${v2}`).toLowerCase();
            return (s1 > s2) ? 1 : 0;
        }
        return (n1 > n2) ? 1 : 0;
    };

    /**
     * Determine if one value is less than another.
     * @param {unknown} v1 First value
     * @param {unknown} v2 Second value
     * @returns {number} 1 if v1 < v2, 0 otherwise
     */
    imports.env.host_compareLessThan = (v1, v2) => {
        if (typeof v1 === 'number' && typeof v2 === 'number' && !Number.isNaN(v2)) {
            return (v1 < v2) ? 1 : 0;
        }
        let n1 = +v1;
        let n2 = +v2;
        if (n1 === 0 && isNotActuallyZero(v1)) {
            n1 = NaN;
        } else if (n2 === 0 && isNotActuallyZero(v2)) {
            n2 = NaN;
        }
        if (Number.isNaN(n1) || Number.isNaN(n2)) {
            const s1 = (`${v1}`).toLowerCase();
            const s2 = (`${v2}`).toLowerCase();
            return (s1 < s2) ? 1 : 0;
        }
        return (n1 < n2) ? 1 : 0;
    };

    // ============================================================================
    // MATH UTILITIES
    // ============================================================================

    /**
     * Generate a random integer.
     * @param {number} low Lower bound
     * @param {number} high Upper bound
     * @returns {number} A random integer between low and high, inclusive.
     */
    imports.env.host_randomInt = (low, high) => {
        low = Math.floor(low);
        high = Math.floor(high);
        return low + Math.floor(Math.random() * ((high + 1) - low));
    };

    /**
     * Generate a random float.
     * @param {number} low Lower bound
     * @param {number} high Upper bound
     * @returns {number} A random floating point number between low and high.
     */
    imports.env.host_randomFloat = (low, high) => (Math.random() * (high - low)) + low;

    /**
     * Implements Scratch modulo (floored division instead of truncated division)
     * @param {number} n Number
     * @param {number} modulus Base
     * @returns {number} n % modulus (floored division)
     */
    imports.env.host_mod = (n, modulus) => {
        let result = n % modulus;
        if (result / modulus < 0) result += modulus;
        return result;
    };

    /**
     * Implements Scratch tangent.
     * @param {number} angle Angle in degrees.
     * @returns {number} value of tangent or Infinity or -Infinity
     */
    imports.env.host_tan = angle => {
        switch (angle % 360) {
        case -270: case 90: return Infinity;
        case -90: case 270: return -Infinity;
        }
        return Math.round(Math.tan((Math.PI * angle) / 180) * 1e10) / 1e10;
    };

    /**
     * Returns the amount of days since January 1st, 2000.
     * @returns {number} Days since 2000.
     */
    imports.env.host_daysSince2000 = () => (Date.now() - 946684800000) / (24 * 60 * 60 * 1000);

    /**
     * Determine distance to a sprite or point.
     * @param {number} menuPtr Pointer to sprite/menu name in WASM memory
     * @param {number} menuLen Length of menu name string
     * @returns {number} Distance to the point, or 10000 if it cannot be calculated.
     */
    imports.env.host_distance = (menuPtr, menuLen) => {
        const thread = globalState.thread;
        if (thread.target.isStage) return 10000;

        // TODO: Read string from WASM memory
        // For now, we'll require the distance function to be called from the compatibility layer
        return 10000;
    };

    // ============================================================================
    // LIST OPERATIONS
    // ============================================================================

    /**
     * Convert a Scratch list index to a JavaScript list index.
     * "all" is not considered as a list index.
     * @param {number} index Scratch list index.
     * @param {number} length Length of the list.
     * @returns {number} 0 based list index, or -1 if invalid.
     */
    const listIndex = (index, length) => {
        if (typeof index === 'string') {
            if (index === 'last') {
                return length - 1;
            } else if (index === 'random' || index === 'any') {
                if (length > 0) {
                    return (Math.random() * length) | 0;
                }
                return -1;
            }
            index = (+index || 0) | 0;
        } else {
            index = index | 0;
        }
        if (index < 1 || index > length) {
            return -1;
        }
        return index - 1;
    };

    /**
     * Get a value from a list.
     * @param {unknown} list The list variable object
     * @param {unknown} idx The 1-indexed index in the list.
     * @returns {unknown} The list item, otherwise empty string if it does not exist.
     */
    imports.env.host_listGet = (list, idx) => {
        const index = listIndex(idx, list.value.length);
        if (index === -1) {
            return '';
        }
        return list.value[index];
    };

    /**
     * Replace a value in a list.
     * @param {unknown} list The list variable object
     * @param {unknown} idx List index, Scratch style.
     * @param {unknown} value The new value.
     */
    imports.env.host_listReplace = (list, idx, value) => {
        const index = listIndex(idx, list.value.length);
        if (index === -1) {
            return;
        }
        list.value[index] = value;
        list._monitorUpToDate = false;
    };

    /**
     * Insert a value in a list.
     * @param {unknown} list The list variable object.
     * @param {unknown} idx The Scratch index in the list.
     * @param {unknown} value The value to insert.
     */
    imports.env.host_listInsert = (list, idx, value) => {
        const index = listIndex(idx, list.value.length + 1);
        if (index === -1) {
            return;
        }
        list.value.splice(index, 0, value);
        list._monitorUpToDate = false;
    };

    /**
     * Delete a value from a list.
     * @param {unknown} list The list variable object.
     * @param {unknown} idx The Scratch index in the list.
     */
    imports.env.host_listDelete = (list, idx) => {
        if (idx === 'all') {
            list.value = [];
            list._monitorUpToDate = false;
            return;
        }
        const index = listIndex(idx, list.value.length);
        if (index === -1) {
            return;
        }
        list.value.splice(index, 1);
        list._monitorUpToDate = false;
    };

    /**
     * Return whether a list contains a value.
     * @param {unknown} list The list variable object.
     * @param {unknown} item The value to search for.
     * @returns {number} 1 if the list contains the item, 0 otherwise
     */
    imports.env.host_listContains = (list, item) => {
        if (list.value.indexOf(item) !== -1) {
            return 1;
        }
        for (let i = 0; i < list.value.length; i++) {
            if (imports.env.host_compareEqual(list.value[i], item)) {
                return 1;
            }
        }
        return 0;
    };

    /**
     * Find the 1-indexed index of an item in a list.
     * @param {unknown} list The list variable object.
     * @param {unknown} item The item to search for
     * @returns {number} The 1-indexed index of the item in the list, otherwise 0
     */
    imports.env.host_listIndexOf = (list, item) => {
        for (let i = 0; i < list.value.length; i++) {
            if (imports.env.host_compareEqual(list.value[i], item)) {
                return i + 1;
            }
        }
        return 0;
    };

    /**
     * Get the length of a list.
     * @param {unknown} list The list variable object.
     * @returns {number} The length of the list.
     */
    imports.env.host_listLength = list => list.value.length;

    /**
     * Convert a list to a stringified form.
     * @param {unknown} list The list variable object.
     * @returns {string} Stringified form of the list.
     */
    imports.env.host_listContents = list => {
        for (let i = 0; i < list.value.length; i++) {
            const listItem = list.value[i];
            if ((`${listItem}`).length !== 1) {
                return list.value.join(' ');
            }
        }
        return list.value.join('');
    };

    // ============================================================================
    // COLOR CONVERSION
    // ============================================================================

    /**
     * Convert a color to an RGB list
     * @param {unknown} color The color value to convert
     * @return {unknown} Array [r,g,b], values between 0-255.
     */
    imports.env.host_colorToList = color => globalState.Cast.toRgbColorList(color);

    // ============================================================================
    // THREAD & CONTROL FLOW
    // ============================================================================

    /**
     * Determine whether the current tick is likely stuck.
     * This implements similar functionality to the warp timer found in Scratch.
     * @returns {number} 1 if stuck, 0 otherwise
     */
    let stuckCounter = 0;
    imports.env.host_isStuck = () => {
        stuckCounter++;
        if (stuckCounter === 100) {
            stuckCounter = 0;
            const elapsed = globalState.thread.target.runtime.sequencer.timer.timeElapsed();
            return elapsed > 500 ? 1 : 0;
        }
        return 0;
    };

    /**
     * End the current script.
     */
    imports.env.host_retire = () => {
        const thread = globalState.thread;
        thread.target.runtime.sequencer.retireThread(thread);
    };

    /**
     * Create and start a timer.
     * @returns {unknown} A started timer object
     */
    imports.env.host_timer = () => {
        const Timer = globalState.Timer;
        const t = new Timer({
            now: () => globalState.thread.target.runtime.currentMSecs
        });
        t.start();
        return t;
    };

    // ============================================================================
    // HAT BLOCKS & THREAD MANAGEMENT
    // ============================================================================

    /**
     * Start hats by opcode.
     * @param {unknown} requestedHat The opcode of the hat to start.
     * @param {unknown} optMatchFields Fields to match.
     * @returns {unknown} A list of threads that were started.
     */
    imports.env.host_startHats = (requestedHat, optMatchFields) => {
        const thread = globalState.thread;
        const threads = thread.target.runtime.startHats(requestedHat, optMatchFields);
        return threads;
    };

    /**
     * Create branch info for compatibility layer.
     * @param {number} isLoop 1 if the block is a LOOP, 0 otherwise
     * @returns {unknown} Branch info object
     */
    imports.env.host_createBranchInfo = isLoop => ({
        defaultIsLoop: isLoop !== 0,
        isLoop: false,
        branch: 0,
        stackFrame: {}
    });

    // ============================================================================
    // VARIABLE ACCESS
    // ============================================================================

    /**
     * Get a variable by ID.
     * @param {string} variableId The variable ID
     * @returns {unknown} The variable object
     */
    imports.env.host_getVariable = variableId => {
        const thread = globalState.thread;
        return thread.target.variables[variableId];
    };

    /**
     * Look up a variable by name.
     * @param {unknown} namePtr Pointer to variable name in WASM memory
     * @param {unknown} nameLen Length of variable name
     * @param {unknown} varType The variable type ('list' or undefined)
     * @param {number} searchAll 1 to search all sprites, 0 for current target only
     * @returns {unknown} The variable object or null
     */
    imports.env.host_lookupVariable = (namePtr, nameLen, varType, searchAll) => {
        const thread = globalState.thread;
        // TODO: Read variable name from WASM memory
        // For now, return null - should be called from JS compatibility layer
        return null;
    };

    /**
     * Get a variable's value.
     * @param {unknown} variable The variable object
     * @returns {unknown} The variable's current value
     */
    imports.env.host_getVariableValue = variable => variable.value;

    /**
     * Set a variable's value.
     * @param {unknown} variable The variable object
     * @param {unknown} value The new value
     */
    imports.env.host_setVariableValue = (variable, value) => {
        variable.value = value;
        variable._monitorUpToDate = false;
    };

    // ============================================================================
    // COMPATIBILITY LAYER (delegates to old Scratch VM for non-compiled blocks)
    // ============================================================================

    /**
     * Execute a non-compiled block via the compatibility layer.
     * This delegates to the old Scratch VM.
     * @param {unknown} blockFunction The primitive function to execute
     * @param {unknown} inputs The inputs to the block
     * @param {number} isWarp 1 if in warp mode, 0 otherwise
     * @param {number} useFlags 1 to set flags, 0 otherwise
     * @param {string} blockId The block ID
     * @param {unknown} branchInfo Branch info object
     * @returns {unknown} The block's return value
     */
    imports.env.host_executeCompat = (blockFunction, inputs, isWarp, useFlags, blockId, branchInfo) => {
        const thread = globalState.thread;
        const blockUtility = globalState.blockUtility;
        const stackFrame = branchInfo ? branchInfo.stackFrame : {};

        blockUtility.init(thread, blockId, stackFrame);
        const result = blockFunction(inputs, blockUtility);
        
        if (branchInfo && typeof result === 'undefined' && blockUtility._startedBranch) {
            branchInfo.isLoop = blockUtility._startedBranch[1];
            return blockUtility._startedBranch[0];
        }
        
        return result;
    };

    /**
     * Execute a block from the compatibility layer using stored IR block data.
     * @param {number} blockIndex Index into the compatibilityBlocks array
     * @returns {unknown} The block's return value
     */
    imports.env.host_executeCompatBlock = blockIndex => {
        const thread = globalState.thread;
        const runtime = globalState.runtime;
        const blockUtility = globalState.blockUtility;

        // Retrieve the IR block from storage
        const irBlock = globalState.compatibilityBlocks && globalState.compatibilityBlocks[blockIndex];
        if (!irBlock) {
            console.error(`WASM: Compatibility block ${blockIndex} not found`);
            return;
        }

        // Get the opcode function from the runtime
        const blockFunction = runtime.getOpcodeFunction(irBlock.opcode);
        if (!blockFunction) {
            console.error(`WASM: No opcode function for ${irBlock.opcode}`);
            return;
        }

        // Compile the inputs object (shallow - just pass IR inputs directly for now)
        // TODO: This will need to properly traverse IR inputs and compile them
        const inputs = irBlock.inputs || {};

        // Initialize block utility and execute
        const blockId = irBlock.id || 'compat';
        const stackFrame = {};
        
        blockUtility.init(thread, blockId, stackFrame);
        const result = blockFunction(inputs, blockUtility);
        
        // Handle branching (for wait/loop blocks)
        if (typeof result === 'undefined' && blockUtility._startedBranch) {
            // Return the branch info for the scheduler to handle
            return blockUtility._startedBranch[0];
        }
        
        return result;
    };

    // ============================================================================
    // MEMORY MANAGEMENT (for future string/large data support)
    // ============================================================================

    /**
     * Allocate memory from WASM linear memory.
     * @param {number} size Number of bytes to allocate
     * @returns {number} Pointer to allocated memory
     */
    imports.env.host_alloc = size =>
        // TODO: Implement WASM linear memory allocation
        // For now, just return a dummy pointer
        0
    ;

    /**
     * Free previously allocated memory.
     * @param {number} ptr Pointer to memory to free
     */
    imports.env.host_free = ptr => {
        // TODO: Implement WASM linear memory deallocation
    };

    // ============================================================================
    // LOGGING & DEBUG
    // ============================================================================

    /**
     * Log a message (for debugging)
     * @param {string} msg The message to log
     */
    imports.env.host_log = msg => {
        globalState.log.info(msg);
    };

    /**
     * Log a warning (for debugging)
     * @param {string} msg The message to log
     */
    imports.env.host_warn = msg => {
        globalState.log.warn(msg);
    };

    return imports;
};

module.exports = createWasmHostImports;
