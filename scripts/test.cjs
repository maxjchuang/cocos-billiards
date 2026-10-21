const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');

// Compile the pure simulation into a disposable directory; no Creator installation needed.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-billiards-tests-'));
try {
    for (const name of ['BilliardsPhysics', 'BilliardsRules', 'BilliardsLayout']) {
        const source = fs.readFileSync(`assets/scripts/${name}.ts`, 'utf8');
        const result = ts.transpileModule(source, {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
        });
        fs.writeFileSync(path.join(directory, `${name}.js`), result.outputText);
    }
    const child = spawnSync(process.execPath, ['--test', 'tests/physics.test.cjs', 'tests/rules.test.cjs', 'tests/layout.test.cjs'], {
        stdio: 'inherit', env: { ...process.env, BILLIARDS_TEST_MODULE: path.join(directory, 'BilliardsPhysics.js'), BILLIARDS_RULES_MODULE: path.join(directory, 'BilliardsRules.js'), BILLIARDS_LAYOUT_MODULE: path.join(directory, 'BilliardsLayout.js') },
    });
    process.exitCode = child.status ?? 1;
} finally {
    fs.rmSync(directory, { recursive: true, force: true });
}
