const {test}=require('node:test');
const assert=require('node:assert/strict');
const {predictContact,FineAim}=require(process.env.BILLIARDS_AIM_MODULE);
const {TABLE}=require(process.env.BILLIARDS_TEST_MODULE);
const ball=(id,x,z)=>({id,x,z,vx:0,vz:0});
test('aim predicts the nearest expanded-radius ball, excluding pocketed balls and self',()=>{
    const cue=ball(0,0,.5),a=ball(1,0,0),b=ball(2,0,-.3);
    let hit=predictContact(cue,0,-2,[cue,a,b]);assert.equal(hit.target,1);assert.ok(Math.abs(hit.z-TABLE.radius*2)<1e-8);
    a.pocketed=true;hit=predictContact(cue,0,-1,[cue,a,b]);assert.equal(hit.target,2);
});
test('aim detects a grazing sphere that a zero-radius ray would miss',()=>{
    const cue=ball(0,0,.5),target=ball(1,.05,0);
    assert.equal(predictContact(cue,0,-1,[cue,target]).target,1);
});
test('aim stops at the ball-centre cushion and rejects invalid directions',()=>{
    const cue=ball(0,0,.35);const hit=predictContact(cue,1,0,[cue]);
    assert.equal(hit.target,null);assert.equal(hit.x,TABLE.halfWidth-TABLE.radius);
    assert.equal(predictContact(cue,0,0,[cue]),null);assert.equal(predictContact(cue,NaN,1,[cue]),null);
});
test('fine aim nudges by 0.1 degrees, clamps at ±5 and anchors anew on reopening',()=>{
    const fine=new FineAim();fine.open(0,-1);let d=fine.nudge(1);assert.equal(fine.degrees,.1);
    assert.ok(Math.abs(Math.hypot(d.x,d.z)-1)<1e-10);d=fine.set(100);assert.equal(fine.degrees,5);
    fine.set(-100);assert.equal(fine.degrees,-5);fine.close();assert.equal(fine.active,false);
    fine.open(d.x,d.z);assert.equal(fine.degrees,0);const again=fine.set(0);assert.ok(Math.hypot(again.x-d.x,again.z-d.z)<1e-12);
});
