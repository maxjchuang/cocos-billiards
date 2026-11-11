// Component flow tests use a minimal Cocos boundary; rendering is verified separately in Creator.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const load=Module._load;
const environment={PREVIEW:false,EDITOR:false};
const windowSize={width:852,height:393};
const platform={isMobile:false};
class Vec3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} }
Module._load=function(id,...args){return id==='cc/env'?environment:id==='cc'?{_decorator:{ccclass:()=>target=>target},Component:class{},
    Vec3,Rect:class{},Camera:{ProjectionType:{PERSPECTIVE:0,ORTHO:1}},EventMouse:{BUTTON_RIGHT:2,BUTTON_LEFT:0},sys:platform,screen:{windowSize},Input:{EventType:{}}}:load.call(this,id,...args);};
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

test('two scene fingers observe without editing aim and wait for all fingers up',()=>{
 const g=game();g.referee.phase='ready';g.referee.isBreak=true;
 g.inScene=()=>true;g.hitUi=()=>false;g.powerControl={};g.hudPixelRatio=1;
 g.begin=()=>{g.dragging=true;};g.move=()=>{throw Error('single-finger input leaked after pair');};
 const observations=[];g.cameraRig={observe(...args){observations.push(args);}};
 const touch=(id,x,y)=>({getID:()=>id,getLocation:()=>({x,y})});
 const direction={...g.direction};g.touchStart(touch(1,200,200));g.touchStart(touch(2,300,200));
 g.touchMove(touch(2,340,220));assert.equal(observations.length,1);assert.deepEqual(g.direction,direction);
 g.touchEnd(touch(2,340,220));g.touchMove(touch(1,220,210));assert.equal(g.observationBlocked,true);
 g.touchEnd(touch(1,220,210));assert.equal(g.observationBlocked,false);assert.equal(g.observationTouches.size,0);assert.equal(g.shotSequence.active,false);
});

test('free camera observation and returning preserve shot input and use locked origin',()=>{
 const previous=Module._load;Module._load=function(id,...args){return id==='cc/env'?environment:id==='cc'?{Vec3,Rect:class{},Camera:{ProjectionType:{PERSPECTIVE:0,ORTHO:1}}}:previous.call(this,id,...args);};
 const {CameraRig}=require(require('node:path').join(require('node:path').dirname(process.env.BILLIARDS_GAME_MODULE),'BilliardsCameraRig.js'));Module._load=previous;
 const rig=new CameraRig({});const direction={x:0,z:-1},cue={x:0,z:.65};
 rig.returnToShot(cue,direction,.2,true);const origin=JSON.stringify(rig.freePose);
 rig.lock(rig.freePose);rig.observe(25,20,.8);assert.notEqual(JSON.stringify(rig.freePose),origin);
 rig.returnToShot({x:.5,z:-1},{x:1,z:0},.2,true);assert.equal(JSON.stringify(rig.freePose),origin);
 assert.deepEqual(direction,{x:0,z:-1});assert.deepEqual(cue,{x:0,z:.65});
});

test('parallel two-finger movement pans from complete engine samples',()=>{
 const g=game();g.inScene=()=>true;g.hitUi=()=>false;g.powerControl={};g.hudPixelRatio=1;g.begin=()=>{};
 const observations=[];g.cameraRig={top:true,topTarget:{x:0,z:0},pan(...args){observations.push(args);}};
 const t=(id,x,y)=>({getID:()=>id,getLocation:()=>({x,y})});
 g.touchStart(t(1,200,200));g.touchStart(t(2,300,200));
 g.touchMove({...t(1,220,210),getAllTouches:()=>[t(1,220,210),t(2,320,210)]});
 assert.equal(g.observationIntent,'pan');
 assert.deepEqual(observations,[[{x:250,y:200,distance:100},{x:270,y:210,distance:100}]]);
});

test('exported game ignores desktop camera gestures when PREVIEW is false',()=>{
 const g=game();const calls=[];g.cameraRig={observe(...args){calls.push(args);}};
 const event={getButton:()=>2,getLocation:()=>({x:200,y:200}),getScrollY:()=>120};
 g.previewMouseDown(event);g.previewMouseMove(event);g.previewMouseWheel(event);
 assert.equal(g.previewPointer,null);assert.deepEqual(calls,[]);
});

