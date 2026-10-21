const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ShotSequence, commitShot, mayShoot, shotPose } = require(process.env.BILLIARDS_SHOT_MODULE);
const { createRack, step, FIXED_STEP, isMoving } = require(process.env.BILLIARDS_TEST_MODULE);
const { Referee } = require(process.env.BILLIARDS_RULES_MODULE);
const ready = () => { const balls=createRack(),ref=new Referee();assert.ok(ref.confirmPlacement(balls));return {balls,ref}; };
const request = () => ({gameId:1,player:0,direction:{x:0,z:-1},power:2.4,tipOffset:{x:0,y:0},selectedGroup:null});

test('click reserves a deep-frozen snapshot without touching balls or the referee',()=>{
    const {balls,ref}=ready(), seq=new ShotSequence(),input=request();
    assert.ok(seq.begin(input));input.direction.z=1;input.power=4;
    assert.equal(seq.snapshot.direction.z,-1);assert.equal(seq.snapshot.power,2.4);
    assert.ok(Object.isFrozen(seq.snapshot.direction));assert.ok(Object.isFrozen(seq.snapshot.tipOffset));
    assert.equal(ref.phase,'ready');assert.equal(isMoving(balls),false);
    assert.equal(seq.begin(request()),false);
});
test('220ms commits exactly once and holds the visible contact pose on a long frame',()=>{
    const {balls,ref}=ready(),seq=new ShotSequence();seq.begin(request());let count=0;
    const commit=s=>{count++;return commitShot(s,1,balls,ref);};
    seq.advance(0.139,commit);seq.advance(0.080,commit);
    assert.equal(count,0);assert.equal(isMoving(balls),false);assert.equal(ref.phase,'ready');
    assert.ok(seq.advance(0.5,commit));assert.equal(seq.elapsedMs,220);
    assert.equal(count,1);assert.equal(ref.phase,'shooting');assert.equal(isMoving(balls),true);
    const pose=shotPose(seq.elapsedMs,seq.active);assert.equal(pose.ballTravel,0);assert.ok(pose.burstAlpha>0);
    seq.advance(0.7,commit);seq.advance(1,commit);
    assert.equal(count,1);assert.equal(seq.active,false);
});
test('cancel or pause before contact prevents ghost shots and permits a fresh click',()=>{
    const seq=new ShotSequence();seq.begin(request());seq.advance(.14,()=>assert.fail());seq.cancelBeforeContact();
    seq.advance(2,()=>assert.fail());assert.equal(seq.active,false);
    assert.ok(seq.begin(request()));assert.equal(seq.snapshot.shotId,2);
});
test('pause after contact retains the committed shot and does not replay it',()=>{
    const seq=new ShotSequence();let count=0;seq.begin(request());seq.advance(.22,()=>{count++;return true;});
    seq.cancelBeforeContact();assert.equal(seq.active,true);assert.equal(seq.committed,true);
    assert.equal(seq.elapsedMs,220);seq.advance(.2,()=>{count++;return true;});assert.equal(count,1);
});
test('stale game, changed player/group and invalid velocity cannot partially mutate the referee',()=>{
    for(const mutation of ['game','player','group','direction']) {
        const {balls,ref}=ready(),s={...request(),shotId:1};
        if(mutation==='game')s.gameId=2;
        if(mutation==='player')s.player=1;
        if(mutation==='group')s.selectedGroup='stripe';
        if(mutation==='direction')s.direction={x:NaN,z:0};
        const before=JSON.stringify(ref),positions=JSON.stringify(balls);
        assert.equal(commitShot(s,1,balls,ref),false);assert.equal(JSON.stringify(ref),before);assert.equal(JSON.stringify(balls),positions);
    }
});
test('not ready, moving, missing cue, open without a selection and ended games cannot shoot',()=>{
    const {balls,ref}=ready();assert.equal(mayShoot(balls,ref),true);
    assert.equal(mayShoot(balls.filter(b=>b.id!==0),ref),false);
    balls[1].vx=.2;assert.equal(mayShoot(balls,ref),false);balls[1].vx=0;
    ref.isBreak=false;assert.equal(mayShoot(balls,ref),false);ref.select('solid');assert.equal(mayShoot(balls,ref),true);
    ref.phase='placing';assert.equal(mayShoot(balls,ref),false);ref.phase='over';assert.equal(mayShoot(balls,ref),false);
});
test('failed callback, invalid delta and explicit reset do not leave another contact pending',()=>{
    const seq=new ShotSequence();assert.equal(seq.begin({...request(),power:Infinity}),false);
    assert.equal(seq.begin({...request(),tipOffset:{x:1,y:1}}),false);
    assert.ok(new ShotSequence().begin({...request(),tipOffset:{x:.6000000000000001,y:.8}}));
    seq.begin(request());seq.advance(NaN,()=>assert.fail());assert.equal(seq.elapsedMs,0);
    seq.advance(-1,()=>assert.fail());assert.equal(seq.elapsedMs,0);
    seq.advance(.3,()=>false);assert.equal(seq.active,false);seq.advance(.3,()=>assert.fail());
    seq.begin(request());seq.cancel();seq.advance(1,()=>assert.fail());
});
test('icon reset has no physical effect and reduced motion preserves the same contact flash',()=>{
    const {balls,ref}=ready(),seq=new ShotSequence();seq.begin(request());seq.advance(.22,s=>commitShot(s,1,balls,ref));
    step(balls,FIXED_STEP,{respawnCue:false});const position={x:balls[0].x,z:balls[0].z};
    seq.advance(1,()=>assert.fail());assert.deepEqual({x:balls[0].x,z:balls[0].z},position);
    const pose=shotPose(220,true,true);assert.equal(pose.ballTravel,0);assert.equal(pose.cueShift,0);assert.ok(pose.burstAlpha>0);
    assert.equal(shotPose(550,true).ballAlpha,0);assert.equal(shotPose(820,false).ballAlpha,1);
});
