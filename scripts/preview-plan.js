// Development-only acceptance: real Cocos UI and synthetic DOM or Creator engine touch. Resets current match.
async function previewPlan({inputMode=location.protocol==='packages:'?'engine':'dom'}={}) {
 const m=await System.import('cc'),g=m.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
 if(!g?.panels||(inputMode==='dom'&&!navigator.maxTouchPoints))throw Error('Load Main in touch emulation.');
 if(inputMode==='engine'&&(cc.ENGINE_VERSION!=='3.8.7'||typeof m.input._dispatchEventTouch!=='function'))throw Error('Engine touch driver is pinned to Creator 3.8.7.');
 const canvas=document.getElementById('GameCanvas'),results=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const frame=async()=>{await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));await wait(30);};
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const send=(type,p)=>{if(inputMode==='engine'){const finger=new m.Touch(p.x,p.y,882),event=new m.EventTouch([finger],false,({touchstart:m.Input.EventType.TOUCH_START,touchmove:m.Input.EventType.TOUCH_MOVE,touchend:m.Input.EventType.TOUCH_END,touchcancel:m.Input.EventType.TOUCH_CANCEL})[type],[finger]);event.touch=finger;event.simulate=true;m.input._dispatchEventTouch(event);return;}const rect=canvas.getBoundingClientRect(),t=new Touch({identifier:882,target:canvas,clientX:rect.left+p.x/canvas.width*rect.width,clientY:rect.bottom-p.y/canvas.height*rect.height});canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'||type==='touchcancel'?[]:[t],targetTouches:[],changedTouches:[t]}));};
 const tap=async node=>{const p=g.hudCamera.worldToScreen(node.worldPosition);send('touchstart',p);send('touchend',p);await frame();};
 const action=async id=>{const i=g.panels.actionIds.indexOf(id);check('Action exists: '+id,i>=0);await tap(g.panels.buttons[i].node.parent);};
 const saved={...g.settings.value},players=g.players.map(p=>({...p}));
 try{
  for(const k of Object.keys(saved))g.settings.set(k,({sound:true,haptics:false,aimGuide:true,magnifier:true,reducedMotion:false})[k]);
  g.reset();await frame();await tap(g.actions[1].node.parent);check('Placement confirmation reaches ready',g.referee.phase==='ready');
  const pressPoint=g.hudCamera.worldToScreen(g.shotButton.node.worldPosition);send('touchstart',pressPoint);await frame();
  check('Pressed shoot appearance is visible before release',g.pendingAction==='shoot'&&!g.shotSequence.active&&g.shotButton.background.fillColor.r===204);
  send('touchcancel',pressPoint);await frame();check('Cancelling press restores the button without shooting',g.pendingAction===null&&!g.shotSequence.active&&g.shotButton.background.fillColor.r===222);
  const before=JSON.stringify(g.balls);await tap(g.resetLabel.node);check('Pause opens full menu and freezes balls',g.panelMode==='pause'&&g.paused);await wait(100);check('Paused positions are preserved',JSON.stringify(g.balls)===before);
  check('All four pause actions are present',['resume','restart','settings','rules'].every(id=>g.panels.actionIds.includes(id)));
  await action('settings');check('Settings opens while preserving pause',g.panelMode==='settings'&&g.paused);
  for(const key of ['sound','haptics','aimGuide','magnifier','reducedMotion']){
   const value=g.settings.value[key];await action('setting:'+key);check('Setting updates immediately: '+key,g.settings.value[key]===!value);
   const copy=new g.settings.constructor(m.sys.localStorage);check('Setting persists: '+key,copy.value[key]===!value);
   await action('setting:'+key);
  }
  const originalStore=g.settings;g.settings=new originalStore.constructor({getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}});await frame();await action('setting:sound');
  check('Storage failure keeps the UI usable and changes effective in memory',g.settings.value.sound===false&&!g.settings.persistent&&g.panels.body.string.includes('本局有效'));g.settings=originalStore;await frame();
  await action('back-pause');await action('rules');check('Rules include the correct baseline and break conditions',g.panels.footer.string.includes('2017')&&g.panels.body.string.includes('四颗'));
  await action('rule-next');check('Rules include black outcomes and no called-pocket variant',g.panels.body.string.includes('下一杆')&&g.panels.body.string.includes('无需指袋'));
  await action('rule-history');check('Empty settlement history is explicit',g.panels.body.string.includes('暂无'));
  for(let i=1;i<=12;i++)g.history.record({shotId:i,player:i%2,reason:'第'+i+'杆：白球落袋',phase:'placing',winner:null});await frame();
  check('History opens the first page without dropping older entries',g.panels.body.string.includes('第1杆')&&g.panels.title.string.includes('1/3'));
  await action('history-next');check('History second page is accessible',g.panels.body.string.includes('第6杆')&&g.panels.title.string.includes('2/3'));
  await action('history-next');check('History last page is accessible',g.panels.body.string.includes('第11杆')&&g.panels.title.string.includes('3/3'));
  await action('history-prev');check('History supports navigating backwards',g.panels.title.string.includes('2/3'));
  await action('back-pause');await action('restart');check('Restart requires separate confirmation',g.panelMode==='confirm'&&g.confirmingRestart);
  await action('cancel-restart');check('Cancelling restart retains the match',JSON.stringify(g.balls)===before);
  check('Resume dismisses the modal without shooting',!g.paused&&!g.panelMode&&g.referee.phase==='ready');
  g.players[0].nickname='很长的昵称'.repeat(5)+'🎱'.repeat(10);await frame();await tap(g.playerCards[0].node);check('Identity shows the full nickname and avatar',g.panelMode==='identity'&&g.panels.body.string.includes(g.players[0].nickname)&&g.panels.body.actualFontSize/g.hudPixelRatio>=12);await action('close-identity');check('Identity close preserves match',!g.paused&&JSON.stringify(g.balls)===before);
  const cue=g.balls[0];const aim=g.camera.worldToScreen(new m.Vec3(.2,.028575,.3));send('touchstart',aim);await frame();check('Table aiming shows the contact magnifier',g.magnifier.node.active);send('touchend',aim);await frame();check('Magnifier closes on release',!g.magnifier.node.active&&!g.shotSequence.active);
  await tap(g.fineButton.node.parent);check('Fine aim shows magnifier when space permits, keeping short-screen pockets unobstructed',g.fineAim.active&&(g.magnifier.node.active||g.hudLayout.playArea.height<300));
  g.settings.set('magnifier',false);await frame();check('Magnifier setting hides it immediately',!g.magnifier.node.active);g.settings.set('magnifier',true);
  g.settings.set('aimGuide',false);await frame();check('Aim switch retains direction',g.direction&&Number.isFinite(g.direction.x));g.settings.set('aimGuide',true);
  await tap(g.spinButton.node.parent);check('Spin overlay hides magnification',g.tip.active&&!g.magnifier.node.active);await tap(g.spinPanel.cancel.node.parent);
  await tap(g.resetLabel.node);await action('restart');await action('confirm-restart');check('Confirmed restart clears history and returns to placement',g.referee.phase==='placing'&&g.history.entries.length===0);
  const original={x:g.balls[0].x,z:g.balls[0].z},blocked=g.camera.worldToScreen(new m.Vec3(g.balls[1].x,.028575,g.balls[1].z));send('touchstart',blocked);send('touchend',blocked);await frame();check('Illegal placement keeps cue position and shows feedback',g.balls[0].x===original.x&&g.balls[0].z===original.z&&!!g.placementInvalid&&g.decisionHint.string.includes('位置无效'));
  g.referee.phase='over';g.referee.winner=1;g.referee.message='提前进8，判对手获胜';await frame();check('Result modal reports winner and reason',g.panelMode==='result'&&g.panels.body.string.includes('提前进8'));
  g.referee.winner=0;await frame();await tap(g.panels.title.node);check('Result identity reveals a long winner name without tiny title text',g.panelMode==='identity'&&g.panels.body.string.includes(g.players[0].nickname));await action('close-identity');check('Closing winner identity returns to the result',g.panelMode==='result'&&g.paused);
  const settled=JSON.stringify(g.balls);await action('view-table');const p=g.camera.worldToScreen(new m.Vec3(.2,.028575,.4));send('touchstart',p);send('touchend',p);await frame();check('View-table mode blocks gameplay',g.panelMode==='view'&&JSON.stringify(g.balls)===settled&&!g.shotSequence.active);
  await action('return-result');check('Result can be reopened',g.panelMode==='result');await action('new-round');check('New round clears result exactly once',g.referee.phase==='placing'&&g.referee.winner===null&&!g.panelMode);
  g.reset();g.referee.phase='choice';g.referee.isBreak=false;g.referee.breakChoice='eight-foul';g.balls[0].pocketed=true;await frame();
  check('Scratch plus opening eight hides the forbidden accept-table option',g.panelMode==='break'&&!g.panels.actionIds.includes('break:0')&&g.panels.actionIds.includes('break:2'));await action('break:2');check('Opening eight scratch grants head-line placement',g.referee.phase==='placing'&&g.referee.hand==='head');
  g.reset();g.referee.phase='choice';g.referee.isBreak=false;g.referee.breakChoice='eight-foul';await frame();const white={x:g.balls[0].x,z:g.balls[0].z};await action('break:0');
  check('Accept-table option preserves a non-scratched cue',g.referee.phase==='ready'&&g.balls[0].x===white.x&&g.balls[0].z===white.z);
  check('All four packed audio clips are loaded',g.feedback.available===4);
  g.settings.set('sound',false);const count=g.feedback.events.length;g.feedback.play('strike');check('Sound-off suppresses playback requests',g.feedback.events.length===count);
  check('No page errors were captured',(window.__uxErrors??[]).length===0);
  return {engine:cc.ENGINE_VERSION,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},mode:inputMode==='engine'?'Creator synthetic engine touch, real Cocos components':'Synthetic DOM touch, real Cocos components',results};
 }catch(e){e.results=results;throw e;}
 finally{for(const key of Object.keys(saved))g.settings.set(key,saved[key]);g.players=players;g.reset();}
}