test('preview adapter uses right drag and wheel without changing shot inputs',()=>{
 const g=game();g.hudPixelRatio=2;g.previewObservationAllowed=()=>true;g.desktopPreview=()=>true;
 const calls=[];g.cameraRig={observe(...args){calls.push(args);}};
 const event=(button,x,y,scroll=0)=>({getButton:()=>button,getLocation:()=>({x,y}),getScrollY:()=>scroll});
 const before=JSON.stringify([g.direction,g.power,g.tip.value,g.balls]);
 g.begin=()=>{};g.previewMouseDown(event(0,100,100));assert.equal(g.previewPointer,null);
 g.previewMouseDown(event(2,100,100));g.previewMouseMove(event(2,140,120));
 assert.deepEqual(calls[0],[20,10,1]);g.previewMouseUp(event(2,140,120));assert.equal(g.previewPointer,null);
 g.previewMouseWheel(event(0,140,120,120));assert.ok(calls[1][2]<1);
 assert.equal(JSON.stringify([g.direction,g.power,g.tip.value,g.balls]),before);
});

test('Creator in-editor preview enables observation with EDITOR true and PREVIEW false',()=>{
 const g=game();g.inScene=()=>true;g.hitUi=()=>false;
 g.powerControl={};g.resetLabel={node:{}};g.viewButton={node:{parent:{}}};g.dock={};g.spinPanel={panel:{}};
 const calls=[];g.cameraRig={observe(...args){calls.push(args);}};g.hudPixelRatio=1;
 const e=(x,y)=>({getButton:()=>2,getLocation:()=>({x,y}),getScrollY:()=>120});
 environment.EDITOR=true;
 try{g.previewMouseDown(e(100,100));g.previewMouseMove(e(120,110));g.previewMouseUp(e(120,110));g.previewMouseWheel(e(120,110));}
 finally{environment.EDITOR=false;}
 assert.deepEqual(calls[0],[20,10,1]);assert.ok(calls[1][2]<1);assert.equal(g.previewPointer,null);
});

test('portrait-shaped viewport does not pause or block an active match',()=>{
 const g=game();windowSize.width=393;windowSize.height=852;
 try{g.update(.016);assert.equal(g.paused,false);assert.equal(g.referee.phase,'ready');assert.equal(g.rotationBlocked,undefined);}
 finally{windowSize.width=852;windowSize.height=393;}
});

test('initial viewport and resize remain playable without an orientation pause',()=>{
 const g=game();delete g.hudLayout;
 assert.doesNotThrow(()=>g.endGestureOnResize(852,393));
 g.hudLayout={width:852,height:393};g.activeTouch=1;g.dragging=true;g.observationTouches.set(1,{x:10,y:10});
 const before=JSON.stringify([g.direction,g.power,g.balls]);g.endGestureOnResize(393,852);
 assert.equal(g.paused,false);assert.equal(g.dragging,false);assert.equal(g.activeTouch,null);assert.equal(g.observationTouches.size,0);
 assert.equal(JSON.stringify([g.direction,g.power,g.balls]),before);
});

test('editor mouse-to-touch simulation cannot place or aim before right-drag observation',()=>{
 const g=game();g.hudPixelRatio=1;g.previewObservationAllowed=()=>true;
 const calls=[];g.cameraRig={observe(...args){calls.push(args);}};
 g.begin=()=>{throw Error('right mouse leaked into gameplay');};
 const event=(button,x,y)=>({getButton:()=>button,getID:()=>0,getLocation:()=>({x,y})});
 const before=JSON.stringify([g.direction,g.balls]);environment.EDITOR=true;
 try{
  g.touchStart(event(2,200,200));g.previewMouseDown(event(2,200,200));
  g.touchMove(event(2,230,210));g.previewMouseMove(event(2,230,210));
  g.touchEnd(event(0,230,210));g.previewMouseUp(event(0,230,210));
 }finally{environment.EDITOR=false;}
 assert.deepEqual(calls,[[30,10,1]]);assert.equal(g.previewPointer,null);
 assert.equal(JSON.stringify([g.direction,g.balls]),before);
});

test('preview releases camera capture on hover when the editor omits mouseup',()=>{
 const g=game();g.desktopPreview=()=>true;g.previewObservationAllowed=()=>true;g.previewPointer={x:200,y:200};
 g.cameraRig={observe(){throw Error('hover must not rotate camera');}};
 g.previewMouseMove({getButton:()=>-1,getLocation:()=>({x:220,y:200})});assert.equal(g.previewPointer,null);
});

