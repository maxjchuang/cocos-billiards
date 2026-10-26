const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),ts=require('typescript');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'billiards-fp-reference-'));
try{
 for(const n of ['BilliardsPhysics','BilliardsContact','BilliardsTableGeometry','BilliardsSpin','BilliardsRack','BilliardsRules','BilliardsShot','BilliardsCameraMath'])fs.writeFileSync(path.join(dir,n+'.js'),ts.transpileModule(fs.readFileSync('assets/scripts/'+n+'.ts','utf8'),{compilerOptions:{target:7,module:1}}).outputText);
 const P=require(path.join(dir,'BilliardsPhysics.js')),R=require(path.join(dir,'BilliardsRules.js')),S=require(path.join(dir,'BilliardsShot.js')),G=require(path.join(dir,'BilliardsTableGeometry.js')),C=require(path.join(dir,'BilliardsCameraMath.js'));
 const fixtures=require('./first-person-fixtures.cjs').firstPersonFixtures(P,G);const report=[];
 for(const f of fixtures.shots){const balls=JSON.parse(JSON.stringify(f.balls)),ref=new R.Referee();Object.assign(ref,{phase:'ready',isBreak:false,groups:['solid','stripe'],selected:'solid'});const seq=new S.ShotSequence(),events=[];seq.begin({gameId:1,player:0,...f.command,selectedGroup:'solid'});seq.advance(.22,s=>S.commitShot(s,1,balls,ref));let steps=0;
  while(P.isMoving(balls)&&steps++<28800)P.step(balls,P.FIXED_STEP,{respawnCue:false,onEvent:e=>{ref.observe(e,balls);events.push(e);}});if(steps>=28800)throw Error(f.id+' incomplete');ref.finishShot(balls);
  report.push({id:f.id,name:f.name,steps,simulationSeconds:steps/240,events,winner:ref.winner,message:ref.message,balls:balls.map(b=>({id:b.id,x:b.x,z:b.z,pocketed:b.pocketed}))});
 }
 const safety=fixtures.safety.flatMap(f=>[.15,.25].map(h=>({id:f.id,height:h,...C.solveCamera(f.cue,f.direction,h)})));
 fs.mkdirSync('validation/first-person',{recursive:true});fs.writeFileSync('validation/first-person/fixtures.json',JSON.stringify(fixtures,null,2)+'\n');fs.writeFileSync('validation/first-person/reference-shots.json',JSON.stringify(report,null,2)+'\n');fs.writeFileSync('validation/first-person/camera-reference.json',JSON.stringify(safety,null,2)+'\n');
 console.log(JSON.stringify({shots:report.length,safety:safety.length,maxSimSeconds:Math.max(...report.map(r=>r.simulationSeconds)),safe:safety.filter(s=>s.safe).length}));
}finally{fs.rmSync(dir,{recursive:true,force:true})}
