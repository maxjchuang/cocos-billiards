// Actual Cocos frame-loop AI selection and first-contact checks on controlled boards.
async function previewAINatural(){
 const m=await System.import('cc'),g=m.director.getScene().getComponentInChildren('BilliardsGame'),saved={settings:{...g.settings.value},practice:{...g.practice.value}},cases=[];
 const originalBegin=g.aiTurn.begin;g.aiTurn.begin=function(balls,ref,difficulty){return originalBegin.call(this,balls,ref,difficulty,19)};
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 try{for(const [name,difficulty] of [['draw','standard'],['fully-blocked','standard'],['partly-blocked','standard'],['rail-contact','hard']]){
  const f=window.__naturalFixtures.find(f=>f.name===name);g.draftMode='ai';g.draftDifficulty=difficulty;g.startMatch();g.practice.set({mode:'ai',difficulty});g.settings.set('sound',false);g.settings.set('aimGuide',false);
  for(const b of g.balls){const source=f.balls.find(q=>q.id===b.id);b.pocketed=!source;b.vx=b.vz=b.wx=b.wy=b.wz=0;if(source)Object.assign(b,source);delete b.mass;delete b.bodyId;}
  Object.assign(g.referee,{current:1,isBreak:false,phase:'ready',hand:null,groups:['stripe','solid'],selected:'solid',message:''});g.layoutStamp='';g.notificationAt=-100;
  const events=[],live=g.referee,observe=Object.getPrototypeOf(live).observe;g.referee.observe=function(e,b){if(this===live)events.push({...e});observe.call(this,e,b)};
  const serial=g.lastContactShotId;let contactMs=null;const draw=()=>{if(contactMs===null&&g.lastContactShotId!==serial)contactMs=g.shotSequence.elapsedMs};m.director.on(m.Director.EVENT_AFTER_DRAW,draw);
  const at=performance.now();while(!events.some(e=>e.type==='contact'&&(e.a===0||e.b===0))&&performance.now()-at<18000)await wait(10);
  m.director.off(m.Director.EVENT_AFTER_DRAW,draw);const decision=g.aiDebugLog.at(-1)?.decision,first=events.findIndex(e=>e.type==='contact'&&(e.a===0||e.b===0)),rails=events.slice(0,first<0?events.length:first).filter(e=>e.type==='cushion'&&e.id===0).length;
  const wanted=name==='fully-blocked'?'kick':'direct',record={name,difficulty,decision,preContactCushions:rails,firstContact:first<0?null:events[first],contactMs,wallMs:performance.now()-at,passed:!!decision&&decision.route===wanted&&first>=0&&(events[first].a===decision.target||events[first].b===decision.target)&&(wanted==='kick'?rails>0:rails===0)&&contactMs===220};cases.push(record);g.pauseGame();if(!record.passed){window.__naturalFailure={cases,events};throw Object.assign(Error('AI natural route '+name),{cases});}
 }
 return {engine:cc.ENGINE_VERSION,scope:'Actual engine frame loop; unit-mass layouts, fixed AI execution seed19; checks selection, first contact and logical 220ms, not full-match win rates',viewport:[innerWidth,innerHeight,devicePixelRatio],cases,errors:window.__aiErrors??[]};
 }finally{g.aiTurn.begin=originalBegin;g.practice.set(saved.practice);for(const k of Object.keys(saved.settings))g.settings.set(k,saved.settings[k]);g.draftMode='local';g.startMatch();}
}
