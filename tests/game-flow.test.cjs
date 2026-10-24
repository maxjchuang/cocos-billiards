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

test('modal setting changes take effect without changing the match and sound-off stops feedback',()=>{
 const g=game(),before=JSON.stringify(g.balls);let stopped=0;g.feedback={stop(){stopped++;}};
 g.pauseGame();g.modalAction('settings');assert.equal(g.panelMode,'settings');g.modalAction('setting:sound');
 assert.equal(g.settings.value.sound,false);assert.ok(stopped>=2);assert.equal(JSON.stringify(g.balls),before);
});
test('cancel restart resumes the existing match and does not reset confirmed tip or power',()=>{
 const g=game();g.tip.open();g.tip.select(.3,-.4);g.tip.confirm();g.power=3;
 const before=JSON.stringify(g.balls);g.pauseGame();g.modalAction('restart');assert.equal(g.confirmingRestart,true);
 g.modalAction('cancel-restart');assert.equal(g.paused,false);assert.equal(g.panelMode,null);assert.equal(g.power,3);assert.deepEqual(g.tip.value,{x:.3,y:-.4});assert.equal(JSON.stringify(g.balls),before);
});
test('result table inspection stays paused and new round clears history while retaining preferences',()=>{
 const g=game();g.paused=true;g.settings.set('magnifier',false);g.history.record({shotId:1,player:0,reason:'犯规',phase:'over',winner:1});
 g.modalAction('view-table');assert.equal(g.panelMode,'view');assert.equal(g.paused,true);g.modalAction('return-result');assert.equal(g.panelMode,'result');
 g.modalAction('new-round');assert.equal(g.referee.phase,'placing');assert.equal(g.history.entries.length,0);assert.equal(g.settings.value.magnifier,false);
});

test('component records fresh rack recipes, supports replay, and keeps the replay ball set on re-rack',()=>{
 const path=require('node:path'),r=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsRack.js')),g=game();
 g.rackSession=new r.RackSession(undefined,()=>.25);g.reset();const a=g.rackConfig;g.reset();assert.notEqual(g.rackConfig.rackSeed,a.rackSeed);assert.equal(g.rackSession.history.length,2);
 const recipe=r.rackConfig(123,987,r.TARGET_MASS_VARIATION,.0001),history=g.rackSession.history.length;g.reset(recipe);assert.deepEqual(g.rackConfig,recipe);assert.equal(g.rackSession.history.length,history);
 const masses=g.balls.map(b=>b.mass);g.referee.phase='choice';g.referee.breakChoice='illegal';g.referee.chooseBreak(g.balls,'self');assert.equal(g.rackConfig.ballSetSeed,987);assert.equal(g.rackConfig.positionToleranceM,.0001);assert.deepEqual(g.balls.map(b=>b.mass),masses);
 const before=g.balls,id=g.gameId;assert.throws(()=>g.reset({...recipe,version:'bad'}));assert.equal(g.balls,before);assert.equal(g.gameId,id);
});
test('AI seat rejects human shots and placement confirmation, while AI uses the ordinary shot sequence',()=>{
 const g=game();g.matchMode='ai';g.referee.current=1;g.referee.isBreak=false;g.referee.groups=['stripe','solid'];g.shoot();assert.equal(g.shotSequence.active,false);g.shoot(true);assert.equal(g.shotSequence.snapshot.player,1);assert.equal(g.referee.phase,'ready');g.shotSequence.cancel();g.referee.phase='placing';g.referee.hand='any';g.ruleAction(1);assert.equal(g.referee.phase,'placing');
});
test('mode selection is a cancellable draft and start resets once with the selected stored difficulty',()=>{
 const g=game(),before=JSON.stringify(g.balls),id=g.gameId;g.matchStarted=true;g.modalAction('new-game');g.modalAction('mode:ai');g.modalAction('draft-level:hard');assert.equal(g.draftDifficulty,'hard');assert.equal(g.gameId,id);g.modalAction('cancel-match');assert.equal(JSON.stringify(g.balls),before);g.modalAction('new-game');g.modalAction('draft-level:easy');g.modalAction('start-match');assert.equal(g.matchMode,'ai');assert.equal(g.practice.value.difficulty,'easy');assert.equal(g.referee.current,0);assert.equal(g.players[1].id,'ai-opponent');assert.equal(g.panelMode,null);
});
test('difficulty changes during a paused locked AI shot cannot change that command, and reset cancels it',()=>{
 const g=game();g.matchMode='ai';g.referee.current=1;g.referee.isBreak=false;g.referee.groups=['stripe','solid'];const command=Object.freeze({difficulty:'standard',direction:Object.freeze({x:0,z:-1}),power:2,tip:Object.freeze({x:0,y:0})});g.aiTurn.locked=command;g.shoot(true);g.pauseGame();assert.equal(g.shotSequence.active,false);g.modalAction('ai-level:hard');assert.equal(g.practice.value.difficulty,'hard');assert.equal(g.aiTurn.locked,command);assert.equal(command.difficulty,'standard');g.reset();assert.equal(g.aiTurn.locked,null);assert.equal(g.referee.current,0);
});
test('AI handles the opponent opening foul and confirms its own free ball through the same referee',()=>{
 const g=game();g.matchMode='ai';g.referee.current=1;g.referee.phase='choice';g.referee.breakChoice='illegal';g.uiTime=1;g.updateAI(.1);g.uiTime=2;g.updateAI(.1);assert.equal(g.referee.phase,'placing');assert.equal(g.referee.hand,'any');g.uiTime=3;g.updateAI(.1);g.uiTime=4;g.updateAI(.1);assert.equal(g.referee.phase,'ready');assert.equal(g.balls[0].pocketed,false);
});
test('backgrounding the initial mode chooser preserves the required choice and never starts AI work',()=>{
 const g=game();g.modalAction('new-game');g.draftDifficulty='hard';const before=g.gameId;g.hideGame();assert.equal(g.panelMode,'new-game');assert.equal(g.backgrounded,true);assert.equal(g.paused,true);g.showGame();assert.equal(g.panelMode,'new-game');assert.equal(g.draftDifficulty,'hard');assert.equal(g.paused,true);assert.equal(g.gameId,before);assert.equal(g.aiTurn.planner,null);
});
