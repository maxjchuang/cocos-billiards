const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{compile}=require('./measure-ai.cjs'),{naturalFixtures}=require('./ai-natural-fixtures.cjs');
const label=process.argv[2]||'after',root='validation/ai-natural',dir=fs.mkdtempSync(path.join(os.tmpdir(),'billiards-ai-natural-'));
try{
 const m=compile(dir),aim=require(path.join(dir,'BilliardsAim.js')),cases=[];
 for(const f of naturalFixtures(m.rules))for(const difficulty of ['easy','standard','hard'])for(const seed of [1,19]){
  const planner=new m.ai.AIPlanner(f.balls,f.ref,difficulty,seed),start=performance.now();while(!planner.done)planner.advance(160);const decision=planner.decision(),balls=f.balls.map(b=>({...b})),ref=f.ref.cloneForSimulation(),events=[],seat=ref.current,priorFouls=ref.foulCount[seat];
  if(decision.group)ref.select(decision.group);ref.beginShot(balls);m.p.strike(balls,decision.direction.x,decision.direction.z,m.shot.powerToSpeed(decision.power),decision.tip);
  let steps=0;while(m.p.isMoving(balls)&&steps++<28800){m.p.step(balls,1/240,{respawnCue:false,onEvent:e=>{events.push(e);ref.observe(e,balls)}});ref.trackCue(balls)}ref.finishShot(balls);
  const first=events.findIndex(e=>e.type==='contact'&&(e.a===0||e.b===0)),rails=events.slice(0,first<0?events.length:first).filter(e=>e.type==='cushion'&&e.id===0).length;
  const directCandidates=planner.candidates.filter(c=>{const hit=aim.predictContact(f.balls[0],c.direction.x,c.direction.z,f.balls);return hit?.target===c.target}).length;
  cases.push({name:f.name,difficulty,seed,decision,cpuMs:performance.now()-start,directCandidates,stableDirectCandidates:planner.candidates.filter(c=>c.route==='direct'&&c.contactStable).length,preContactCushions:rails,legal:ref.foulCount[seat]===priorFouls&&ref.winner!==1-seat,potted:balls.filter(b=>b.id&&b.pocketed).map(b=>b.id),settled:!m.p.isMoving(balls),reports:planner.reports,riskReports:planner.riskReports??[],events});
 }
 const summary=Object.fromEntries(['easy','standard','hard'].map(d=>{const rows=cases.filter(c=>c.difficulty===d);return [d,{cases:rows.length,kickShots:rows.filter(c=>c.preContactCushions>0).length,kicksWithGeometricDirectCandidate:rows.filter(c=>c.preContactCushions>0&&c.directCandidates>0).length,legal:rows.filter(c=>c.legal).length,pots:rows.filter(c=>c.legal&&c.potted.length).length,maxCpuMs:Math.max(...rows.map(c=>c.cpuMs))}]}));
 fs.mkdirSync(root,{recursive:true});fs.writeFileSync(root+'/'+label+'.json',JSON.stringify({scope:'11 fixed controlled layouts x 3 difficulties x 2 execution seeds; full search cap, not general win rates or hardware timing',summary,cases},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true})}
