// Creator preview only. Uses the editor's existing Node integration for local evidence.
async function previewFirstPersonEvidence(){
 const fs=require('fs'),root=Editor.Project.path+'/validation/first-person',m=await System.import('cc'),canvas=document.getElementById('GameCanvas'),g=m.director.getScene().getComponentInChildren('BilliardsGame');
 fs.mkdirSync(root+'/screens',{recursive:true});fs.mkdirSync(root+'/replays',{recursive:true});
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 const capture=async name=>{await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));fs.writeFileSync(root+'/screens/'+name+'.png',Buffer.from(canvas.toDataURL('image/png').split(',')[1],'base64'));};
 const samples=[];
 for(const rail of [false,true])for(const near of [false,true])for(const height of [.15,.25])for(const variant of ['clean','guide','shadow-off']){
  const label=[rail?'rail':'open',near?'near':'far',height===.15?'low':'high',variant].join('-');
  const config={rail,near,height,gapM:.02,guides:variant==='guide',shadows:variant!=='shadow-off'};
  const sample=await firstPersonContactScene(config);if(variant==='guide')await wait(1500);await capture(label);samples.push({label,...sample});
 }
 const videos=[]; // Creator offscreen canvas streams can be empty; record in the exported browser instead.
 for(const f of __fpFixtures.safety)for(const h of [.15,.25]){
  await fpSetup(__fpFixtures.shots[0],'first-person');Object.assign(g.balls[0],f.cue);g.direction={...f.direction};g.eyeHeight=h;g.viewState.to('first-person',true);g.layoutStamp='';g.viewMessageUntil=0;await wait(80);await capture(f.id+'-'+(h===.15?'low':'high')+'-'+g.viewState.mode);
 }
 await firstPersonContactScene({near:true,height:.2,guides:true});
 const report={scope:'Actual Creator preview canvas captures; synthetic setups, no real-device certification',samples,videos,cameraScreens:__fpFixtures.safety.length*2};
 fs.writeFileSync(root+'/visual-evidence.json',JSON.stringify(report,null,2));return report;
}
