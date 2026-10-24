// Same solver/input/ball sets, paired zero-tolerance and seeded-tolerance racks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const {sample,summarize}=require('./measure-break-balance.cjs');
function symmetryError(c){const b=c.balls.filter(x=>x.id&&!x.pocketed);return b.length?b.reduce((s,x)=>s+Math.min(...b.map(y=>Math.hypot(-x.x-y.x,x.z-y.z))),0)/b.length:0;}
function diagnostics(cases){return {...summarize(cases),meanMirrorErrorM:cases.reduce((s,c)=>s+symmetryError(c),0)/cases.length,uniqueShapesAt1mm:new Set(cases.map(c=>JSON.stringify(c.balls.filter(b=>b.id&&!b.pocketed).map(b=>[+b.x.toFixed(3),+b.z.toFixed(3)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])))).size};}
module.exports={symmetryError,diagnostics};
if(require.main===module){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'rack-tolerance-'));try{
 for(const n of ['BilliardsContact','BilliardsRack','BilliardsTableGeometry','BilliardsSpin','BilliardsPhysics'])fs.writeFileSync(path.join(dir,n+'.js'),ts.transpileModule(fs.readFileSync('assets/scripts/'+n+'.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
 const p=require(path.join(dir,'BilliardsPhysics.js')),r=require(path.join(dir,'BilliardsRack.js')),ballSetSeed=0x5eed1234;
 const before=Array.from({length:30},(_,i)=>sample(p,r,i+1,0,ballSetSeed,0)),after=Array.from({length:30},(_,i)=>sample(p,r,i+1,0,ballSetSeed));
 const report={version:r.RACK_VERSION,scope:'Same current solver, centre tip, default cue/aim, full power. 30 consecutive paired seeds, fixed ball set. No outcome selection.',toleranceM:r.RACK_POSITION_TOLERANCE_M,before:diagnostics(before),after:diagnostics(after),cases:{before,after}};
 const out=process.argv[2];fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,cases:undefined},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}}
