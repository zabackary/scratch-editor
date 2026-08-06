// @ts-check

/**
 * @file Integration point for WASM generator with runtime
 *
 * This module shows how to integrate the WASM generator with the Scratch runtime.
 * Currently, this is a placeholder - full integration will require modifying the
 * compilation pipeline in compile.js.
 */

const WasmGenerator = require('./wasm-gen.js');
const JSGenerator = require('./jsgen.js');

/**
 * Try to compile a script with WASM, falling back to JS on error.
 * @param {import("./intermediate.js").IntermediateScript} script The IntermediateScript
 * @param {import("./intermediate.js").IntermediateRepresentation} ir The IntermediateRepresentation
 * @param {import("../sprites/rendered-target.js")} target The sprite target
 * @param {boolean} useWasm Whether to attempt WASM compilation
 * @returns {Function} A factory function that creates a generator
 */
const compileWithFallback = (script, ir, target, useWasm = true) => {
    if (useWasm) {
        try {
            const wasmGen = new WasmGenerator(script, ir, target);
            return wasmGen.compile();
        } catch (err) {
            console.warn(`WASM compilation failed, falling back to JS: ${err.message}`);
        }
    }

    // Fallback to JS
    const jsGen = new JSGenerator(script, ir, target);
    return jsGen.compile();
};

/**
 * Feature flag for WASM compilation.
 *
 * Usage:
 *   WASM_GENERATOR.enabled = false; // Disable WASM
 *   WASM_GENERATOR.enabled = true;  // Re-enable
 */
const WASM_GENERATOR = {
    enabled: true,
    stats: {
        wasmSuccesses: 0,
        wasmFailures: 0,
        jsCompilations: 0
    }
};

module.exports = {
    compileWithFallback,
    WASM_GENERATOR
};
