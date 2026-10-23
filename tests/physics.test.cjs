const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validTablePlacement } = require(require('node:path').join(require('node:path').dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsTableGeometry.js'));
const fs = require('node:fs');
const { createRack, FIXED_STEP, isMoving, step, strike, TABLE, POCKETS, respawnCue } = require(process.env.BILLIARDS_TEST_MODULE);

test('rack has 16 distinct balls inside the playing surface without overlaps', () => {
    const balls = createRack();
    assert.equal(balls.length, 16);
    assert.equal(new Set(balls.map(b => b.id)).size, 16);
    for (let i = 0; i < balls.length; i++) {
        assert.ok(Math.abs(balls[i].x) + TABLE.radius <= TABLE.halfWidth);
        assert.ok(Math.abs(balls[i].z) + TABLE.radius <= TABLE.halfLength);
        for (let j = i + 1; j < balls.length; j++) {
            assert.ok(Math.hypot(balls[i].x - balls[j].x, balls[i].z - balls[j].z) >= TABLE.radius * 2);
        }
    }
});

test('strike normalizes direction, caps speed and refuses another moving shot', () => {
    const balls = createRack();
    assert.equal(strike(balls, 0, 0, 2), false);
    assert.equal(strike(balls, NaN, 0, 2), false);
    assert.equal(strike(balls, 0, -10, 99), true);
    assert.equal(balls[0].vz, -TABLE.maxStrikeSpeed);
    assert.equal(strike(balls, 1, 0, 2), false);
});

test('head-on equal-mass collision transfers most forward velocity', () => {
    const balls = [{ id: 0, x: 0, z: 0, vx: 0, vz: -1 },
        { id: 1, x: 0, z: -TABLE.radius * 2 - 0.001, vx: 0, vz: 0 }];
    step(balls, FIXED_STEP);
    assert.ok(balls[1].vz < -0.9);
    assert.ok(Math.abs(balls[0].vz) < 0.1);
});

test('cushion reflects an outgoing ball back into the table', () => {
    const balls = [{ id: 0, x: TABLE.halfWidth - TABLE.radius - 0.001, z: 0.35, vx: 1, vz: 0 }];
    step(balls, FIXED_STEP);
    assert.ok(balls[0].vx < 0);
    assert.ok(balls[0].x <= TABLE.halfWidth - TABLE.radius);
});

test('maximum-power break stays finite, stays on the table, and eventually stops', () => {
    const balls = createRack();
    strike(balls, 0, -1, TABLE.maxStrikeSpeed);
    let targetMoved = false;
    for (let frame = 0; frame < 240 * 30; frame++) {
        step(balls, FIXED_STEP);
        targetMoved ||= balls.slice(1).some(ball => Math.hypot(ball.vx, ball.vz) > 0.01);
        for (const ball of balls) {
            assert.ok([ball.x, ball.z, ball.vx, ball.vz].every(Number.isFinite));
            if (ball.pocketed) continue;
            assert.ok(Math.abs(ball.x) <= TABLE.outerHalfWidth);
            assert.ok(Math.abs(ball.z) <= TABLE.outerHalfLength);
        }
    }
    assert.ok(targetMoved);
    assert.equal(isMoving(balls), false);
});

test('Main scene references the bootstrap script UUID and all serialized IDs exist', () => {
    const scene = JSON.parse(fs.readFileSync('assets/scenes/Main.scene', 'utf8'));
    const meta = JSON.parse(fs.readFileSync('assets/scripts/BilliardsGame.ts.meta', 'utf8'));
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const hex = meta.uuid.replaceAll('-', '');
    let compressed = hex.slice(0, 5);
    for (let i = 5; i < 32; i += 3) {
        const value = parseInt(hex.slice(i, i + 3), 16);
        compressed += alphabet[value >> 6] + alphabet[value & 63];
    }
    assert.equal(scene[3].__type__, compressed);
    function check(value) {
        if (!value || typeof value !== 'object') return;
        if ('__id__' in value) assert.ok(scene[value.__id__], `Missing object ${value.__id__}`);
        Object.values(value).forEach(check);
    }
    check(scene);
});

test('all six pockets capture targets approaching at maximum speed before cushion bounce', () => {
    for (const pocket of POCKETS) {
        const dx = pocket.normal.x, dz = pocket.normal.z;
        const ball = { id: 1, x: pocket.x - dx * 0.15, z: pocket.z - dz * 0.15,
            vx: dx * TABLE.maxStrikeSpeed, vz: dz * TABLE.maxStrikeSpeed };
        for (let i = 0; i < 20; i++) step([ball], FIXED_STEP);
        assert.equal(ball.pocketed, true);
        assert.equal(ball.vx, 0);
        assert.equal(ball.vz, 0);
    }
});

test('pocketed targets cannot move, collide or block the next shot', () => {
    const balls = [{ id: 0, x: 0, z: 0, vx: 0, vz: 0 },
        { id: 1, x: 0, z: 0, vx: 4, vz: 0, pocketed: true }];
    assert.equal(isMoving(balls), false);
    step(balls, FIXED_STEP);
    assert.equal(balls[0].x, 0);
    assert.equal(balls[1].x, 0);
    assert.equal(strike(balls, 0, -1, 1), true);
});

test('cue scratch waits for rest, rejects shots and respawns clear of an occupied head spot', () => {
    const pocket = POCKETS[1];
    const balls = [{ id: 0, x: pocket.x, z: pocket.z, vx: 0, vz: 0 },
        { id: 1, x: 0, z: 0.65, vx: 0, vz: 0 },
        { id: 2, x: 0.3, z: 0.4, vx: 0.2, vz: 0 }];
    step(balls, FIXED_STEP);
    assert.equal(balls[0].pocketed, true);
    assert.equal(strike(balls, 0, -1, 2), false);
    assert.equal(respawnCue(balls), false);
    for (let i = 0; i < 1000; i++) step(balls, FIXED_STEP);
    const cue = balls[0];
    assert.equal(cue.pocketed, false);
    assert.ok(Math.abs(cue.x) + TABLE.radius <= TABLE.halfWidth);
    assert.ok(Math.abs(cue.z) + TABLE.radius <= TABLE.halfLength);
    for (const ball of balls.slice(1)) {
        assert.ok(Math.hypot(cue.x - ball.x, cue.z - ball.z) > TABLE.radius * 2);
    }
    assert.ok(validTablePlacement(cue));
    assert.equal(strike(balls, 0, -1, 1), true);
});
