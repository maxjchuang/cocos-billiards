// Development-only: actual Cocos audio sources, DOM or Creator engine-touch gameplay.
// Requires preview-smoke.js, preview-plan.js to be loaded in the same context.
async function previewAudioA({inputMode=location.protocol==='packages:'?'engine':'dom'}={}){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),f=g.feedback;
 const saved={...g.settings.value},results=[],measurements={},wait=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const voices=()=>Array.from(f.voices.values()).flat();
 try{
  for(let i=0;i<100&&f.available!==14;i++)await wait(30);
  g.settings.set('sound',true);f.unlock();f.stop();check('All fourteen Scheme A clips load locally',f.available===14);
  check('Voice pool stays fixed at thirteen sources',voices().length===13);
  f.events.length=0;f.play('collision',.2);const weak=f.events.at(-1);await wait(170);f.play('collision',8);const strong=f.events.at(-1);
  check('Actual weak and strong contacts receive different gains',weak.kind==='collision'&&strong.kind==='collision'&&weak.volume<strong.volume);
  measurements.gain={weak:weak.volume,strong:strong.volume};await wait(160);f.stop();
  const stops=voices().map(s=>({s,fn:s.stop,count:0}));for(const o of stops)o.s.stop=function(){o.count++;return o.fn.call(this)};
  try{for(let i=0;i<3;i++)f.play('collision',2);await wait(25);check('Collisions overlap on independent Cocos voices',f.voices.get('collision').filter(s=>s.playing).length>=2);check('Playing impacts do not stop older impact tails',stops.every(o=>o.count===0));}
  finally{for(const o of stops)o.s.stop=o.fn;}
  check('Active source gains retain the 0.9 mix budget',voices().filter(s=>s.playing).reduce((a,s)=>a+s.volume,0)<=.900001);f.stop();
  f.events.length=0;for(let i=1;i<=20;i++)f.enqueue('collision',i*.4,'0:'+i);f.flush();
  check('Dense contact frame selects three strongest audible contacts',f.events.length===3&&f.events.every(e=>e.kind==='collision'&&e.speed>=7.2));f.stop();
  f.events.length=0;f.celebrate();await wait(120);f.stop();await wait(300);f.flush();check('Pause cancels delayed applause without ghost replay',f.events.length===0);
  g.settings.set('sound',false);f.enqueue('pocket',2,'1');f.play('strike',8);f.celebrate();f.flush();check('Muted output creates no pending sound or applause',f.events.length===0);g.settings.set('sound',true);
  const settlements=[];f.events.length=0;
  const smoke=await previewSmoke({inputMode,afterSettlement:async game=>{
   const before=f.events.filter(e=>e.kind==='applause').length;
   if(game.referee.phase==='over'){
    const legal=game.referee.message.includes('合法打进8');await wait(460);const count=f.events.filter(e=>e.kind==='applause').length;
    settlements.push({legal,message:game.referee.message,applause:count-before});
    check(legal?'Legal eight-ball victory plays one delayed applause':'Early eight-ball loss does not celebrate the foul',count-before===(legal?1:0));
    if(legal){await wait(150);check('Result frames never repeat the victory applause',f.events.filter(e=>e.kind==='applause').length===count);}
   }
  }});
  check('Actual touch gameplay still passes all 35 smoke assertions',smoke.results.length===35&&smoke.results.every(r=>r.passed));
  check('Controlled gameplay includes both legal and foul finishes',settlements.some(s=>s.legal)&&settlements.some(s=>!s.legal));
  measurements.settlements=settlements;
  const timing=await previewContactProbe({inputMode});check('Strike audio remains on the existing 220ms contact path',timing.passed);
  const feedback=await previewFeedbackAndReduced();check('Sound mute, reduced motion and platform fallback pass',feedback.results.every(r=>r.passed));
  check('No game errors or unhandled rejections',(window.__audioErrors??window.__rackErrors??[]).length===0);
  return {engine:cc.ENGINE_VERSION,inputMode,bank:'A-club-v1',results,measurements,timing,feedback,smoke,errors:window.__audioErrors??window.__rackErrors??[]};
 }catch(e){e.results=results;throw e;}
 finally{f.stop();for(const k of Object.keys(saved))g.settings.set(k,saved[k]);g.reset();}
}
