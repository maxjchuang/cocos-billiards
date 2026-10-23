// Development-only: real UI touches launch natural full-power breaks; resets the match.
async function previewPower({inputMode=location.protocol==='packages:'?'engine':'dom',offsets=[0,.12,-.12]}={}) {
 const m=await System.import('cc'),g=m.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
 if(!g?.shotSequence)throw Error('Load Main first.');
 if(inputMode==='engine'&&(cc.ENGINE_VERSION!=='3.8.7'||typeof m.input._dispatchEventTouch!=='function'))throw Error('Engine driver requires Creator 3.8.7.');
 const canvas=document.getElementById('GameCanvas'),results=[],measurements=[],power=g.power,settings={...g.settings.value};
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),frame=async()=>{await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));await wait(30);};
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const tap=async p=>{
  if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,970);for(const type of [m.Input.EventType.TOUCH_START,m.Input.EventType.TOUCH_END]){const event=new m.EventTouch([finger],false,type,[finger]);event.touch=finger;event.simulate=true;m.input._dispatchEventTouch(event);}}
  else{const r=canvas.getBoundingClientRect(),finger=new Touch({identifier:970,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});for(const type of ['touchstart','touchend'])canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[finger],targetTouches:[],changedTouches:[finger]}));}
  await frame();
 };
 const node=async n=>tap(g.hudCamera.worldToScreen(n.worldPosition));
 try{
  g.settings.set('sound',false);
  for(const offset of offsets){
   g.reset();await frame();await tap(g.camera.worldToScreen(new m.Vec3(offset,.028575,.65)));await node(g.actions[1].node.parent);
   await tap(g.camera.worldToScreen(new m.Vec3(0,.028575,-.635)));
   const t=g.powerControl.getComponent(m.UITransform);await tap(g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(g.powerHalfWidth,0,0))));
   check(offset+': slider reaches 100%',g.power===4&&g.powerValue.string==='100%');
   const initial=g.balls.map(b=>({x:b.x,z:b.z})),cushions=new Set();let firstSpeed=null,contactMs=null,motionBeforeContact=false,finite=true,inBounds=true,peakArea=0,frames=0;
   const ref=g.referee,observe=ref.observe;ref.observe=function(e,b){if(e.type==='cushion'&&e.id)cushions.add(e.id);return observe.call(this,e,b);};
   const sample=()=>{
    frames++;if(!g.shotSequence.committed&&g.referee.phase==='ready'&&g.balls.some((b,i)=>Math.hypot(b.x-initial[i].x,b.z-initial[i].z)>1e-8))motionBeforeContact=true;
    if(g.shotSequence.committed&&firstSpeed===null){firstSpeed=Math.hypot(g.balls[0].vx,g.balls[0].vz);contactMs=g.shotSequence.elapsedMs;}
    const active=g.balls.filter(b=>b.id&&!b.pocketed);if(active.length)peakArea=Math.max(peakArea,(Math.max(...active.map(b=>b.x))-Math.min(...active.map(b=>b.x)))*(Math.max(...active.map(b=>b.z))-Math.min(...active.map(b=>b.z))));
    for(const b of g.balls){finite=finite&&[b.x,b.z,b.vx,b.vz].every(Number.isFinite);if(!b.pocketed)inBounds=inBounds&&Math.abs(b.x)<=.77&&Math.abs(b.z)<=1.41;}
   };
   m.director.on(m.Director.EVENT_AFTER_DRAW,sample);
   try{const p=g.hudCamera.worldToScreen(g.shotButton.node.worldPosition);const started=performance.now();await tap(p);check(offset+': click starts animation while rack stays still',g.shotSequence.active&&!g.shotSequence.committed&&!motionBeforeContact);
    while((g.referee.phase==='ready'&&!g.shotSequence.committed||g.referee.phase==='shooting'||g.shotSequence.active)&&performance.now()-started<15000)await wait(16);
    check(offset+': stronger stroke starts only at 220ms contact',!motionBeforeContact&&contactMs===220&&firstSpeed>7.8&&firstSpeed<=8.01);
    check(offset+': at least seven target balls reach cushions',cushions.size>=7);
    check(offset+': natural rack spreads across the table',peakArea>=1);
    check(offset+': high-power break settles within timeout',g.referee.phase!=='shooting'&&!g.shotSequence.active&&performance.now()-started<15000);
    check(offset+': motion stays finite and inside the frame',finite&&inBounds);
    check(offset+': opening pots do not assign groups or award a winner',g.referee.groups.every(x=>x===null)&&g.referee.winner===null);
    measurements.push({offset,firstSpeed,contactMs,targetCushionIds:Array.from(cushions),peakSpreadAreaM2:peakArea,wallMs:performance.now()-started,frames,phase:g.referee.phase,potted:g.balls.filter(b=>b.pocketed).map(b=>b.id)});
   }finally{m.director.off(m.Director.EVENT_AFTER_DRAW,sample);ref.observe=observe;}
  }
  return {engine:cc.ENGINE_VERSION,inputMode,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},results,measurements,errors:window.__powerErrors??[]};
 }finally{g.power=power;for(const key of Object.keys(settings))g.settings.set(key,settings[key]);g.reset();}
}