for(const phase of ['ready','placing','choice','over'])test('return releases the previous shot origin in '+phase,()=>{
 const g=game();g.referee.phase=phase;g.viewState.lock();let unlocked=false,returned=false;
 g.balls[0].x=.25;g.balls[0].z=-.4;g.direction={x:1,z:0};g.power=3.7;
 g.tip.open();g.tip.select(.2,.3);g.tip.confirm();
 g.cameraRig={setMode(){},unlock(){unlocked=true;},returnToShot(cue,direction,height,reduced,tip,power){
  assert.equal(unlocked,true);assert.deepEqual({x:cue.x,z:cue.z},{x:.25,z:-.4});
  assert.deepEqual(direction,{x:1,z:0});assert.deepEqual(tip,{x:.2,y:.3});assert.equal(power,3.7);returned=true;
 }};
 g.switchView();assert.equal(returned,true);assert.equal(g.viewState.shotLocked,false);
});

test('reserved and moving shots keep their origin until settlement or cancellation',()=>{
 const g=game();let unlocked=0;g.cameraRig={unlock(){unlocked++;}};
 g.shotSequence.begin({gameId:g.gameId,player:g.referee.current,direction:g.direction,power:g.power,tipOffset:{x:0,y:0},selectedGroup:g.referee.selected});
 g.viewState.lock();g.syncShotCamera();assert.equal(unlocked,0);
 g.shotSequence.cancelBeforeContact();g.syncShotCamera();assert.equal(unlocked,1);assert.equal(g.viewState.shotLocked,false);
 g.referee.phase='shooting';g.viewState.lock();g.syncShotCamera();assert.equal(unlocked,1);
 g.referee.phase='ready';g.syncShotCamera();assert.equal(unlocked,2);
});

test('animated return finishes at the complete current-shot pose including direction and tip',()=>{
 const directory=require('node:path').dirname(process.env.BILLIARDS_GAME_MODULE);
 const {CameraRig}=require(require('node:path').join(directory,'BilliardsCameraRig.js'));
 const {solveCamera}=require(require('node:path').join(directory,'BilliardsCameraMath.js'));
 const rig=new CameraRig({node:{setPosition(){},lookAt(){}}});
 const cue={x:.2,z:.6},direction={x:1,z:0},tip={x:.2,y:.3};
 rig.returnToShot(cue,direction,.2,false,tip,3.7);
 const layout={width:852,height:393,playArea:{x:0,y:0,width:852,height:393}};
 for(let i=0;i<3;i++)rig.apply('first-person',layout,cue,direction,.2,tip,3.7,.1);
 assert.deepEqual(rig.freePose,solveCamera(cue,direction,.2,tip,3.7));
});

test('settlement releases the origin even while the button feedback animation is active',()=>{
 const g=game();let unlocked=false;g.cameraRig={unlock(){unlocked=true;}};
 g.shotSequence.begin({gameId:g.gameId,player:g.referee.current,direction:g.direction,power:g.power,tipOffset:{x:0,y:0},selectedGroup:g.referee.selected});
 g.shotSequence.advance(.22,()=>true);g.referee.phase='ready';g.viewState.lock();
 assert.equal(g.shotSequence.active,true);assert.equal(g.shotSequence.committed,true);
 g.syncShotCamera();assert.equal(unlocked,true);assert.equal(g.viewState.shotLocked,false);
});

test('mobile Creator preview anchors the landscape frame outside flex centering',()=>{
 const previous=global.document,style={};global.document={getElementById:()=>({style,parentElement:{classList:{contains:c=>c==='contentWrap'}}})};
 environment.PREVIEW=true;platform.isMobile=true;
 try{game().prepareBrowserPreview();assert.deepEqual(style,{position:'fixed',left:'0',top:'0'});}
 finally{environment.PREVIEW=false;platform.isMobile=false;if(previous===undefined)delete global.document;else global.document=previous;}
});

test('preview frame adjustment leaves exports and ordinary page containers alone',()=>{
 const previous=global.document,style={};let creatorWrapper=true;
 global.document={getElementById:()=>({style,parentElement:{classList:{contains:()=>creatorWrapper}}})};platform.isMobile=true;
 try{
  game().prepareBrowserPreview();assert.deepEqual(style,{});
  environment.PREVIEW=true;creatorWrapper=false;game().prepareBrowserPreview();assert.deepEqual(style,{});
 }finally{environment.PREVIEW=false;platform.isMobile=false;if(previous===undefined)delete global.document;else global.document=previous;}
});

