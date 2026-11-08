const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const sourcePath = path.resolve('assets/scripts/BilliardsTableGeometry.ts');
const compiled = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS},
}).outputText;
const geometryModule = new Module(sourcePath);
geometryModule._compile(compiled, sourcePath);
const {TABLE_GEOMETRY, POCKETS, CUSHION_PATHS} = geometryModule.exports;
fs.mkdirSync('tmp/model-tools', {recursive: true});
fs.writeFileSync('tmp/model-tools/game-table-geometry.json', JSON.stringify({
    dimensions: TABLE_GEOMETRY, pockets: POCKETS, cushions: CUSHION_PATHS,
}, null, 2));
