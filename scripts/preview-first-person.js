// Real Cocos controls; synthetic DOM or Creator engine touch. Fixtures are injected by the development harness.
async function previewFirstPerson({inputMode=location.protocol==='packages:'?'engine':'dom'}={}){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),canvas=document.getElementById('GameCanvas'),results=[],measurements={};
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),frame=async()=>{await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));await wait(20);};
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Object.assign(Error(name),{results,measurements});};
 const until=async(fn,ms=6000)=>{const at=performance.now();while(!fn()&&performance.now()-at<ms)await wait(20);if(!fn())throw Error('Timeout '+g.referee.phase+'/'+g.viewState.mode);};
 const send=(type,p,id=726)=>{if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,id),event=new m.EventTouch([finger],false,({touchstart:m.Input.EventType.TOUCH_START,touchmove:m.Input.EventType.TOUCH_MOVE,touchend:m.Input.EventType.TOUCH_END,touchcancel:m.Input.EventType.TOUCH_CANCEL})[type],[finger]);event.touch=finger;event.simulate=true;m.input._dispatchEventTouch(event);return;}const r=canvas.getBoundingClientRect(),finger=new Touch({identifier:id,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'||type==='touchcancel'?[]:[finger],changedTouches:[finger]}));};
 const tap=async n=>{const p=g.hudCamera.worldToScreen(n.worldPosition);send('touchstart',p);send('touchend',p);await frame();};
 const point=(x,y)=>({x:x*g.hudPixelRatio,y:(g.hudLayout.height-y)*g.hudPixelRatio});
 const action=async id=>{const i=g.panels.actionIds.indexOf(id);check('Modal action exists '+id,i>=0);await tap(g.panels.buttons[i].node.parent);};
 const saved={...g.settings.value},preferred=g.viewState.preference.mode,seen=g.viewState.preference.seen;
 try{
  check('First-person modules and fixtures are available',!!g.cameraRig&&!!g.trajectoryView&&window.__fpFixtures?.shots.length===16);
  g.draftMode='local';g.startMatch();g.viewState.preference.set('overhead');g.settings.set('sound',false);g.settings.set('reducedMotion',true);await frame();
  check('Placement forces overhead and disables the view action',g.viewState.mode==='overhead'&&!g.viewCanSwitch);
  await tap(g.actions[1].node.parent);check('Touch placement reaches ready',g.referee.phase==='ready');
  const before={direction:{...g.direction},power:g.power,tip:{...g.tip.value},balls:JSON.stringify(g.balls),rack:JSON.stringify(g.rackConfig)};
  for(let i=0;i<10;i++){await tap(g.viewButton.node.parent);check('View toggle '+i,g.viewState.mode===(i%2?'overhead':'first-person'));}
  check('Ten actual view touches preserve all shot parameters and rack configuration',JSON.stringify(before)===JSON.stringify({direction:{...g.direction},power:g.power,tip:{...g.tip.value},balls:JSON.stringify(g.balls),rack:JSON.stringify(g.rackConfig)}));
  await tap(g.viewButton.node.parent);check('Preferred mode is stored independently',new g.viewState.preference.constructor(m.sys.localStorage).mode==='first-person');
  check('Perspective camera and depth-tested world table are active',g.camera.projection===m.Camera.ProjectionType.PERSPECTIVE&&g.tableView.node.active&&g.ballView.light.node.active);
  check('HUD number impostors are hidden in perspective',g.numberNodes.every(n=>!n.active));
  const a=g.hudLayout.playArea,x=a.x+a.width/2,y=a.y+a.height*.65,start=point(x,y),dir=JSON.stringify(g.direction);
  send('touchstart',start);send('touchmove',point(x+4,y+4));await frame();check('Small diagonal touch does not move aim',JSON.stringify(g.direction)===dir);
  send('touchmove',point(x+20,y+4));send('touchmove',point(x+70,y+60));send('touchend',point(x+70,y+60));await frame();
  check('Horizontal axis changes direction without lifting the eye',JSON.stringify(g.direction)!==dir&&g.eyeHeight===.2);
  const newDir=JSON.stringify(g.direction),oldHeight=g.eyeHeight;send('touchstart',point(x,y));send('touchmove',point(x,y-15));send('touchmove',point(x+55,y-90));send('touchend',point(x+55,y-90));await frame();
  check('Vertical axis changes observation and preserves exact shot direction',g.eyeHeight>oldHeight&&JSON.stringify(g.direction)===newDir);
  const at=JSON.stringify(g.direction);send('touchstart',point(x,y));send('touchend',point(x,y));await frame();check('Lifting and starting a new relative gesture never jumps to the touch point',JSON.stringify(g.direction)===at&&!g.shotSequence.active);
  send('touchstart',point(x,y),726);send('touchstart',point(x+50,y),727);send('touchcancel',point(x+50,y),727);check('Second touch cannot steal the first-person owner',g.activeTouch===726);send('touchcancel',point(x,y),726);await frame();check('Touch cancellation never shoots',!g.shotSequence.active&&g.activeTouch===null);
  const settings={...g.settings.value},height=g.eyeHeight;await tap(g.spinButton.node.parent);await frame();check('Tip draft freezes perspective and disables switching',g.tip.active&&g.viewState.mode==='first-person'&&!g.viewCanSwitch);await tap(g.spinPanel.cancel.node.parent);
  check('Tip cancel keeps view and observation height',g.viewState.mode==='first-person'&&g.eyeHeight===height);
  await tap(g.fineButton.node.parent);const yaw=Math.atan2(g.direction.x,g.direction.z);await tap(g.finePlus.node.parent);check('Fine aim is shared by both modes',Math.abs(Math.atan2(g.direction.x,g.direction.z)-yaw-Math.PI/1800)<1e-8);
  await tap(g.viewButton.node.parent);check('View change closes fine control without changing its result',!g.fineAim.active&&g.viewState.mode==='overhead');
  g.settings.set('reducedMotion',false);await tap(g.viewButton.node.parent);const shotId=g.lastContactShotId;g.shoot();await tap(g.viewButton.node.parent);check('During the camera transition neither a shot nor a second switch is accepted',g.lastContactShotId===shotId&&!g.shotSequence.active&&g.viewState.target==='first-person');await until(()=>!g.viewState.transitioning);
  const f=window.__fpFixtures.shots[0];await fpSetup(f,'first-person');g.settings.set('aimGuide',true);await until(()=>g.aimPrediction?.status==='complete');
  check('Perspective uses the existing full-table prediction',g.trajectoryView.node.active&&g.aimPrediction.cue.points.length>1);
  const prediction=g.aimPrediction,builds=g.trajectoryView.buildCount,hash=JSON.stringify(g.balls);g.eyeHeight=.25;await frame();check('Vertical observation reuses the exact same prediction object',g.aimPrediction===prediction&&JSON.stringify(g.balls)===hash);
  await tap(g.viewButton.node.parent);await until(()=>!g.viewState.transitioning);await tap(g.viewButton.node.parent);await until(()=>!g.viewState.transitioning);check('View switches do not rerun the prediction',g.aimPrediction===prediction);
  check('Perspective temporarily hides the magnifier without changing its setting',!g.magnifier.node.active&&g.settings.value.magnifier===settings.magnifier);
  const motion=[],initial=JSON.stringify(g.balls),pose=JSON.stringify(g.cameraRig.pose),sample=()=>{if(g.shotSequence.active||g.referee.phase==='shooting')motion.push({ms:g.shotSequence.elapsedMs,moved:JSON.stringify(g.balls)!==initial,pose:JSON.stringify(g.cameraRig.pose)});};m.director.on(m.Director.EVENT_AFTER_DRAW,sample);
  await tap(g.shotButton.node);await until(()=>g.shotSequence.committed);m.director.off(m.Director.EVENT_AFTER_DRAW,sample);const first=motion.find(f=>f.moved);
  check('Real first-person touch starts motion only on the shared 220ms frame',first?.ms===220&&motion.filter(f=>f.ms<220).every(f=>!f.moved));
  check('Camera stays at its shot-time pose while the cue moves',motion.every(f=>f.pose===pose)&&!!g.cameraRig.locked);
  const committed=g.lastContactShotId;await tap(g.resetLabel.node);const frozen=JSON.stringify(g.balls);await wait(150);check('Pause freezes the first-person physical shot',g.paused&&JSON.stringify(g.balls)===frozen);await action('resume');await frame();check('Resume retains the shot and camera lock without committing again',g.lastContactShotId===committed&&!!g.cameraRig.locked);
  await tap(g.viewButton.node.parent);await until(()=>!g.viewState.transitioning);check('Moving perspective can return to overhead without overwriting the preference',g.viewState.mode==='overhead'&&g.viewState.preference.mode==='first-person');check('Moving overhead cannot enter first person',!g.viewCanSwitch);
  await fpSetup(f,'first-person');g.referee.phase='placing';g.referee.hand='any';await frame();check('A foul/free-ball state forces overhead and preserves preference',g.viewState.mode==='overhead'&&g.viewState.preference.mode==='first-person');
  g.referee.confirmPlacement(g.balls);await frame();await until(()=>!g.viewState.transitioning);check('Legal placement restores the preferred human view',g.viewState.mode==='first-person');
  g.matchMode='ai';g.referee.current=1;await frame();check('AI remains overhead and cannot be controlled through view or table input',g.viewState.mode==='overhead'&&!g.viewCanSwitch&&g.viewState.preference.mode==='first-person');
  g.matchMode='local';g.referee.current=0;g.referee.phase='ready';await frame();await until(()=>!g.viewState.transitioning);g.settings.set('reducedMotion',false);await tap(g.viewButton.node.parent);m.game.emit(m.Game.EVENT_HIDE);await frame();m.game.emit(m.Game.EVENT_SHOW);await frame();check('Backgrounding a camera change leaves an explicitly paused match',g.paused&&!g.shotSequence.active&&!g.viewState.transitioning);await action('resume');
  g.reset();await frame();check('Reset invalidates old camera lock and transitions',g.viewState.mode==='overhead'&&!g.cameraRig.locked&&!g.viewState.transitioning);
  await fpSetup(window.__fpFixtures.shots[7],'first-person');g.settings.set('aimGuide',true);await until(()=>g.aimPrediction?.status==='complete');check('A real side-spin prediction reports offscreen world segments',g.trajectoryView.offscreen);await tap(g.viewButton.node.parent);await until(()=>!g.viewState.transitioning);await tap(g.viewButton.node.parent);await until(()=>!g.viewState.transitioning);check('Returning to perspective restores its offscreen hint without a new prediction',g.trajectoryView.offscreen&&g.trajectoryLabel.string.includes('全轨迹'));
  const meshCount=()=>g.trajectoryView.meshes.filter(Boolean).reduce((s,m)=>s+(m.struct.primitives[0].indexView?.count??0),0),completeCount=meshCount();g.aimPrediction.status='incomplete';await frame();check('Incomplete world prediction clears terminal markers and says not settled',meshCount()<completeCount&&g.trajectoryLabel.string.includes('未停稳'));g.aimPrediction.status='invalid';await frame();check('Invalid prediction hides the world guide while preserving the power label',!g.trajectoryView.node.active&&g.trajectoryLabel.string.includes('暂无法')&&g.powerLabel.string.startsWith('击球力度'));measurements.controlledPredictionStates=true;
  await fpSetup(f,'first-person');g.referee.phase='over';g.referee.winner=1;g.referee.message='提前进8，判对手获胜';await frame();check('A paused result modal forces overhead rather than freezing the last aim view',g.panelMode==='result'&&g.paused&&g.viewState.mode==='overhead'&&g.viewState.preference.mode==='first-person');await action('view-table');check('Finished-table inspection is overhead',g.viewState.mode==='overhead'&&g.panelMode==='view');
  await fpSetup(f,'first-person');const oldViewState=g.viewState,badStore=new oldViewState.preference.constructor({getItem(){throw Error('unavailable')},setItem(){throw Error('unavailable')}});g.viewState=new oldViewState.constructor(badStore);await frame();await tap(g.viewButton.node.parent);await until(()=>!g.viewState.transitioning);check('View storage failure remains usable and displays an in-session warning',g.viewState.mode==='first-person'&&!badStore.persistent&&g.viewMessage.includes('存储'));g.viewState=oldViewState;
  measurements.contact=motion;measurements.worldBuilds={before:builds,after:g.trajectoryView.buildCount};check('No game errors or unhandled rejections',(window.__fpErrors??[]).length===0);
  return {engine:cc.ENGINE_VERSION,inputMode,viewport:[innerWidth,innerHeight,devicePixelRatio],results,measurements,errors:window.__fpErrors??[]};
 }finally{g.viewState.preference.seen=seen;g.viewState.preference.set(preferred);for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.draftMode='local';g.startMatch();}
}
async function fpSetup(f,mode='first-person'){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');g.matchStarted=true;g.matchMode='local';g.reset();g.balls=f.balls.map(b=>({...b}));Object.assign(g.referee,{phase:'ready',hand:null,isBreak:false,groups:['solid','stripe'],selected:'solid',message:''});g.direction={...f.command.direction};g.power=f.command.power;g.tip.open();g.tip.select(f.command.tipOffset.x,f.command.tipOffset.y);g.tip.confirm();g.notificationAt=-100;g.settings.set('sound',false);g.viewState.preference.set(mode);g.viewState.preference.seen=true;g.viewState.to(mode,true);g.viewMessageUntil=0;g.layoutStamp='';g.syncVisuals();await new Promise(r=>setTimeout(r,80));return g;
}
async function previewFirstPersonPairs(ids,{inputMode=location.protocol==='packages:'?'engine':'dom'}={}){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),canvas=document.getElementById('GameCanvas'),saved={...g.settings.value},originalUpdate=g.update,report=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const send=(type,p)=>{if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,795),e=new m.EventTouch([finger],false,type==='touchstart'?m.Input.EventType.TOUCH_START:m.Input.EventType.TOUCH_END,[finger]);e.touch=finger;e.simulate=true;m.input._dispatchEventTouch(e);}else{const r=canvas.getBoundingClientRect(),t=new Touch({identifier:795,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));}};
 try{
  // Controlled integration time, not wall-clock gameplay timing. Each actual render advances 0.1 simulation seconds.
  g.update=function(){originalUpdate.call(g,.1);};g.settings.set('aimGuide',false);g.settings.set('reducedMotion',true);
  for(const f of window.__fpFixtures.shots.filter(f=>ids.includes(f.id))){const runs=[];
   for(const mode of ['overhead','first-person']){
    await fpSetup(f,mode);if(g.viewState.mode!==mode)throw Error(f.id+' requested '+mode+' but got '+g.viewState.mode);const events=[],observe=g.referee.observe.bind(g.referee);g.referee.observe=(e,b)=>{events.push({...e});observe(e,b);};
    const p=g.hudCamera.worldToScreen(g.shotButton.node.worldPosition);send('touchstart',p);send('touchend',p);const start=performance.now();
    while((g.shotSequence.active||g.referee.phase==='shooting')&&performance.now()-start<20000)await wait(10);
    if(g.shotSequence.active||g.referee.phase==='shooting')throw Error(f.id+' settle timeout');
    runs.push({mode,actualMode:mode==='first-person'?'first-person':'overhead',balls:g.balls.map(b=>({id:b.id,x:b.x,z:b.z,pocketed:b.pocketed})),events,winner:g.referee.winner,message:g.referee.message,wallMs:performance.now()-start});
   }
   const [a,b]=runs,error=Math.max(...a.balls.filter(p=>!p.pocketed).map(p=>Math.hypot(p.x-b.balls[p.id].x,p.z-b.balls[p.id].z))),eventsEqual=JSON.stringify(a.events)===JSON.stringify(b.events),outcome=a.winner===b.winner&&a.message===b.message&&a.balls.every(p=>p.pocketed===b.balls[p.id].pocketed);
   const record={id:f.id,passed:error<=.001&&eventsEqual&&outcome,endpointErrorM:error,eventsEqual,outcome,runs};report.push(record);if(!record.passed)throw Object.assign(Error('Pair mismatch '+f.id),{report});
  }
  return {scope:'Actual Cocos frame loop, synthetic '+inputMode+' touch, controlled 0.1s per rendered frame; separate contact tests use natural time',report};
 }finally{g.update=originalUpdate;for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.reset();}
}
async function previewFirstPersonSafety(){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),report=[],f=window.__fpFixtures.shots[0],saved={...g.settings.value};
 try{g.settings.set('aimGuide',false);g.settings.set('reducedMotion',true);
  for(const item of window.__fpFixtures.safety)for(const height of [.15,.25]){
   await fpSetup(f,'first-person');Object.assign(g.balls[0],item.cue);g.direction={...item.direction};g.eyeHeight=height;g.layoutStamp='';g.viewState.to('first-person',true);await new Promise(r=>setTimeout(r,35));
   const pose=g.cameraRig.pose,p=g.camera.worldToScreen(new m.Vec3(g.balls[0].x,.028575,g.balls[0].z)),area=g.hudLayout.playArea,x=p.x/g.hudPixelRatio,y=g.hudLayout.height-p.y/g.hudPixelRatio;
   const pass=g.viewState.mode==='overhead'?g.viewState.reason==='unsafe-camera'&&g.viewState.preference.mode==='first-person':!!pose?.safe&&x>=area.x&&x<=area.x+area.width&&y>=area.y&&y<=area.y+area.height;
   report.push({id:item.id,height,mode:g.viewState.mode,pose,projectedCue:{x,y},passed:pass});if(!pass)throw Object.assign(Error('Unsafe '+item.id+'/'+height),{report});
  }return {viewport:[innerWidth,innerHeight,devicePixelRatio],report};
 }finally{for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.reset();}
}
async function previewFirstPersonPerformance(){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),saved={...g.settings.value},oldRate=m.game.frameRate,canvas=document.getElementById('GameCanvas'),runs=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),count=()=>({nodes:g.node.getComponentsInChildren(m.Component).length,materials:g.materials.length+g.ballView.materials.length+g.ballView.cueMaterials.length,worldMeshes:g.tableView.meshes.length+g.ballView.shadowMeshes.length+g.trajectoryView.meshes.filter(Boolean).length,memory:m.director.root.device.memoryStatus?{...m.director.root.device.memoryStatus}:null});
 const point=(x,y)=>({x:x*g.hudPixelRatio,y:(g.hudLayout.height-y)*g.hudPixelRatio});
 const send=(type,p)=>{const r=canvas.getBoundingClientRect(),t=new Touch({identifier:865,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));};
 try{
  m.game.frameRate=60;g.settings.set('sound',false);g.settings.set('reducedMotion',false);g.settings.set('aimGuide',false);g.draftMode='local';g.startMatch();g.referee.confirmPlacement(g.balls);g.viewState.preference.seen=true;g.viewMessageUntil=0;
  for(let round=0;round<3;round++)for(const kind of ['overhead','idle','drag','prediction','settled-prediction','transition']){
   g.reset();g.referee.confirmPlacement(g.balls);g.notificationAt=-100;g.referee.message='';g.settings.set('aimGuide',['prediction','settled-prediction'].includes(kind));g.power=['prediction','settled-prediction'].includes(kind)?4:2.4;g.viewState.to(kind==='overhead'?'overhead':'first-person',true);g.viewState.preference.set(kind==='overhead'?'overhead':'first-person');g.viewMessageUntil=0;await wait(1000);
   if(document.visibilityState!=='visible')throw Error('Performance page is hidden');
   const frames=[],updates=[],a=g.hudLayout.playArea,x=a.x+a.width/2,y=a.y+a.height*.65;let start=performance.now(),updateStart=0,lastChange=0;
   if(kind==='drag'){send('touchstart',point(x,y));send('touchmove',point(x+15,y));}
   const before=()=>{updateStart=performance.now();const t=(performance.now()-start)/1000;
    if(kind==='drag')send('touchmove',point(x+45*Math.sin(t*1.4)+15,y));
    if(kind==='prediction'&&t-lastChange>.5){lastChange=t;const theta=Math.PI+.012*Math.sin(t);g.direction={x:Math.sin(theta),z:Math.cos(theta)};}
    if(kind==='transition'&&t-lastChange>.7&&!g.viewState.transitioning){lastChange=t;g.switchView();}
   },after=()=>updates.push(performance.now()-updateStart),draw=()=>frames.push(performance.now());
   m.director.on(m.Director.EVENT_BEFORE_UPDATE,before);m.director.on(m.Director.EVENT_AFTER_UPDATE,after);m.director.on(m.Director.EVENT_AFTER_DRAW,draw);
   await wait(10000);m.director.off(m.Director.EVENT_BEFORE_UPDATE,before);m.director.off(m.Director.EVENT_AFTER_UPDATE,after);m.director.off(m.Director.EVENT_AFTER_DRAW,draw);if(kind==='drag')send('touchend',point(x,y));
   const intervals=frames.slice(1).map((v,i)=>v-frames[i]).sort((a,b)=>a-b),averageFps=1000*(frames.length-1)/(frames.at(-1)-frames[0]),p95FrameMs=intervals[Math.floor(intervals.length*.95)];
   const record={round:round+1,kind,frames:frames.length,averageFps,p95FrameMs,maxFrameMs:Math.max(...intervals),maxUpdateMs:Math.max(...updates),intervals,passed:averageFps>=(['drag','transition'].includes(kind)?45:50)&&p95FrameMs<=33.4,visible:document.visibilityState,focused:document.hasFocus()};runs.push(record);window.__fpPerfProgress={completed:runs.length,total:18,last:{round:record.round,kind,averageFps,p95FrameMs,passed:record.passed}};
  }
  g.settings.set('reducedMotion',true);g.settings.set('aimGuide',true);await fpSetup(window.__fpFixtures.shots[0],'first-person');await wait(700);for(let i=0;i<20;i++){g.switchView();await wait(20);}await wait(500);const before=count();const prediction=g.aimPrediction;
  for(let i=0;i<50;i++){g.switchView();await wait(20);}await wait(400);const after=count();
  const gpuStable=!before.memory||!after.memory||after.memory.bufferSize<=before.memory.bufferSize+65536&&after.memory.textureSize<=before.memory.textureSize+262144;
  return {scope:'Local Chromium, 393x852 DPR2, 60fps cap, full 16-ball rack; not real-device certification',runs,resources:{before,after,passed:before.nodes===after.nodes&&before.materials===after.materials&&before.worldMeshes===after.worldMeshes,predictionReused:g.aimPrediction===prediction,gpuStable},passed:gpuStable&&runs.every(r=>r.passed)&&before.nodes===after.nodes&&before.materials===after.materials};
 }finally{m.game.frameRate=oldRate;for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.reset();}
}
async function previewFirstPersonLayout(){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');await fpSetup(__fpFixtures.shots[0],'first-person');
 const bounds=n=>{const t=n.getComponent(m.UITransform),s=t.contentSize,pts=[-1,1].flatMap(x=>[-1,1].map(y=>g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(s.width*x/2,s.height*y/2,0)))));return {x:Math.min(...pts.map(p=>p.x))/g.hudPixelRatio,y:g.hudLayout.height-Math.max(...pts.map(p=>p.y))/g.hudPixelRatio,w:(Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)))/g.hudPixelRatio,h:(Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y)))/g.hudPixelRatio};};
 const nodes=[g.viewButton.node.parent,g.resetLabel.node,g.fineButton.node.parent,g.shotButton.node,g.spinButton.node.parent,g.powerControl],rects=nodes.map(bounds),checks=[];
 const check=(name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw Object.assign(Error(name),{checks,rects});};
 check('All perspective HUD touch targets are at least 44 logical pixels',rects.every(r=>r.w>=43.99&&r.h>=43.99));
 check('All perspective controls remain inside the canvas and safe area',rects.every(r=>r.x>=-.01&&r.y>=-.01&&r.x+r.w<=g.hudLayout.width+.01&&r.y+r.h<=g.hudLayout.height+.01));
 check('Perspective controls do not overlap',rects.every((a,i)=>rects.every((b,j)=>i===j||a.x+a.w<=b.x+.01||b.x+b.w<=a.x+.01||a.y+a.h<=b.y+.01||b.y+b.h<=a.y+.01)));
 const hostLeft=g.hudLayout.width-108;check('View action keeps eight pixels before the reference host capsule',rects[0].x+rects[0].w<=hostLeft-8+.01);
 check('HUD remains orthographic in perspective mode',g.hudCamera.projection===m.Camera.ProjectionType.ORTHO&&g.camera.projection===m.Camera.ProjectionType.PERSPECTIVE);
 check('Camera aspect matches the actual reserved scene rectangle',Math.abs(g.camera.camera.aspect-g.hudLayout.playArea.width/g.hudLayout.playArea.height)<.01);
 return {viewport:[innerWidth,innerHeight,devicePixelRatio],hud:[g.hudLayout.width,g.hudLayout.height,g.hudPixelRatio],rects,checks};
}
async function firstPersonContactScene({height=.2,near=false,rail=false,guides=false,shadows=true,gapM=.001}={}){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');await fpSetup(__fpFixtures.shots[0],'first-person');g.settings.set('aimGuide',guides);
 if(rail){Object.assign(g.balls[0],{x:.63-.028575-gapM,z:.25});g.direction={x:-1,z:0};Object.assign(g.balls[1],{x:near?.08:-.45,z:.25});g.tip.open();g.tip.select(0,1);g.tip.confirm();}
 else {Object.assign(g.balls[0],{x:0,z:.65});g.direction={x:0,z:-1};Object.assign(g.balls[1],{x:.08,z:near?.25:-.95});}
 g.balls[8].pocketed=true;g.eyeHeight=height;g.viewState.to('first-person',true);g.viewMessageUntil=0;g.layoutStamp='';await new Promise(r=>setTimeout(r,180));g.viewMessageUntil=0;g.ballView.light.shadowEnabled=shadows;if(!g.ballView.__fpOriginalSync)g.ballView.__fpOriginalSync=g.ballView.sync;const original=g.ballView.__fpOriginalSync;g.ballView.sync=shadows?original:function(b){original.call(this,b);this.shadows.forEach(n=>n.active=false);};await new Promise(r=>setTimeout(r,80));
 return {heightRequested:height,gapM:rail?gapM:null,rail,near,guides,shadows,mode:g.viewState.mode,pose:g.cameraRig.pose,ballHeight:g.ballNodes[0].position.y,radius:.028575,clothTop:0,hdr:m.director.root.pipeline.pipelineSceneData.isHDR,light:{illuminance:g.ballView.light.illuminance,pcf:g.ballView.light.shadowPcf,mapSize:g.node.scene.globals.shadows.shadowMapSize},footprints:g.ballView.shadows.filter(n=>n.active).length};
}
