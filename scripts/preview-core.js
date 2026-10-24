// Actual DOM-touch default break capture; leaves the naturally settled table visible.
async function previewCoreBreak(recipe){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),canvas=document.getElementById('GameCanvas');
 const settings={...g.settings.value},power=g.power,wait=ms=>new Promise(r=>setTimeout(r,ms));
 const trace=[];let traceStarted=0,lastTrace=-Infinity,sampleTrace=null;
 const frame=()=>new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));
 const tap=async node=>{const p=g.hudCamera.worldToScreen(node.worldPosition),r=canvas.getBoundingClientRect(),finger=new Touch({identifier:996,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});for(const type of ['touchstart','touchend'])canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[finger],targetTouches:[],changedTouches:[finger]}));await frame();};
 try{
  g.settings.set('sound',false);g.settings.set('haptics',false);g.reset(recipe);await frame();
  const config={...g.rackConfig},initial=g.balls.map(b=>({...b}));
  await tap(g.actions[1].node.parent);
  const t=g.powerControl.getComponent(m.UITransform),p=g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(g.powerHalfWidth,0,0))),r=canvas.getBoundingClientRect();
  const finger=new Touch({identifier:996,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});
  for(const type of ['touchstart','touchend'])canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[finger],targetTouches:[],changedTouches:[finger]}));
  await frame();if(g.power!==4)throw Error('Expected real 100% power');
  traceStarted=performance.now();sampleTrace=()=>{const elapsed=performance.now()-traceStarted;if(elapsed-lastTrace>=50){lastTrace=elapsed;trace.push({wallMsSinceTouchRequest:elapsed,balls:g.balls.map(b=>({id:b.id,bodyId:b.bodyId,x:b.x,z:b.z,pocketed:!!b.pocketed}))});}};m.director.on(m.Director.EVENT_AFTER_DRAW,sampleTrace);await tap(g.shotButton.node);
  const started=performance.now();while((g.shotSequence.active||g.referee.phase==='shooting')&&performance.now()-started<15000)await wait(16);
  const balls=g.balls.map(b=>({...b})),coreCount=balls.filter(b=>b.id&&!b.pocketed&&Math.hypot(b.x,b.z+.735)<.17).length;
  if(g.referee.phase==='shooting')throw Error('Default core spread regression');
  return {config,initial,balls,trace,coreCount,phase:g.referee.phase,wallMs:performance.now()-started};
 }finally{if(sampleTrace)m.director.off(m.Director.EVENT_AFTER_DRAW,sampleTrace);g.power=power;for(const key of Object.keys(settings))g.settings.set(key,settings[key]);}
}
