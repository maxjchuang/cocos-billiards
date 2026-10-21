const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Referee, validCuePosition, respotEight } = require(process.env.BILLIARDS_RULES_MODULE);
const { createRack, step, strike, FIXED_STEP, TABLE, FOOT_SPOT, HEAD_LINE } = require(process.env.BILLIARDS_TEST_MODULE);

function setup({ breaking = false, assigned = true, clear = false } = {}) {
    const balls = createRack(), ref = new Referee();
    ref.phase = 'ready'; ref.isBreak = breaking; ref.hand = null;
    if (assigned && !breaking) ref.groups = ['solid', 'stripe'];
    if (clear) balls.filter(b => b.id >= 1 && b.id <= 7).forEach(b => { b.pocketed = true; });
    return { balls, ref };
}
function contact(ref, balls, id) { ref.observe({ type: 'contact', a: 0, b: id }, balls); }
function pot(ref, balls, id) {
    balls[id].pocketed = true;
    ref.observe({ type: 'pocket', id, pocket: 0 }, balls);
}
function rail(ref, balls, id) { ref.observe({ type: 'cushion', id }, balls); }
function finish(ref, balls) { balls.forEach(b => { b.vx = 0; b.vz = 0; }); ref.finishShot(balls); }

test('Chinese rack has apex at foot spot, central 8, and opposite rear groups', () => {
    const balls = createRack();
    assert.equal(balls[1].z, FOOT_SPOT);
    assert.ok(Math.abs(balls[8].x) < 1e-9);
    const row = balls.filter(b => b.id !== 0).sort((a,b) => a.z - b.z || a.x - b.x).slice(0,5);
    assert.ok(row[0].id < 8 && row[4].id > 8);
});

test('opening placement is head-only, cannot overlap or use pockets', () => {
    const { balls } = setup(); const ref = new Referee();
    assert.equal(ref.beginShot(balls), false);
    assert.equal(ref.placeCue(balls, 0, 0), false);
    assert.equal(ref.placeCue(balls, 0, HEAD_LINE), false);
    assert.equal(ref.placeCue(balls, NaN, 0.9), false);
    assert.equal(ref.placeCue(balls, 0, 0.9), true);
    assert.equal(ref.confirmPlacement(balls), true);
    assert.equal(ref.beginShot(balls), true);
    assert.equal(validCuePosition(balls, TABLE.halfWidth, 0), false);
    assert.equal(validCuePosition(balls, balls[1].x, balls[1].z), false);
});

test('legal break: potted ball continues without assigning groups; legal dry break swaps', () => {
    for (const potted of [true, false]) {
        const { balls, ref } = setup({ breaking: true }); ref.beginShot(balls); contact(ref, balls, 1);
        if (potted) pot(ref, balls, 2); else [1,2,3,4].forEach(id => rail(ref, balls, id));
        finish(ref, balls);
        assert.equal(ref.phase, 'ready'); assert.equal(ref.current, potted ? 0 : 1);
        assert.deepEqual(ref.groups, [null, null]);
    }
});

test('short break counts distinct target balls, offers three decisions and warns repeat breaker', () => {
    const { balls, ref } = setup({ breaking: true }); ref.beginShot(balls); contact(ref, balls, 1);
    [1,1,1,1].forEach(id => rail(ref, balls, id)); finish(ref, balls);
    assert.equal(ref.phase, 'choice'); assert.equal(ref.current, 1);
    ref.chooseBreak(balls, 'opponent'); assert.equal(ref.current, 0);
    assert.equal(ref.isBreak, true); assert.equal(ref.phase, 'placing');
    ref.placeCue(balls, 0, 0.9); ref.confirmPlacement(balls); ref.beginShot(balls);
    contact(ref, balls, 1); rail(ref, balls, 1); finish(ref, balls);
    assert.equal(ref.winner, 1); assert.equal(ref.phase, 'over');
});

test('short-break receiver may accept full-table hand or rebreak themselves', () => {
    for (const choice of ['accept','self']) {
        const { balls, ref } = setup({ breaking: true }); ref.beginShot(balls); finish(ref, balls);
        ref.chooseBreak(balls, choice);
        assert.equal(ref.current, 1); assert.equal(ref.phase, 'placing');
        assert.equal(ref.hand, choice === 'accept' ? 'any' : 'head');
        assert.equal(ref.isBreak, choice === 'self');
    }
});

