const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{compile,evaluate}=require('./measure-ai.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-match-'));try{
 const m=compile(dir),rack=require(path.join(dir,'BilliardsRack.js')),balls=m.p.createRack(rack.rackConfig(31,42,.005,.00025)),ref=new m.rules.Referee(),shots=[],start=performance.now();
 while(ref.phase!=='over'&&shots.length<120){
  if(ref.phase==='choice'){ref.chooseBreak(balls,'accept');continue;}
  if(ref.phase==='placing'){const spot=m.ai.chooseAIPlacement(balls,ref,'standard');if(!spot||!ref.placeCue(balls,spot.x,spot.z)||!ref.confirmPlacement(balls))throw Error('AI placement blocked');continue;}
  const seat=ref.current,planner=new m.ai.AIPlanner(balls,ref,'standard',100+shots.length);while(!planner.done)planner.advance(160);const decision=planner.decision();if(!decision)throw Error('AI has no command');if(decision.group)ref.select(decision.group);if(!ref.beginShot(balls)||!m.p.strike(balls,decision.direction.x,decision.direction.z,m.shot.powerToSpeed(decision.power),decision.tip))throw Error('AI command rejected');
  let steps=0;while(m.p.isMoving(balls)&&steps++<28800){m.p.step(balls,1/240,{respawnCue:false,onEvent:e=>ref.observe(e,balls)});ref.trackCue(balls);}if(m.p.isMoving(balls))throw Error('Shot did not settle');ref.finishShot(balls);
  shots.push({seat,decision,message:ref.message,phase:ref.phase,groups:[...ref.groups],remaining:balls.filter(b=>b.id&&!b.pocketed).length,winner:ref.winner});if(shots.length%5===0)console.log('shots',shots.length,'remaining',shots.at(-1).remaining,'fouls',ref.foulCount);
 }
 fs.mkdirSync('validation/ai',{recursive:true});fs.writeFileSync('validation/ai/full-match.json',JSON.stringify({scope:'Offline standard-vs-standard full seeded rack using full candidate caps, actual physics and referee; not a user win-rate',rackSeed:31,ballSetSeed:42,winner:ref.winner,complete:ref.phase==='over',shots:shots.length,cpuMs:performance.now()-start,fouls:ref.foulCount,history:shots},null,2)+'\n');console.log('complete',ref.phase==='over','winner',ref.winner,'shots',shots.length);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
