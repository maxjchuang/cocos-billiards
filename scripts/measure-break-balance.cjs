// Direction/pocket-frequency diagnostics; acceptance bounds are tuning guards, not real-table data.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript'),{execFileSync}=require('node:child_process');
function sample(p,r,seed,offset=0,ballSetSeed=0x5eed1234,positionToleranceM,speed=8){
 const config=r.rackConfig(seed,ballSetSeed,r.TARGET_MASS_VARIATION,positionToleranceM),balls=p.createRack(config),pockets=[],events=[],trace=[];balls[0].x=offset;
 p.strike(balls,-offset,p.FOOT_SPOT-balls[0].z,speed);
 let f=0,finite=true,inBounds=true;
 for(;f<3600&&p.isMoving(balls);f++){
  p.step(balls,1/240,{respawnCue:false,onEvent:e=>{events.push({frame:f,timeWindow:[f/240,(f+1)/240],event:e});if(e.type==='pocket')pockets.push(e);}});
  if(f%24===0)trace.push({time:(f+1)/240,balls:balls.map(b=>({id:b.id,x:b.x,z:b.z,pocketed:!!b.pocketed}))});
  for(const b of balls){finite=finite&&[b.x,b.z,b.vx,b.vz].every(Number.isFinite);if(!b.pocketed)inBounds=inBounds&&Math.abs(b.x)<=p.TABLE.outerHalfWidth&&Math.abs(b.z)<=p.TABLE.outerHalfLength;}
 }
 const live=balls.filter(b=>b.id&&!b.pocketed),targetPockets=pockets.filter(e=>e.id);
 return {config,offset,speed,finite,inBounds,settled:!p.isMoving(balls),seconds:f/240,upper:live.filter(b=>b.z<0).length,lower:live.filter(b=>b.z>=0).length,potted:targetPockets.length,bothRackEndCorners:[0,3].every(i=>targetPockets.some(e=>e.pocket===i)),bothCueEndCorners:[2,5].every(i=>targetPockets.some(e=>e.pocket===i)),core:live.filter(b=>Math.hypot(b.x,b.z+.735)<.17).length,pockets,events,trace,balls};
}
function summarize(cases){const sum=k=>cases.reduce((s,c)=>s+c[k],0);return {count:cases.length,meanUpper:sum('upper')/cases.length,meanLower:sum('lower')/cases.length,upperShare:sum('upper')/(sum('upper')+sum('lower')),meanPotted:sum('potted')/cases.length,bothRackEndCornerRate:sum('bothRackEndCorners')/cases.length,bothCueEndCornerRate:sum('bothCueEndCorners')/cases.length,meanCore:sum('core')/cases.length,allSafe:cases.every(c=>c.finite&&c.inBounds&&c.settled)};}
function compile(dir,ref){fs.mkdirSync(dir,{recursive:true});for(const n of ['BilliardsContact','BilliardsRack','BilliardsTableGeometry','BilliardsSpin','BilliardsPhysics']){const file='assets/scripts/'+n+'.ts',exists=!ref||execFileSync('git',['ls-tree','--name-only',ref,'--',file],{encoding:'utf8'}).trim();if(!exists)continue;const src=ref?execFileSync('git',['show',ref+':'+file],{encoding:'utf8'}):fs.readFileSync(file,'utf8');fs.writeFileSync(path.join(dir,n+'.js'),ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);}return {p:require(path.join(dir,'BilliardsPhysics.js')),r:require(path.join(dir,'BilliardsRack.js'))};}
module.exports={sample,summarize};
if(require.main===module){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'break-balance-'));try{
 const old=compile(path.join(dir,'before'),'4397155'),now=compile(path.join(dir,'after'));
 const run=(m,offset)=>Array.from({length:30},(_,i)=>sample(m.p,m.r,i+1,offset,(0x5eed1234+(i%5)*0x1234567)>>>0));
 const before=run(old,0),after=run(now,0),left=run(now,-.12),right=run(now,.12);
 const report={version:now.r.RACK_VERSION,baseline:'4397155',scope:'30 consecutive rack seeds across 5 deterministic ball sets; default/left/right cue, aim at apex, full-power centre tip. Counts are regression diagnostics, not measured real-world frequencies.',before:summarize(before),after:summarize(after),left:summarize(left),right:summarize(right),cases:{before,after,left,right}};
 fs.mkdirSync(path.dirname(process.argv[2]),{recursive:true});fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,cases:undefined},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}}
