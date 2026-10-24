// Development-only: natural default breaks, fresh seed generation and exact recipe replay.
async function previewRacks({inputMode=location.protocol==='packages:'?'engine':'dom',count=5,keepFixture=false}={}) {
 const m=await System.import('cc'),g=m.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
 if(!g?.rackSession)throw Error('Load the seeded-rack build first.');
 if(inputMode==='engine'&&(cc.ENGINE_VERSION!=='3.8.7'||typeof m.input._dispatchEventTouch!=='function'))throw Error('Engine driver requires Creator 3.8.7.');
 const canvas=document.getElementById('GameCanvas'),results=[],cases=[],settings={...g.settings.value},power=g.power;
 const wait=ms=>new Promise(r=>setTimeout(r,ms)),frame=async()=>{await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));await wait(30);};
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const tap=async p=>{
  if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,995);for(const type of [m.Input.EventType.TOUCH_START,m.Input.EventType.TOUCH_END]){const event=new m.EventTouch([finger],false,type,[finger]);event.touch=finger;event.simulate=true;m.input._dispatchEventTouch(event);}}
  else{const r=canvas.getBoundingClientRect(),finger=new Touch({identifier:995,target:canvas,clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});for(const type of ['touchstart','touchend'])canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[finger],targetTouches:[],changedTouches:[finger]}));}
  await frame();
 };
 const node=n=>tap(g.hudCamera.worldToScreen(n.worldPosition));
 const masses=()=>g.balls.map(b=>b.mass),copy=()=>g.balls.map(b=>({...b}));
 const shape=balls=>JSON.stringify(balls.filter(b=>!b.pocketed).map(b=>[+b.x.toFixed(3),+b.z.toFixed(3)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
 try{
  g.settings.set('sound',false);g.settings.set('haptics',false);
  for(let index=0;index<=count;index++){
   const replay=index===count,historyBefore=JSON.stringify(g.rackSession.history);g.reset(replay?cases[0].config:undefined);await frame();
   const config={...g.rackConfig},initial=copy(),mass=masses(),direction={...g.direction};
   check(index+': default cue, direction and tip remain exact',g.balls[0].x===0&&g.balls[0].z===.65&&g.balls[0].mass===1&&direction.x===0&&direction.z===-1&&g.tip.value.x===0&&g.tip.value.y===0);
   if(index===0){const saved=JSON.stringify(g.rackConfig);await node(g.resetLabel.node);const i=g.panels.actionIds.indexOf('resume');await node(g.panels.buttons[i].node.parent);check('Pause/resume does not reroll the rack or masses',JSON.stringify(g.rackConfig)===saved&&JSON.stringify(masses())===JSON.stringify(mass));}
   if(!replay&&index){check(index+': new round advances rack seed and retains ball set',config.rackSeed!==cases[index-1].config.rackSeed&&config.ballSetSeed===cases[0].config.ballSetSeed);check(index+': physical properties stay attached to ball numbers',JSON.stringify(mass)===JSON.stringify(cases[0].initial.map(b=>b.mass)));}
   if(replay)check('Recipe replay does not consume the normal rack sequence',JSON.stringify(g.rackSession.history)===historyBefore);
   await node(g.actions[1].node.parent);
   const t=g.powerControl.getComponent(m.UITransform);await tap(g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(g.powerHalfWidth,0,0))));
   check(index+': real power slider reaches 100%',g.power===4);
   let contactMs=null,firstSpeed=null;const sample=()=>{if(g.shotSequence.committed&&contactMs===null){contactMs=g.shotSequence.elapsedMs;firstSpeed=Math.hypot(g.balls[0].vx,g.balls[0].vz);}};
   m.director.on(m.Director.EVENT_AFTER_DRAW,sample);
   try{const started=performance.now();await node(g.shotButton.node);check(index+': click keeps balls still before contact',g.shotSequence.active&&!g.shotSequence.committed&&g.balls.every((b,i)=>b.x===initial[i].x&&b.z===initial[i].z));
    while((g.shotSequence.active||g.referee.phase==='shooting')&&performance.now()-started<15000)await wait(16);
    check(index+': exact stroke still commits at 220ms',contactMs===220&&firstSpeed>7.8&&firstSpeed<=8.01);
    check(index+': break settles with finite bounded positions',g.referee.phase!=='shooting'&&!g.shotSequence.active&&g.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.z)&&(b.pocketed||Math.abs(b.x)<=.77&&Math.abs(b.z)<=1.41)));
    check(index+': collisions and settlement do not mutate masses',JSON.stringify(masses())===JSON.stringify(mass));
    cases.push({config,initial,balls:copy(),phase:g.referee.phase,current:g.referee.current,contactMs,firstSpeed,wallMs:performance.now()-started});
   }finally{m.director.off(m.Director.EVENT_AFTER_DRAW,sample);}
  }
  check('Fresh default rounds have different number arrangements',new Set(cases.slice(0,count).map(c=>c.initial.slice().sort((a,b)=>a.bodyId-b.bodyId).map(b=>b.id).join(','))).size>1);
  check('Fresh rounds differ geometrically, ignoring ball numbers',new Set(cases.slice(0,count).map(c=>shape(c.balls))).size>1);
  const replay=cases[count];check('Same recipe exactly reproduces all settled ball coordinates',JSON.stringify(replay.balls)===JSON.stringify(cases[0].balls));
  if(g.rackSession.persistent){const restored=new g.rackSession.constructor(m.sys.localStorage,()=>{throw Error('Expected a saved journal');});check('Saved rack journal restores the ball set and recent recipes',restored.ballSetSeed===g.rackSession.ballSetSeed&&JSON.stringify(restored.history)===JSON.stringify(g.rackSession.history));}
  const before=masses();g.referee.phase='choice';g.referee.breakChoice='illegal';g.referee.current=1;g.panelMode=null;await frame();
  const previous={...g.rackConfig},i=g.panels.actionIds.indexOf('break:0');await node(g.panels.buttons[i].node.parent);
  check('Referee-requested re-rack uses a fresh recipe with the same ball set',g.referee.phase==='placing'&&g.rackConfig.rackSeed!==previous.rackSeed&&g.rackConfig.ballSetSeed===previous.ballSetSeed&&g.rackConfig.positionToleranceM===previous.positionToleranceM&&JSON.stringify(masses())===JSON.stringify(before));
  check('No game errors or unhandled rejections were observed',(window.__rackErrors??[]).length===0);
  return {engine:cc.ENGINE_VERSION,inputMode,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},results,cases,journalPersistent:g.rackSession.persistent,historyCount:g.rackSession.history.length,errors:window.__rackErrors??[]};
 }finally{g.power=power;for(const k of Object.keys(settings))g.settings.set(k,settings[k]);if(!keepFixture)g.reset();}
}