test('last pocket waits for visible fall before settlement, pause freezes it and reset clears it', () => {
    const { POCKETS } = require(require('node:path').join(require('node:path').dirname(process.env.BILLIARDS_TEST_MODULE), 'BilliardsTableGeometry.js'));
    const g = game();
    g.referee.isBreak = false;
    g.referee.groups = ['solid', 'stripe'];
    g.shoot();
    g.update(.22);
    g.balls.forEach(ball => Object.assign(ball, { vx: 0, vz: 0, wx: 0, wy: 0, wz: 0 }));
    Object.assign(g.balls[1], { x: POCKETS[0].x, z: POCKETS[0].z });
    g.update(1 / 240);
    assert.equal(g.balls[1].pocketed, true);
    assert.equal(g.referee.phase, 'shooting');
    assert.equal(g.pocketAnimation.position(1).y, .028575);
    g.pauseGame();
    const frozen = g.pocketAnimation.position(1);
    g.update(1);
    assert.deepEqual(g.pocketAnimation.position(1), frozen);
    g.paused = false;
    for (let i = 0; i < 4; i++) g.update(.1);
    assert.equal(g.pocketAnimation.active, false);
    assert.notEqual(g.referee.phase, 'shooting');
    g.pocketAnimation.start(g.balls[1], 0);
    g.reset();
    assert.equal(g.pocketAnimation.active, false);
    assert.equal(!!g.balls[1].pocketed, false);
});

function touchGame(mode='top') {
    const g=game();
    g.interactionMode=mode;
    g.viewState.mode=g.viewState.target='first-person';
    g.hudLayout={width:852,height:393,playArea:{x:0,y:0,width:852,height:393}};
    g.hudPixelRatio=2;
    g.hitUi=()=>false;g.actionNode=()=>({});g.markPointer=()=>{};
    g.tablePoint=(x,y)=>({x:x/1000,z:-y/1000});
    return g;
}
const finger=(g,id,x,y)=>({getID:()=>id,getLocation:()=>({x:x*g.hudPixelRatio,y:(g.hudLayout.height-y)*g.hudPixelRatio})});

test('top aiming points on press, follows every drag, and release retains the last direction',()=>{
    const g=touchGame(),cue=g.balls[0],before=JSON.stringify(g.balls);
    g.begin(400,300);
    const initial={...g.direction};assert.ok(initial.x>0);
    g.move(600,240);const final={...g.direction};assert.notDeepEqual(final,initial);
    const dx=.6-cue.x,dz=-.24-cue.z,length=Math.hypot(dx,dz);
    assert.deepEqual(final,{x:dx/length,z:dz/length});
    g.release(600,240);assert.deepEqual(g.direction,final);
    assert.equal(g.shotSequence.active,false);assert.equal(JSON.stringify(g.balls),before);
});

test('aim tap leaves the direction intact and horizontal adjustment never fires',()=>{
    const g=touchGame('aim'),before={...g.direction};
    g.touchStart(finger(g,1,400,140));g.touchEnd(finger(g,1,400,140));
    assert.deepEqual(g.direction,before);
    g.touchStart(finger(g,2,400,140));g.touchMove(finger(g,2,430,140));g.touchEnd(finger(g,2,450,140));
    assert.notDeepEqual(g.direction,before);assert.equal(g.shotSequence.active,false);
});

test('pull release reserves exactly one shot and commits only at its dynamic contact frame',()=>{
    const g=touchGame('aim');g.syncVisuals=()=>{};
    g.touchStart(finger(g,1,420,130));g.touchMove(finger(g,1,420,226));
    assert.equal(g.power,4);assert.equal(g.shotSequence.active,false);
    g.touchEnd(finger(g,1,420,226));assert.equal(g.shotSequence.contactMs,160);
    const shot=g.shotSequence.snapshot;assert.equal(shot.power,4);
    g.touchEnd(finger(g,1,420,226));assert.equal(g.shotSequence.snapshot,shot);
    g.shotSequence.advance(.159,()=>{throw Error('early contact');});
    let committed=0;g.shotSequence.advance(.001,snapshot=>{committed++;return snapshot===shot;});
    g.shotSequence.advance(.01,()=>{committed++;return true;});assert.equal(committed,1);
});