async function previewFeedbackAndReduced() {
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
 const saved={...g.settings.value},results=[],calls=[],play=g.feedback.play;
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const descriptor=Object.getOwnPropertyDescriptor(navigator,'vibrate');let vibrations=0;
 try{
  g.settings.set('sound',true);g.settings.set('haptics',false);g.settings.set('reducedMotion',true);
  const unlockSource=g.feedback.sources.get('strike'),originalPlay=unlockSource.play;
  try{unlockSource.play=()=>{throw Error('unsupported playback');};g.feedback.unlocked=false;g.feedback.unlock();check('Unsupported audio unlock cannot interrupt the first touch',g.feedback.unlocked&&unlockSource.volume===1);}finally{unlockSource.play=originalPlay;}
  g.feedback.play=function(kind){if(kind==='strike')calls.push({kind,ms:g.shotSequence.elapsedMs,shotId:g.lastContactShotId});return play.call(this,kind);};
  const timing=await previewContactProbe();check('Reduced motion preserves every contact/interruption assertion',timing.passed);
  check('Every strike sound is dispatched at the logical 220ms contact frame',calls.length>0&&calls.every(c=>c.ms===220));
  check('Each committed shot dispatches one strike sound',new Set(calls.map(c=>c.shotId)).size===calls.length);
  check('Cocos audio backend received strike playback',g.feedback.events.some(e=>e.kind==='strike'));
  await wait(100);g.feedback.play('pocket');await wait(20);check('Packed sound plays through the browser audio backend',g.feedback.sources.get('pocket').playing);
  g.modalAction('setting:sound');check('Turning sound off stops active sources immediately',[...g.feedback.sources.values()].every(s=>!s.playing));
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:()=>{vibrations++;return true;}});
  g.settings.set('haptics',true);await wait(90);g.feedback.haptic();check('Enabled vibration routes to the available platform adapter',vibrations===1);
  g.settings.set('haptics',false);await wait(90);g.feedback.haptic();check('Disabled vibration emits no platform request',vibrations===1);
  Object.defineProperty(navigator,'vibrate',{configurable:true,value:()=>{throw Error('unsupported');}});
  g.settings.set('haptics',true);await wait(90);g.feedback.haptic();check('Unsupported vibration does not throw or mutate the match',g.referee.phase==='placing');
  g.reset();g.referee.confirmPlacement(g.balls);g.fineAim.open(0,-1);await wait(80);g.settings.set('aimGuide',true);await wait(60);
  check('Enabled aim renders paths',g.aimGraphics.impl.pathLength>0);const direction={...g.direction};g.settings.set('aimGuide',false);await wait(60);
  check('Disabled aim clears render paths without changing direction',g.aimGraphics.impl.pathLength===0&&g.direction.x===direction.x&&g.direction.z===direction.z);
  return {mode:'Actual browser audio playback, reduced-motion render frames; vibration uses a controlled adapter',results,timing};
 }finally{g.feedback.play=play;if(descriptor)Object.defineProperty(navigator,'vibrate',descriptor);else delete navigator.vibrate;for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.reset();}
}

