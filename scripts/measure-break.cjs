// Development-only, deterministic break calibration. No Creator runtime required.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function measureBreak(p,speed,offset=0){
 const balls=p.createRack(),initial=balls.map(b=>({...b})),maxDisplacements=balls.map(()=>0),cushions=new Set();
 balls[0].x=offset;p.strike(balls,-offset,p.FOOT_SPOT-balls[0].z,speed);
 let displacementSum=0,spreadAt1s=0,frame=0,maxSpeed=0,finite=true,inBounds=true;
 for(;frame<240*30&&p.isMoving(balls);frame++){
  const before=balls.map(b=>({x:b.x,z:b.z}));
  p.step(balls,p.FIXED_STEP,{respawnCue:false,onEvent:e=>{if(e.type==='cushion'&&e.id!==0)cushions.add(e.id);}});
  for(const b of balls){
   finite=finite&&[b.x,b.z,b.vx,b.vz,b.wx??0,b.wy??0,b.wz??0].every(Number.isFinite);
   if(!b.pocketed)inBounds=inBounds&&Math.abs(b.x)<=p.TABLE.outerHalfWidth&&Math.abs(b.z)<=p.TABLE.outerHalfLength;
   maxSpeed=Math.max(maxSpeed,Math.hypot(b.vx,b.vz));
   if(b.id){displacementSum+=Math.hypot(b.x-before[b.id].x,b.z-before[b.id].z);maxDisplacements[b.id]=Math.max(maxDisplacements[b.id],Math.hypot(b.x-initial[b.id].x,b.z-initial[b.id].z));}
  }
  if(frame+1===240){const active=balls.slice(1).filter(b=>!b.pocketed);spreadAt1s=(Math.max(...active.map(b=>b.x))-Math.min(...active.map(b=>b.x)))*(Math.max(...active.map(b=>b.z))-Math.min(...active.map(b=>b.z)));}
 }
 return {speed,offset,frameDisplacementSumM:displacementSum,spreadAreaAt1sM2:spreadAt1s,targetCushionIds:Array.from(cushions),everDisplaced20cm:maxDisplacements.slice(1).filter(d=>d>.2).length,potted:balls.filter(b=>b.pocketed).map(b=>b.id),settleSeconds:frame/240,settled:!p.isMoving(balls),maxSpeed,finite,inBounds};
}
module.exports={measureBreak};
if(require.main===module){
 const ts=require('typescript'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'billiards-power-'));
 try{
  for(const name of ['BilliardsTableGeometry','BilliardsSpin','BilliardsPhysics','BilliardsRules','BilliardsShot'])fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(fs.readFileSync('assets/scripts/'+name+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const p=require(path.join(dir,'BilliardsPhysics.js')),s=require(path.join(dir,'BilliardsShot.js'));
  const report={scope:'Pure TS simulation; standard rack, centre tip, head-line positions aiming at apex. Prototype tuning, not measured real-table data.',curve:[10,25,50,60,70,80,90,100].map(percent=>({percent,speed:s.powerToSpeed(percent/25)})),cases:[0,.12,-.12].map(offset=>({legacy:measureBreak(p,4,offset),updated:measureBreak(p,s.powerToSpeed(4),offset)}))};
  const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report,null,2));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
