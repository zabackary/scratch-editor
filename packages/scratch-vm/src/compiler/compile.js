// @ts-check

const {IRGenerator} = require('./irgen');
const {IROptimizer} = require('./iroptimizer');
const {compileWithFallback, WASM_GENERATOR} = require('./wasm-integration.js');

const compile = (/** @type {import("../engine/thread")} */ thread) => {
    console.info('yay');
    const irGenerator = new IRGenerator(thread);
    const ir = irGenerator.generate();

    const irOptimizer = new IROptimizer(ir);
    irOptimizer.optimize();

    const procedures = {};
    const target = thread.target;

    const compileScript = (/** @type {import("./intermediate").IntermediateScript} */ script) => {
        if (script.cachedCompileResult) {
            return script.cachedCompileResult;
        }

        // Use WASM generator if enabled, with automatic fallback to JS
        const result = compileWithFallback(script, ir, target, WASM_GENERATOR.enabled);
        script.cachedCompileResult = result;
        return result;
    };

    const entry = compileScript(ir.entry);

    for (const procedureVariant of Object.keys(ir.procedures)) {
        const procedureData = ir.procedures[procedureVariant];
        const procedureTree = compileScript(procedureData);
        procedures[procedureVariant] = procedureTree;
    }

    return {
        startingFunction: entry,
        procedures,
        executableHat: ir.entry.executableHat
    };
};

module.exports = compile;