test('break 8 is respotted without winning; scratch plus 8 offers head ball or table acceptance', () => {
    for (const scratch of [false,true]) {
        const { balls, ref } = setup({ breaking: true }); ref.beginShot(balls); contact(ref, balls, 8);
        pot(ref, balls, 8); if (scratch) pot(ref, balls, 0); finish(ref, balls);
        assert.equal(ref.winner, null); assert.equal(balls[8].pocketed, false);
        assert.equal(ref.current, scratch ? 1 : 0);
        assert.equal(ref.phase, scratch ? 'choice' : 'ready');
        if (scratch) {
            ref.chooseBreak(balls, 'self'); assert.equal(ref.phase, 'choice');
            ref.chooseBreak(balls, 'accept'); assert.equal(ref.hand, 'head');
        }
    }
});

test('open-table group selection is explicit and never assigned on a foul or cross-group combo', () => {
    for (const situation of ['legal','scratch','cross']) {
        const { balls, ref } = setup({ assigned: false });
        assert.equal(ref.beginShot(balls), false); ref.select('solid'); assert.equal(ref.beginShot(balls), true);
        contact(ref, balls, situation === 'cross' ? 9 : 1); pot(ref, balls, 1);
        if (situation === 'scratch') pot(ref, balls, 0); finish(ref, balls);
        assert.deepEqual(ref.groups, situation === 'legal' ? ['solid','stripe'] : [null,null]);
        assert.equal(ref.current, situation === 'legal' ? 0 : 1);
    }
});

test('open-table first contact with 8 is a foul', () => {
    const { balls, ref } = setup({ assigned: false }); ref.select('stripe'); ref.beginShot(balls);
    contact(ref, balls, 8); rail(ref, balls, 8); finish(ref, balls);
    assert.equal(ref.phase, 'placing'); assert.equal(ref.current, 1);
    assert.match(ref.message, /首碰非法/);
});

test('no target, wrong first hit, scratch, and no rail after contact are fouls with full-table hand', () => {
    for (const kind of ['miss','wrong','scratch','no-rail']) {
        const { balls, ref } = setup(); ref.beginShot(balls);
        if (kind !== 'miss') contact(ref, balls, kind === 'wrong' ? 9 : 1);
        if (kind === 'scratch') pot(ref, balls, 0);
        if (kind !== 'no-rail') rail(ref, balls, 0);
        finish(ref, balls);
        assert.equal(ref.current, 1); assert.equal(ref.phase, 'placing'); assert.equal(ref.hand, 'any');
        assert.equal(ref.foulCount[0], 1); assert.equal(ref.beginShot(balls), false);
    }
});

test('rail before first contact is not enough; post-contact cue rail is enough', () => {
    for (const after of [true,false]) {
        const { balls, ref } = setup(); ref.beginShot(balls);
        if (!after) rail(ref, balls, 0); contact(ref, balls, 1); if (after) rail(ref, balls, 0);
        finish(ref, balls); assert.equal(ref.phase, after ? 'ready' : 'placing');
    }
});

test('own pot keeps turn; opponent-only pot swaps with no penalty; mixed pot stays down', () => {
    for (const own of [true,false]) {
        const { balls, ref } = setup(); ref.beginShot(balls); contact(ref, balls, 1);
        pot(ref, balls, 9); if (own) pot(ref, balls, 1); finish(ref, balls);
        assert.equal(ref.current, own ? 0 : 1); assert.equal(ref.phase, 'ready');
        assert.equal(balls[9].pocketed, true); assert.equal(ref.foulCount[0], 0);
    }
});

test('8 early or with final group ball loses, including when final group ball went down first', () => {
    for (const lastSameShot of [false,true]) {
        const { balls, ref } = setup();
        if (lastSameShot) balls.filter(b=>b.id>=2&&b.id<=7).forEach(b=>{b.pocketed=true;});
        ref.beginShot(balls); contact(ref, balls, 1); if (lastSameShot) pot(ref, balls, 1);
        pot(ref, balls, 8); finish(ref, balls);
        assert.equal(ref.winner, 1); assert.equal(ref.phase, 'over'); assert.equal(ref.beginShot(balls), false);
    }
});

test('legal 8 wins; 8 plus scratch loses; scratch while 8 remains is only a foul', () => {
    for (const outcome of ['win','8-scratch','scratch-only']) {
        const { balls, ref } = setup({ clear: true }); ref.beginShot(balls); contact(ref, balls, 8);
        if (outcome !== 'scratch-only') pot(ref, balls, 8);
        if (outcome !== 'win') pot(ref, balls, 0); finish(ref, balls);
        assert.equal(ref.winner, outcome === 'win' ? 0 : outcome === '8-scratch' ? 1 : null);
        assert.equal(ref.phase, outcome === 'scratch-only' ? 'placing' : 'over');
    }
});

