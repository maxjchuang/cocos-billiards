// Development-only regression. Resets the match; synthetic DOM or Creator 3.8.7 engine touch.
async function previewMagnifier({inputMode=location.protocol==='packages:'?'engine':'dom',keepFixture=false,geometryModule='chunks:///_virtual/BilliardsTableGeometry.ts'}={}) {
 const m=await System.import('cc'),geo=await System.import(geometryModule);
 const g=m.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
 if(!g?.magnifier)throw Error('Load Main first.');
 if(inputMode==='engine'&&(cc.ENGINE_VERSION!=='3.8.7'||typeof m.input._dispatchEventTouch!=='function'))throw Error('Engine driver requires Creator 3.8.7.');
 const canvas=document.getElementById('GameCanvas'),results=[],measurements=[],settings={...g.settings.value};
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),frame=async()=>{await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));await wait(30);};
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const send=(type,p)=>{
  if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,930),event=new m.EventTouch([finger],false,({touchstart:m.Input.EventType.TOUCH_START,touchmove:m.Input.EventType.TOUCH_MOVE,touchend:m.Input.EventType.TOUCH_END,touchcancel:m.Input.EventType.TOUCH_CANCEL})[type],[finger]);event.touch=finger;event.simulate=true;m.input._dispatchEventTouch(event);return;}
  const r=canvas.getBoundingClientRect(),finger=new Touch({identifier:930,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});
  canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:['touchend','touchcancel'].includes(type)?[]:[finger],targetTouches:[],changedTouches:[finger]}));
 };
 const tap=async node=>{const p=g.hudCamera.worldToScreen(node.worldPosition);send('touchstart',p);send('touchend',p);await frame();};
 const overlap=(a,b)=>a.x<b.x+b.width-.01&&a.x+a.width>b.x+.01&&a.y<b.y+b.height-.01&&a.y+a.height>b.y+.01;
 const project=p=>{const v=g.camera.worldToScreen(new m.Vec3(p.x,.05715,p.z));return {x:v.x/g.hudPixelRatio,y:g.hudLayout.height-v.y/g.hudPixelRatio};};
 const protectedPockets=()=>geo.POCKETS.map(p=>{const pts=p.outline.map(project),xs=pts.map(q=>q.x),ys=pts.map(q=>q.y);return {x:Math.min(...xs)-12,y:Math.min(...ys)-12,width:Math.max(...xs)-Math.min(...xs)+24,height:Math.max(...ys)-Math.min(...ys)+24};});
 const actualBounds=()=>{
  const t=g.magnifier.node.getComponent(m.UITransform),s=t.contentSize;
  const pts=[-1,1].flatMap(x=>[-1,1].map(y=>g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(x*s.width/2,y*s.height/2,0)))));
  return {x:Math.min(...pts.map(p=>p.x))/g.hudPixelRatio,y:g.hudLayout.height-Math.max(...pts.map(p=>p.y))/g.hudPixelRatio,width:(Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)))/g.hudPixelRatio,height:(Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y)))/g.hudPixelRatio};
 };
 try{
  g.settings.set('magnifier',true);g.settings.set('sound',false);
  for(let i=0;i<geo.POCKETS.length;i++){
   const pocket=geo.POCKETS[i];g.reset();g.referee.confirmPlacement(g.balls);g.referee.isBreak=false;g.referee.groups=['solid','stripe'];g.referee.selected='solid';g.referee.message='';
   for(const b of g.balls){b.pocketed=b.id>1;b.vx=b.vz=b.wx=b.wy=b.wz=0;}
   const target=g.balls[1],cue=g.balls[0];target.x=pocket.lip.x-pocket.normal.x*.28;target.z=pocket.lip.z-pocket.normal.z*.28;cue.x=target.x-pocket.normal.x*.5;cue.z=target.z-pocket.normal.z*.5;
   g.direction={x:pocket.normal.x,z:pocket.normal.z};await frame();
   const p=g.camera.worldToScreen(new m.Vec3(target.x,.028575,target.z));send('touchstart',p);await frame();
   check('Pocket '+i+': aiming opens magnifier',g.magnifier.node.active);
   const r=actualBounds(),pockets=protectedPockets();
   check('Pocket '+i+': every pocket retains 12px clearance',pockets.every(q=>!overlap(r,q)));
   check('Pocket '+i+': rendered mask matches reported bounds',Object.keys(r).every(k=>Math.abs(r[k]-g.magnifier.bounds[k])<.1));
   check('Pocket '+i+': cue and target stay visible',[cue,target].every(b=>{const q=project(b);return !overlap(r,{x:q.x-18,y:q.y-18,width:36,height:36});}));
   const before=JSON.stringify(g.magnifier.bounds);send('touchmove',p);await frame();check('Pocket '+i+': unchanged aim keeps a stable window',JSON.stringify(g.magnifier.bounds)===before);
   send('touchend',p);await frame();check('Pocket '+i+': release hides the window',!g.magnifier.node.active);
   await tap(g.fineButton.node.parent);check('Pocket '+i+': fine aim keeps pockets visible or hides in constrained space',g.magnifier.node.active?protectedPockets().every(q=>!overlap(actualBounds(),q)):g.fineAim.active&&g.hudLayout.playArea.height<300);
   measurements.push({pocket:i,kind:pocket.kind,bounds:g.magnifier.node.active?actualBounds():null,pockets:protectedPockets(),scale:g.magnifier.node.active?g.magnifier.node.scale.x:null});
   if(i<geo.POCKETS.length-1)g.fineAim.close();
  }
  await tap(g.spinButton.node.parent);check('Spin overlay hides the magnifier',!g.magnifier.node.active);await tap(g.spinPanel.cancel.node.parent);
  g.settings.set('magnifier',false);await frame();check('Setting off hides it immediately',!g.magnifier.node.active);g.settings.set('magnifier',true);await frame();
  const p=g.camera.worldToScreen(new m.Vec3(g.balls[1].x,.028575,g.balls[1].z));g.fineAim.close();send('touchstart',p);send('touchcancel',p);await frame();check('Cancelled touch leaves no floating magnifier',!g.magnifier.node.active);
  if(keepFixture){g.fineAim.open(g.direction.x,g.direction.z);await frame();}
  return {engine:cc.ENGINE_VERSION,inputMode,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},hud:{width:g.hudLayout.width,height:g.hudLayout.height,pixelRatio:g.hudPixelRatio},results,measurements};
 }finally{for(const key of Object.keys(settings))g.settings.set(key,settings[key]);if(!keepFixture)g.reset();}
}