async function previewPerformance() {
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
 const original={...g.settings.value},rate=m.game.frameRate;
 const measure=async()=>{const times=[],record=()=>times.push(performance.now());m.director.on(m.Director.EVENT_AFTER_DRAW,record);await new Promise(r=>setTimeout(r,3000));m.director.off(m.Director.EVENT_AFTER_DRAW,record);
  const intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);return {frames:times.length,averageFps:1000*(times.length-1)/(times.at(-1)-times[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)]};};
 try{
  m.game.frameRate=60;g.settings.set('sound',false);g.settings.set('magnifier',true);g.reset();g.referee.confirmPlacement(g.balls);await new Promise(r=>setTimeout(r,120));
  const nodeCount=()=>g.node.getComponentsInChildren(m.Component).length,before=nodeCount();
  const idle=await measure();g.fineAim.open(g.direction.x,g.direction.z);await new Promise(r=>setTimeout(r,120));const magnifier=await measure();
  for(let i=0;i<50;i++){g.pauseGame();g.panelMode='settings';g.renderPanels(innerWidth,innerHeight,0);g.modalAction('resume');}
  const after=nodeCount();return {scope:'Local Chromium, 393x852 DPR2, 60fps cap',idle,magnifier,nodesBefore:before,nodesAfter:after,checks:{idleFps:idle.averageFps>=50,magnifierFps:magnifier.averageFps>=45,idleP95:idle.p95FrameMs<=33.4,magnifierP95:magnifier.p95FrameMs<=33.4,stableNodeCount:before===after,clips:g.feedback.available===4}};
 }finally{m.game.frameRate=rate;for(const k of Object.keys(original))g.settings.set(k,original[k]);g.reset();}
}
