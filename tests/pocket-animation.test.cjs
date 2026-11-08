const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const directory = path.dirname(process.env.BILLIARDS_TEST_MODULE);
const { PocketAnimation, POCKET_FALL } = require(path.join(directory, 'BilliardsPocketAnimation.js'));
const { POCKETS, TABLE_GEOMETRY: G, pocketOpeningAt } = require(path.join(directory, 'BilliardsTableGeometry.js'));

for (const [index, pocket] of POCKETS.entries()) {
    test(`pocket ${index} keeps a full-size ball at entry and sinks below the opaque floor`, () => {
        for (const speed of [0, .1, 2, 8]) {
            const animation = new PocketAnimation();
            const ball = {
                id: 1,
                x: pocket.lip.x + pocket.normal.x * pocket.dropDepth,
                z: pocket.lip.z + pocket.normal.z * pocket.dropDepth,
            };
            const before = JSON.stringify(ball);
            animation.start(ball, index, speed);
            assert.deepEqual(animation.position(1), { x: ball.x, y: G.radius, z: ball.z });
            let previous = animation.position(1);
            for (let frame = 1; frame < 32; frame++) {
                animation.advance(.01);
                const pose = animation.position(1);
                assert.ok(pose.y < previous.y);
                assert.equal(pocketOpeningAt(pose), index);
                assert.ok(Math.hypot(pose.x - pocket.x, pose.z - pocket.z) <= Math.hypot(previous.x - pocket.x, previous.z - pocket.z));
                previous = pose;
            }
            assert.ok(previous.y + G.radius < POCKET_FALL.floor);
            assert.equal(animation.active, true);
            animation.advance(.02);
            assert.equal(animation.position(1), undefined);
            assert.equal(animation.active, false);
            assert.equal(JSON.stringify(ball), before);
        }
    });
}

test('concurrent drops retain independent ages, duplicate events cannot restart a drop, reset clears all', () => {
    const animation = new PocketAnimation();
    const ball = { id: 0, x: POCKETS[0].x, z: POCKETS[0].z };
    animation.start(ball, 0);
    animation.advance(.1);
    const first = animation.position(0);
    animation.start(ball, 0);
    assert.deepEqual(animation.position(0), first);
    animation.start({ ...ball, id: 8 }, 0);
    assert.equal(animation.position(8).y, G.radius);
    animation.advance(.23);
    assert.equal(animation.position(0), undefined);
    assert.ok(animation.position(8));
    animation.clear();
    assert.equal(animation.active, false);
    assert.equal(animation.position(8), undefined);
});
