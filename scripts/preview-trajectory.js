// Controlled initial positions; actual Cocos prediction, rendering, touch and live physics.
async function previewTrajectory({inputMode=location.protocol==='packages:'?'engine':'dom'}={}){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),canvas=document.getElementById('GameCanvas');
 const saved={...g.settings.value},results=[],measurements={},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const frame=()=>new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));
 const node=async n=>{const p=g.hudCamera.worldToScreen(n.worldPosition);if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,989);for(const type of [m.Input.EventType.TOUCH_START,m.Input.EventType.TOUCH_END]){const e=new m.EventTouch([finger],false,type,[finger]);e.touch=finger;e.simulate=true;m.input._dispatchEventTouch(e);}}else{const r=canvas.getBoundingClientRect(),finger=new Touch({identifier:989,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});for(const type of ['touchstart','touchend'])canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[finger],changedTouches:[finger]}));}await frame();};
 const fixture=(kind='cut')=>{
  g.reset();g.settings.set('aimGuide',true);g.settings.set('sound',false);g.referee.confirmPlacement(g.balls);g.referee.isBreak=false;g.referee.groups=['solid','stripe'];g.referee.selected='solid';g.referee.message='';
  for(const b of g.balls){b.pocketed=![0,1,8].includes(b.id);b.vx=b.vz=b.wx=b.wy=b.wz=0;}
  Object.assign(g.balls[0],{x:0,z:.65});Object.assign(g.balls[1],{x:.025,z:.1});Object.assign(g.balls[8],{x:-.42,z:-1});g.direction={x:0,z:-1};g.power=2.4;
  if(kind==='pocket'){Object.assign(g.balls[0],{x:.35,z:0});Object.assign(g.balls[1],{x:.52,z:0});g.direction={x:1,z:0};g.power=1.2;}
  if(kind==='bank'){Object.assign(g.balls[0],{x:.3,z:.3});Object.assign(g.balls[1],{x:-.2,z:.3});g.direction={x:1,z:0};}
  g.notificationAt=-1000;g.layoutStamp='';g.syncVisuals();
 };
 const complete=async()=>{const start=performance.now();while(performance.now()-start<8000){if(g.aimPrediction?.status==='complete')return performance.now()-start;await wait(16);}throw Error('Prediction did not reach rest within 8 seconds: '+g.aimPrediction?.status);};
 window.__trajectoryReview=async kind=>{fixture(kind);await complete();return {cue:g.aimPrediction.cue,target:g.aimPrediction.target}};
 try{
  fixture();const before=JSON.stringify(g.balls);measurements.cutPredictionMs=await complete();
  const prediction=g.aimPrediction;check('Cue and first target both have full trajectories',prediction.cue.points.length>2&&prediction.target?.id===1&&prediction.target.points.length>1);
  check('Prediction leaves live positions, spin and pocket flags unchanged',JSON.stringify(g.balls)===before);
  check('Guide caption identifies white cue and gold numbered target',g.powerLabel.string.includes('母球白')&&g.powerLabel.string.includes('1号金'));
  check('Actual graphics contain visible trajectories',g.aimGraphics.impl.pathLength>0);
  measurements.cut={cue:prediction.cue,target:prediction.target};
  await node(g.shotButton.node);check('Touch starts preparation without early ball motion',g.shotSequence.active&&!g.shotSequence.committed&&JSON.stringify(g.balls)===before);
  const started=performance.now();while((g.shotSequence.active||g.referee.phase==='shooting')&&performance.now()-started<15000)await wait(16);
  check('The live shot settles',g.referee.phase!=='shooting');
  const cue=g.balls[0],target=g.balls[1];measurements.endpointErrorM={cue:Math.hypot(cue.x-prediction.cue.end.x,cue.z-prediction.cue.end.z),target:Math.hypot(target.x-prediction.target.end.x,target.z-prediction.target.end.z)};
  check('Live cue stops at its predicted mark within 1mm',measurements.endpointErrorM.cue<=.001);check('Live target stops at its predicted mark within 1mm',measurements.endpointErrorM.target<=.001);
  fixture('bank');measurements.bankPredictionMs=await complete();check('Bank prediction finds the target after cushion contact',g.aimPrediction.target?.id===1&&g.aimPrediction.cue.points.some(p=>p.x>.599));
  fixture('pocket');await complete();check('Predicted target pocket uses an in-pocket outcome',g.aimPrediction.target?.pocket!==null&&g.powerLabel.string.includes('入袋'));
  fixture();await complete();const old=g.aimPrediction;g.power=1.2;await frame();check('Power edits discard the old endpoint immediately',g.aimPrediction!==old);await complete();
  const low=g.aimPrediction;g.tip.open();g.tip.select(0,-.7);g.tip.confirm();await frame();check('Confirmed tip edits invalidate the old prediction',g.aimPrediction!==low);await complete();
  const spun=g.aimPrediction;g.direction={x:.03,z:-Math.sqrt(1-.03*.03)};await frame();check('Aim edits invalidate the old prediction',g.aimPrediction!==spun);await complete();
  g.settings.set('aimGuide',false);await frame();check('Aim setting clears trajectories and restores the power caption',g.aimGraphics.impl.pathLength===0&&g.powerLabel.string.startsWith('击球力度'));g.settings.set('aimGuide',true);await complete();
  g.pauseGame();await frame();check('Pause hides all predicted paths',g.aimGraphics.impl.pathLength===0);g.modalAction('resume');await frame();
  check('No game errors or unhandled rejections',(window.__trajectoryErrors??[]).length===0);
  return {engine:cc.ENGINE_VERSION,inputMode,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},results,measurements,errors:window.__trajectoryErrors??[]};
 }catch(e){e.results=results;throw e;}
 finally{for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.reset();}
}