test('ordinary break scratch grants head-only placement, regular hand allows anywhere clear', () => {
    for (const breaking of [true,false]) {
        const { balls, ref } = setup({ breaking }); ref.beginShot(balls); contact(ref, balls, 1);
        pot(ref, balls, 2); pot(ref, balls, 0); finish(ref, balls);
        assert.equal(ref.hand, breaking ? 'head' : 'any');
        assert.equal(ref.placeCue(balls, 0.4, 0), !breaking);
        assert.equal(ref.placeCue(balls, 0.4, 0.8), true); assert.equal(ref.confirmPlacement(balls), true);
    }
});

test('head-only free ball cannot hit a head-side target before crossing the line', () => {
    const { balls, ref } = setup(); ref.beginShot(balls); contact(ref, balls, 1); pot(ref, balls, 0); finish(ref, balls);
    // Reach the head-only mode through a break scratch, not a manual hidden implementation flag.
    const second = setup({ breaking: true }); const r = second.ref, b = second.balls;
    r.beginShot(b); contact(r,b,1); pot(r,b,2); pot(r,b,0); finish(r,b);
    r.placeCue(b,0.4,0.9); r.confirmPlacement(b); r.select('solid'); b[1].z=0.8;
    r.beginShot(b); contact(r,b,1); rail(r,b,1); b[0].z=0; r.trackCue(b); finish(r,b);
    assert.equal(r.phase,'placing'); assert.match(r.message,/线后自由球/);
});

test('respotting 8 avoids blockers along the centre line', () => {
    const balls=createRack(); balls[8].pocketed=true; respotEight(balls);
    assert.equal(balls[8].x,0); assert.equal(balls[8].pocketed,false);
    assert.ok(balls[8].z<FOOT_SPOT);
    for(const b of balls) if(b.id!==8&&!b.pocketed)
        assert.ok(Math.hypot(b.x-balls[8].x,b.z-balls[8].z)>=TABLE.radius*2);
});

test('real physics events settle a dry miss once and do not auto-respawn a scratched cue', () => {
    const {balls,ref}=setup();
    balls[0].x=0.5; balls[0].z=0.4; ref.beginShot(balls); strike(balls,0,1,0.5);
    for(let i=0;i<240*5;i++) {
        step(balls,FIXED_STEP,{respawnCue:false,onEvent:event=>ref.observe(event,balls)});
        ref.trackCue(balls);
    }
    ref.finishShot(balls); assert.equal(ref.current,1); assert.equal(ref.phase,'placing');
    const count=ref.foulCount[0]; ref.finishShot(balls); assert.equal(ref.foulCount[0],count);
    balls[0].x=TABLE.halfWidth;balls[0].z=0;balls[0].pocketed=false;
    step(balls,FIXED_STEP,{respawnCue:false}); assert.equal(balls[0].pocketed,true);
});

test('a frozen object ball must depart and return before its original cushion counts', () => {
    for (const departs of [false,true]) {
        const {balls,ref}=setup(); balls[1].x=TABLE.halfWidth-TABLE.radius; balls[1].z=0.4;
        ref.beginShot(balls); contact(ref,balls,1);
        if(departs) { balls[1].x-=0.01; ref.trackCue(balls); balls[1].x=TABLE.halfWidth-TABLE.radius; }
        ref.observe({type:'cushion',id:1,side:'right'},balls); finish(ref,balls);
        assert.equal(ref.phase,departs?'ready':'placing');
    }
});

test('head-only free ball spots nearest legal target when all eligible balls are behind line', () => {
    const {balls,ref}=setup({breaking:true}); ref.beginShot(balls);contact(ref,balls,1);
    pot(ref,balls,2);pot(ref,balls,0);finish(ref,balls);
    balls.filter(b=>b.id!==0&&b.id!==8&&!b.pocketed).forEach((b,i)=>{b.x=(i%6-2.5)*0.15;b.z=0.8+Math.floor(i/6)*0.13;});
    assert.equal(ref.placeCue(balls,0.5,1.05),true);
    assert.equal(ref.confirmPlacement(balls),true);
    assert.ok(balls.filter(b=>b.id!==0&&b.id!==8&&!b.pocketed).some(b=>b.z<HEAD_LINE));
});
