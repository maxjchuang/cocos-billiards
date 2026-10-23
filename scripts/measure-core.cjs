// Compare the actual default full-power break against the previous pairwise solver.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const baseline='77449f6',ballSetSeed=0x5eed1234;
function compile(dir,ref){
 fs.mkdirSync(dir,{recursive:true});
 for(const name of ['BilliardsRack','BilliardsSpin','BilliardsTableGeometry','BilliardsPhysics']){
  const file='assets/scripts/'+name+'.ts',source=ref?execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}):fs.readFileSync(file,'utf8');
  fs.writeFileSync(path.join(dir,name+'.js'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
 }
 return {p:require(path.join(dir,'BilliardsPhysics.js')),r:require(path.join(dir,'BilliardsRack.js'))};
}
function measure({p,r},seed){
 const config=r.rackConfig(seed,ballSetSeed),balls=p.createRack(config),initial=balls.map(b=>({...b})),maxDisplacements=balls.map(()=>0);
 p.strike(balls,0,-1,8);let frame=0,finite=true,inBounds=true;
 for(;frame<7200&&p.isMoving(balls);frame++){
  p.step(balls,p.FIXED_STEP,{respawnCue:false});
  balls.forEach((b,i)=>{maxDisplacements[i]=Math.max(maxDisplacements[i],Math.hypot(b.x-initial[i].x,b.z-initial[i].z));finite=finite&&[b.x,b.z,b.vx,b.vz].every(Number.isFinite);inBounds=inBounds&&(b.pocketed||Math.abs(b.x)<=p.TABLE.outerHalfWidth&&Math.abs(b.z)<=p.TABLE.outerHalfLength);});
 }
 const result={config,settled:!p.isMoving(balls),seconds:frame/240,finite,inBounds,balls:balls.map(b=>({...b,maxDisplacementM:maxDisplacements[b.id]}))},targets=result.balls.filter(b=>b.id);
 const displacement=b=>{const start=initial.find(x=>x.id===b.id);return Math.hypot(b.x-start.x,b.z-start.z);};
 const interior=targets.filter(b=>[2,3,4,8].includes(b.bodyId));
 return {...result,coreCount:targets.filter(b=>!b.pocketed&&Math.hypot(b.x,b.z+.735)<.17).length,interiorMinMaxExcursionM:Math.min(...interior.map(b=>b.maxDisplacementM)),interiorMinFinalDisplacementM:Math.min(...interior.map(displacement)),moved20cm:targets.filter(b=>b.pocketed||displacement(b)>=.2).length};
}
function summary(cases){return {count:cases.length,maxCoreCount:Math.max(...cases.map(c=>c.coreCount)),meanCoreCount:cases.reduce((a,c)=>a+c.coreCount,0)/cases.length,minInteriorDisplacementM:Math.min(...cases.map(c=>c.interiorMinMaxExcursionM)),minTargetsMoved20cm:Math.min(...cases.map(c=>c.moved20cm)),allSafe:cases.every(c=>c.settled&&c.finite&&c.inBounds&&c.seconds<15)};}
if(require.main===module){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'billiards-core-'));try{
 const old=compile(path.join(dir,'before'),baseline),current=compile(path.join(dir,'after'));
 const before=Array.from({length:50},(_,i)=>measure(old,i+1)),after=Array.from({length:50},(_,i)=>measure(current,i+1));
 const report={scope:'Pure TS default cue (0,0.65), aim (0,-1), centre tip, 8m/s; 50 consecutive legal rack seeds, same ballSetSeed, no selected outcomes.',baseline,version:current.r.RACK_VERSION,ballSetSeed,coreDefinition:'Unpocketed target centres within 0.17m of (0,-0.735). Interior bodyIds 2/3/4/8 are initial central rack slots.',before:summary(before),after:summary(after),checks:{coreAtMostTwo:after.every(c=>c.coreCount<=2),interiorMovedTwoDiameters:after.every(c=>c.interiorMinMaxExcursionM>=current.p.TABLE.radius*4),safe:after.every(c=>c.finite&&c.inBounds&&c.settled&&c.seconds<15)},cases:{before,after}};
 const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify({before:report.before,after:report.after,checks:report.checks},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}}
module.exports={measure,summary};
