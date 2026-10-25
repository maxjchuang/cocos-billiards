// Deterministic review fixtures only. Not imported into the game build.
async function previewScenario(id,{top=47,bottom=34}={}) {
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
 if(!window.__scenarioOriginalSafe)window.__scenarioOriginalSafe=m.sys.getSafeAreaRect;
 m.sys.getSafeAreaRect=()=>{const s=m.view.getVisibleSize(),o=m.view.getVisibleOrigin();return new m.Rect(o.x,o.y+bottom*s.height/innerHeight,s.width,s.height*(1-(top+bottom)/innerHeight));};
 if(!window.__scenarioSettingsOriginal)window.__scenarioSettingsOriginal={...g.settings.value};g.settings.value={sound:true,haptics:false,aimGuide:true,magnifier:true,reducedMotion:false};
 g.reset();g.players[0].nickname='林间听风';g.players[1].nickname='BlueFox';g.players[0].avatar='forest';g.players[1].avatar='fox';g.power=2.6;g.notificationAt=-1000;
 g.referee.confirmPlacement(g.balls);g.referee.isBreak=false;g.referee.groups=['solid','stripe'];g.referee.selected='solid';g.referee.message='';
 const positions={"1":[-0.3276,-0.756],"2":[0.252,-0.4284],"4":[-0.0378,-0.1008],"7":[0.3402,0.3528],"8":[-0.2016,-0.3276],"9":[0.2898,-0.8568],"10":[-0.378,0.1764],"12":[0.3402,-0.0252],"14":[-0.252,0.4536],"15":[-0.3528,0.9072],"0":[0.0882,0.6552]};
 for(const b of g.balls){b.pocketed=!positions[b.id];if(positions[b.id]){b.x=positions[b.id][0];b.z=positions[b.id][1];}b.vx=b.vz=0;b.wx=b.wy=b.wz=0;}
 const aimX=g.balls[4].x-g.balls[0].x,aimZ=g.balls[4].z-g.balls[0].z,aimLength=Math.hypot(aimX,aimZ);g.direction={x:aimX/aimLength,z:aimZ/aimLength};
 if(id==='S02'||id==='S03'){g.referee.phase='placing';g.referee.hand='head';g.referee.isBreak=true;g.referee.groups=[null,null];g.balls[0].x=0;g.balls[0].z=.65;g.referee.message='开球：在线后摆放母球';
  if(id==='S03'){g.referee.isBreak=false;g.referee.hand='any';g.referee.message='BlueFox 白球落袋 · 林间听风获得自由球';g.placementInvalid={x:g.balls[4].x,z:g.balls[4].z,until:g.uiTime+1000,message:'位置无效：与目标球重叠'};}}
 if(id==='S04'){g.referee.groups=[null,null];g.referee.selected=null;g.referee.message='开放球局：选择进攻组，再瞄准击球';g.notificationAt=g.uiTime;}
 if(id==='S05'){g.referee.phase='shooting';g.paused=true;g.referee.message='球正在运动';}
 if(id==='S06'){g.referee.phase='placing';g.referee.hand='any';g.referee.current=0;g.referee.message='BlueFox 白球落袋 · 林间听风获得自由球';}
 if(id==='S07'){g.referee.phase='choice';g.referee.isBreak=true;g.referee.groups=[null,null];g.referee.selected=null;g.referee.breakChoice='illegal';g.referee.current=1;g.referee.message='开球不足四球碰库：请选择处理方式';g.panelMode=null;}
 if(id==='S08'||id==='S09'){g.referee.phase='over';g.referee.winner=id==='S08'?0:1;g.balls[8].pocketed=true;if(id==='S08')g.balls.filter(b=>b.id>=1&&b.id<=7).forEach(b=>b.pocketed=true);g.referee.message=id==='S08'?'合法打进8号球':'提前进8号球，判对手获胜';}
 if(id==='S10'||id==='S11'||id==='S12'||id==='S13'){g.pauseGame();g.panelMode=({S10:'confirm',S11:'pause',S12:'settings',S13:'rules'})[id];g.confirmingRestart=id==='S10';}
 if(id==='S14'||id==='S15'){g.tip.open();g.tip.select(.3,-.4);if(id==='S15')g.tip.confirm();}
 g.layoutStamp='';g.syncVisuals();await new Promise(r=>setTimeout(r,260));
 const scale=m.screen.devicePixelRatio,bounds=node=>{const t=node.getComponent(m.UITransform),s=t.contentSize;
  const ps=[-1,1].flatMap(x=>[-1,1].map(y=>g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(x*s.width/2,y*s.height/2,0)))));
  return {x:Math.min(...ps.map(p=>p.x))/scale,y:innerHeight-Math.max(...ps.map(p=>p.y))/scale,w:(Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)))/scale,h:(Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y)))/scale};};
 const table=[-1,1].flatMap(x=>[-1,1].map(z=>g.camera.worldToScreen(new m.Vec3(.77*x,0,1.41*z))));
 return {id,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,renderDpr:scale},safe:{top,bottom},phase:g.referee.phase,modal:g.panelMode,
  layout:g.hudLayout,table:{x:Math.min(...table.map(p=>p.x))/scale,y:innerHeight-Math.max(...table.map(p=>p.y))/scale,w:(Math.max(...table.map(p=>p.x))-Math.min(...table.map(p=>p.x)))/scale,h:(Math.max(...table.map(p=>p.y))-Math.min(...table.map(p=>p.y)))/scale},
  controls:{shoot:bounds(g.shotButton.node),fine:bounds(g.fineButton.node.parent),spin:bounds(g.spinButton.node.parent)},panel:g.panelMode?bounds(g.panels.card):g.tip.active?bounds(g.spinPanel.panel):null};
}
async function previewScenarioRestore(){const m=await System.import('cc');if(window.__scenarioOriginalSafe){m.sys.getSafeAreaRect=window.__scenarioOriginalSafe;delete window.__scenarioOriginalSafe;}const g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');if(window.__scenarioSettingsOriginal){g.settings.value=window.__scenarioSettingsOriginal;delete window.__scenarioSettingsOriginal;}g.players[0].nickname='玩家一';g.players[1].nickname='玩家二';g.power=2.4;g.reset();}

async function previewLayoutAcceptance(options={}) {
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
 const records=[],checks=[];const check=(name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw Error(name);};
 const dpr=()=>m.screen.devicePixelRatio;
 const bounds=node=>{const t=node.getComponent(m.UITransform),s=t.contentSize,ps=[-1,1].flatMap(x=>[-1,1].map(y=>g.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new m.Vec3(x*s.width/2,y*s.height/2,0)))));return{x:Math.min(...ps.map(p=>p.x))/dpr(),y:innerHeight-Math.max(...ps.map(p=>p.y))/dpr(),w:(Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x)))/dpr(),h:(Math.max(...ps.map(p=>p.y))-Math.min(...ps.map(p=>p.y)))/dpr()};};
 const close=(a,b,epsilon=1)=>Object.keys(b).every(k=>Math.abs(a[k]-b[k])<=epsilon);
 try{
  for(let i=1;i<=15;i++){
   const id='S'+String(i).padStart(2,'0'),record=await previewScenario(id,options);records.push(record);
   let controls=g.panelMode?g.panels.buttons.filter(l=>l.node.parent.activeInHierarchy).map(l=>l.node.parent):g.tip.active?[g.spinPanel.cancel,g.spinPanel.center,g.spinPanel.done].map(l=>l.node.parent):[g.resetLabel.node,...g.actions.map(l=>l.node.parent),g.shotButton.node,g.fineButton.node.parent,g.spinButton.node.parent,g.fineMinus.node.parent,g.finePlus.node.parent].filter(n=>n.activeInHierarchy);
   const rects=controls.map(bounds);
   check(id+' touch targets are at least 44 pixels',rects.every(r=>r.w>=43.99&&r.h>=43.99));
   check(id+' touch targets stay within the viewport',rects.every(r=>r.x>=-.01&&r.y>=-.01&&r.x+r.w<=innerWidth+.01&&r.y+r.h<=innerHeight+.01));
   const overlap=(a,b)=>a.x<b.x+b.w-.01&&b.x<a.x+a.w-.01&&a.y<b.y+b.h-.01&&b.y<a.y+a.h-.01;
   check(id+' active touch targets do not overlap',rects.every((a,index)=>rects.every((b,j)=>j<=index||!overlap(a,b))));
   if(innerWidth===393&&innerHeight===852&&options.top===47&&options.bottom===34){
    if(id==='S01'){
     check('S01 table projection matches the SVG reference within 2px',close(record.table,{x:59.97517730496455,y:193,w:273.0496453900709,h:500},2));
     check('S01 three buttons match within 1px',close(record.controls.fine,{x:24,y:766,w:76,h:48})&&close(record.controls.shoot,{x:112,y:766,w:169,h:48})&&close(record.controls.spin,{x:293,y:766,w:76,h:48}));
     check('S01 cards match within 1px',close(record.layout.players[0],{x:20,y:95,width:171,height:64})&&close(record.layout.players[1],{x:202,y:95,width:171,height:64}));
    }
    const expected={S07:{x:0,y:469,w:393,h:383},S08:{x:24,y:223,w:345,h:398},S09:{x:24,y:223,w:345,h:398},S10:{x:24,y:265,w:345,h:314},S11:{x:24,y:235,w:345,h:400},S12:{x:24,y:190,w:345,h:568},S13:{x:0,y:294,w:393,h:558},S14:{x:0,y:356,w:393,h:496}}[id];
    if(expected)check(id+' modal matches reference bounds within 1px',record.panel&&close(record.panel,expected));
   }
  }
  return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},safe:options,checks,records};
 }finally{await previewScenarioRestore();}
}
