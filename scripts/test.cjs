const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');

// Compile the pure simulation into a disposable directory; no Creator installation needed.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cocos-billiards-tests-'));
try {
    for (const name of ['BilliardsTableGeometry', 'BilliardsSpin', 'BilliardsPhysics', 'BilliardsRules', 'BilliardsLayout', 'BilliardsPlayers', 'BilliardsShot', 'BilliardsAim', 'BilliardsTheme', 'BilliardsPlayerCard', 'BilliardsShotButton', 'BilliardsSpinPanel', 'BilliardsGame']) {
        const source = fs.readFileSync(`assets/scripts/${name}.ts`, 'utf8');
        const result = ts.transpileModule(source, {
            compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
        });
        fs.writeFileSync(path.join(directory, `${name}.js`), result.outputText);
    }
    const child = spawnSync(process.execPath, ['--test', 'tests/physics.test.cjs', 'tests/pockets.test.cjs', 'tests/rules.test.cjs', 'tests/layout.test.cjs', 'tests/players.test.cjs', 'tests/shot.test.cjs', 'tests/aim.test.cjs', 'tests/game-flow.test.cjs', 'tests/spin.test.cjs'], {
        stdio: 'inherit', env: { ...process.env, BILLIARDS_TEST_MODULE: path.join(directory, 'BilliardsPhysics.js'), BILLIARDS_RULES_MODULE: path.join(directory, 'BilliardsRules.js'), BILLIARDS_LAYOUT_MODULE: path.join(directory, 'BilliardsLayout.js'), BILLIARDS_PLAYERS_MODULE: path.join(directory, 'BilliardsPlayers.js'), BILLIARDS_SHOT_MODULE: path.join(directory, 'BilliardsShot.js'), BILLIARDS_AIM_MODULE: path.join(directory, 'BilliardsAim.js'), BILLIARDS_GAME_MODULE: path.join(directory, 'BilliardsGame.js'), BILLIARDS_SPIN_MODULE: path.join(directory, 'BilliardsSpin.js') },
    });
    process.exitCode = child.status ?? 1;
} finally {
    fs.rmSync(directory, { recursive: true, force: true });
}
