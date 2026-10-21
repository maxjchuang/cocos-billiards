// Component flow tests use a minimal Cocos boundary; rendering is verified separately in Creator.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const load=Module._load;
class Vec3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} }
Module._load=function(id,...args){return id==='cc'?{_decorator:{ccclass:()=>target=>target},Component:class{},
    Vec3,screen:{windowSize:{width:393,height:852}},Input:{EventType:{}}}:load.call(this,id,...args);};
const {BilliardsGame}=require(process.env.BILLIARDS_GAME_MODULE);
Module._load=load;
const {createRack}=require(process.env.BILLIARDS_TEST_MODULE);
function game(){
    const g=new BilliardsGame();g.balls=createRack();g.referee.confirmPlacement(g.balls);
    g.syncVisuals=()=>{};g.drawAimGuide=()=>{};g.layoutHud=()=>{};
    g.status={};g.turnLabel={};g.decision={};g.shotButton={render(){},node:{}};
    g.hudLayout={shoot:{width:169,height:48},scale:1};
    g.numberNodes=g.balls.map(()=>({setPosition(){},setScale(){}}));
    g.camera={worldToScreen:v=>v};g.hudCamera={screenToWorld:v=>v,orthoHeight:426};
    return g;
}
test('component release keeps aim; click locks parameters; actual motion begins on the contact frame',()=>{
    const g=game();g.dragging=true;g.release(0,0);assert.equal(g.referee.phase,'ready');assert.equal(g.balls[0].vz,0);
    g.shoot();const snap=g.shotSequence.snapshot;
    g.direction={x:1,z:0};g.power=4; // Even external mutable fields cannot alter the reserved shot.
    g.update(.219);assert.equal(g.referee.phase,'ready');assert.equal(g.balls[0].vz,0);
    const z=g.balls[0].z;g.update(.001);
    assert.equal(g.shotSequence.elapsedMs,220);assert.equal(g.referee.phase,'shooting');
    assert.ok(g.balls[0].z<z);assert.equal(g.balls[0].vx,0);assert.equal(snap.power,2.4);
    g.shoot();assert.equal(g.shotSequence.snapshot.shotId,snap.shotId);
});
test('component pause before contact cancels without movement; resume never auto-shoots',()=>{
    const g=game();g.shoot();g.update(.14);g.pauseGame();g.update(1);
    assert.equal(g.shotSequence.active,false);assert.equal(g.referee.phase,'ready');assert.equal(g.balls[0].vz,0);
    g.paused=false;g.update(1);assert.equal(g.balls[0].vz,0);
});
test('backgrounding after contact freezes the existing shot and resumes without another submission',()=>{
    const g=game();g.shoot();g.update(.22);const shot=g.referee.shot,id=g.shotSequence.snapshot.shotId;
    const position={x:g.balls[0].x,z:g.balls[0].z};g.hideGame();g.update(10);
    assert.deepEqual({x:g.balls[0].x,z:g.balls[0].z},position);assert.equal(g.referee.shot,shot);
    g.showGame();g.update(.1);assert.equal(g.paused,true);
    g.paused=false;g.update(.016);assert.equal(g.shotSequence.snapshot.shotId,id);assert.equal(g.referee.shot,shot);
});
test('reset invalidates an unfinished shot and subsequent updates cannot apply it to a new rack',()=>{
    const g=game();g.ballNodes=[];g.shoot();g.update(.14);g.reset();g.update(1);
    assert.equal(g.gameId,1);assert.equal(g.referee.phase,'placing');assert.equal(g.balls[0].vz,0);
});
test('a cancelled secondary touch does not cancel the owning finger',()=>{
    const g=game();g.activeTouch=1;g.dragging=true;g.touchCancel({getID:()=>2});assert.equal(g.dragging,true);
    g.touchCancel({getID:()=>1});assert.equal(g.dragging,false);assert.equal(g.activeTouch,null);
});

test('tip panel cannot shoot; cancellation and pre-contact pause preserve the confirmed tip',()=>{
    const g=game();g.tip.open();g.tip.select(.3,-.4);g.shoot();assert.equal(g.shotSequence.active,false);
    g.tip.confirm();g.tip.open();g.tip.select(-.5,.5);g.tip.cancel();assert.deepEqual(g.tip.value,{x:.3,y:-.4});
    g.shoot();assert.deepEqual(g.shotSequence.snapshot.tipOffset,{x:.3,y:-.4});
    g.pauseGame();assert.equal(g.shotSequence.active,false);assert.deepEqual(g.tip.value,{x:.3,y:-.4});
});
test('reserved tip reaches physics at contact and resets only after the referee settles the shot',()=>{
    const g=game();g.tip.open();g.tip.select(.3,-.4);g.tip.confirm();g.shoot();
    const snapshot=g.shotSequence.snapshot;g.update(.219);
    assert.deepEqual(g.tip.value,{x:.3,y:-.4});assert.equal(g.balls[0].wy,undefined);
    g.update(.001);assert.ok(g.balls[0].wy>0);assert.ok(g.balls[0].wx>0);
    assert.deepEqual(g.tip.value,{x:.3,y:-.4});
    g.balls.forEach(b=>Object.assign(b,{vx:0,vz:0,wx:0,wy:0,wz:0}));g.update(1/240);
    assert.notEqual(g.referee.phase,'shooting');assert.deepEqual(g.tip.value,{x:0,y:0});
    assert.deepEqual(snapshot.tipOffset,{x:.3,y:-.4});
});