test('pull return-to-zero, touch cancel and second finger cannot submit shots',()=>{
    for(const reason of ['zero','cancel','second']){
        const g=touchGame('aim');
        g.touchStart(finger(g,1,420,130));g.touchMove(finger(g,1,420,220));
        if(reason==='zero')g.touchMove(finger(g,1,420,132));
        if(reason==='cancel')g.touchCancel(finger(g,1,420,220));
        if(reason==='second')g.touchStart(finger(g,2,520,220));
        g.touchEnd(finger(g,1,420,reason==='zero'?132:220));
        if(reason==='second')g.touchEnd(finger(g,2,520,220));
        assert.equal(g.shotSequence.active,false,reason);assert.equal(g.power,0,reason);
    }
});

test('a second top finger restores the direction before the first finger pressed',()=>{
    const g=touchGame(),before={...g.direction};
    g.touchStart(finger(g,1,400,140));assert.notDeepEqual(g.direction,before);
    g.touchStart(finger(g,2,500,140));assert.deepEqual(g.direction,before);
    g.touchEnd(finger(g,2,500,140));g.touchEnd(finger(g,1,400,140));
    assert.equal(g.shotSequence.active,false);
});

test('AI, movement and ball placement retain their own input permissions',()=>{
    for(const state of ['ai','moving','placing']){
        const g=touchGame('aim');
        if(state==='ai'){g.matchMode='ai';g.referee.current=1;}
        if(state==='moving')g.balls[1].vx=1;
        if(state==='placing'){g.referee.phase='placing';g.placeAt=()=>{};}
        g.begin(400,300);assert.equal(g.pullGesture.active,false,state);
        g.cancelDrag();g.release(400,300);assert.equal(g.shotSequence.active,false,state);
    }
});

test('free single-finger observation operates during AI and keeps the aim intact',()=>{
    const g=touchGame('free'),before={...g.direction},calls=[];
    g.matchMode='ai';g.referee.current=1;g.cameraRig={observe(...args){calls.push(args);}};
    g.begin(400,300);g.move(440,320);g.release(440,320);
    assert.deepEqual(calls,[[20,-10,1]]);assert.deepEqual(g.direction,before);
});

test('free tap aims on release while small finger jitter leaves the camera steady',()=>{
    const g=touchGame('free'),before={...g.direction};
    g.cameraRig={observe(){throw Error('tap jitter rotated the camera');}};
    g.begin(400,300);g.move(404,304);assert.deepEqual(g.direction,before);
    g.release(404,304);assert.notDeepEqual(g.direction,before);assert.equal(g.shotSequence.active,false);
});
test('a free orbit returning to its start cannot become tap aiming',()=>{
    const g=touchGame('free'),before={...g.direction};g.cameraRig={observe(){}};
    g.begin(400,300);g.move(440,320);g.move(400,300);g.release(400,300);
    assert.deepEqual(g.direction,before);
});
test('free tap cancellation, second finger and movement at release cannot change aim',()=>{
    for(const reason of ['cancel','second','moving','displaced','outside']){
        const g=touchGame('free'),before={...g.direction};
        g.touchStart(finger(g,1,420,140));
        if(reason==='cancel')g.touchCancel(finger(g,1,420,140));
        if(reason==='second')g.touchStart(finger(g,2,520,140));
        if(reason==='moving')g.balls[1].vx=1;
        if(reason==='outside')g.tablePoint=()=>null;
        g.touchEnd(finger(g,1,reason==='displaced'?440:420,140));
        if(reason==='second')g.touchEnd(finger(g,2,520,140));
        assert.deepEqual(g.direction,before,reason);assert.equal(g.shotSequence.active,false,reason);
    }
});

test('result table inspection routes its return button while allowing free observation outside it',()=>{
    const g=touchGame('free'),target={};g.paused=true;g.panelMode='view';
    g.panels={actionIds:['return-result']};
    g.actionNode=action=>action==='modal-0'?target:{};
    g.hitUi=node=>node===target;
    g.begin(400,300);assert.equal(g.pendingAction,'modal-0');g.release(400,300);
    assert.equal(g.panelMode,'result');
    g.panelMode='view';g.hitUi=()=>false;g.begin(400,300);
    assert.equal(g.dragging,true);assert.equal(g.pendingAction,null);assert.equal(g.freeTap,null);
});
