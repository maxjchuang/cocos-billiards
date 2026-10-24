// Seeded-rack calibration and label-order control; no Cocos runtime required.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function run(p,config){
 const b=p.createRack(config),initial=b.map(x=>({id:x.id,bodyId:x.bodyId,mass:x.mass}));p.strike(b,0,-1,8);
 let frame=0,finite=true,inBounds=true;for(;frame<7200&&p.isMoving(b);frame++){
  p.step(b,p.FIXED_STEP,{respawnCue:false});
  for(const x of b){finite=finite&&[x.x,x.z,x.vx,x.vz].every(Number.isFinite);if(!x.pocketed)inBounds=inBounds&&Math.abs(x.x)<=p.TABLE.outerHalfWidth&&Math.abs(x.z)<=p.TABLE.outerHalfLength;}
 }
 return {config,initial,settled:!p.isMoving(b),seconds:frame/240,finite,inBounds,balls:b.map(x=>({id:x.id,bodyId:x.bodyId,mass:x.mass,x:x.x,z:x.z,pocketed:!!x.pocketed}))};
}
function hausdorff(a,b){
 const points=x=>x.balls.filter(v=>v.id&&!v.pocketed);
 const A=points(a),B=points(b);if(!A.length||!B.length)return A.length===B.length?0:Infinity;
 const directed=(x,y)=>Math.max(...x.map(p=>Math.min(...y.map(q=>Math.hypot(p.x-q.x,p.z-q.z)))));
 return Math.max(directed(A,B),directed(B,A));
}
module.exports={run,hausdorff};
if(require.main===module){
 const ts=require('typescript'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'billiards-racks-'));
 try{
  for(const n of ['BilliardsContact','BilliardsRack','BilliardsTableGeometry','BilliardsSpin','BilliardsPhysics'])fs.writeFileSync(path.join(dir,n+'.js'),ts.transpileModule(fs.readFileSync('assets/scripts/'+n+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
  const p=require(path.join(dir,'BilliardsPhysics.js')),r=require(path.join(dir,'BilliardsRack.js')),ballSetSeed=0x5eed1234;
  const control=Array.from({length:50},(_,i)=>run(p,r.rackConfig(i+1,ballSetSeed,0,0))),cases=Array.from({length:50},(_,i)=>run(p,r.rackConfig(i+1,ballSetSeed)));
  const canonical=x=>x.balls.slice().sort((a,b)=>a.bodyId-b.bodyId).map(b=>[b.x,b.z,b.pocketed]);
  const shape=x=>JSON.stringify(x.balls.filter(b=>!b.pocketed).map(b=>[+b.x.toFixed(3),+b.z.toFixed(3)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]));
  const pairDistances=[];for(let i=0;i<cases.length;i++)for(let j=i+1;j<cases.length;j++)pairDistances.push(hausdorff(cases[i],cases[j]));
  const replay=run(p,cases[0].config);
  const report={scope:'Pure TS; default cue/aim, centre tip, full power. Same physical ball set, new legal rack permutations; seeded sub-millimetre rack tolerance, no shot noise.',version:r.RACK_VERSION,massVariation:r.TARGET_MASS_VARIATION,ballSetSeed,
   control:{count:50,uniqueUnlabelledShapes:new Set(control.map(shape)).size,identicalBodyTrajectories:control.every(x=>JSON.stringify(canonical(x))===JSON.stringify(canonical(control[0]))),reference:control[0]},
   variation:{count:50,uniqueUnlabelledShapesAt1mm:new Set(cases.map(shape)).size,pairs:pairDistances.length,pairsChangedAtLeast2cm:pairDistances.filter(d=>d>=.02).length,meanHausdorffM:pairDistances.reduce((a,b)=>a+b,0)/pairDistances.length,minHausdorffM:Math.min(...pairDistances),maxHausdorffM:Math.max(...pairDistances),allSafe:cases.every(x=>x.finite&&x.inBounds&&x.settled&&x.seconds<15),maxSettleSeconds:Math.max(...cases.map(x=>x.seconds))},
   replayExactlyEqual:JSON.stringify(replay.balls)===JSON.stringify(cases[0].balls),cases};
  const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({control:report.control.identicalBodyTrajectories,variation:report.variation,replay:report.replayExactlyEqual},null,2));
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
