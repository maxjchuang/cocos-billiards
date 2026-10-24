const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const p=require(process.env.BILLIARDS_TEST_MODULE),s=require(process.env.BILLIARDS_SHOT_MODULE),t=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsTrajectory.js'));
const ball=(id,x,z)=>({id,x,z,vx:0,vz:0,wx:0,wy:0,wz:0}),input=(balls,extra={})=>({balls,dx:0,dz:-1,power:2.4,tip:{x:0,y:0},...extra});
function finish(job){while(job.status==='running')job.advance(80);assert.equal(job.status,'complete');return job;}
function simulate(i){const b=i.balls.map(x=>({...x}));assert.ok(p.strike(b,i.dx,i.dz,s.powerToSpeed(i.power),i.tip));let count=0;while(p.isMoving(b)&&count++<28800)p.step(b,p.FIXED_STEP,{respawnCue:false});assert.ok(!p.isMoving(b));return b;}
test('full prediction reproduces the live fixed-step terminal state, including follow/draw and rail English',()=>{
 for(const tip of [{x:0,y:0},{x:.3,y:.7},{x:-.4,y:-.7}]){
  const i=input([ball(0,.02,.7),ball(1,0,.15),ball(2,-.25,-.3)],{tip}),before=JSON.stringify(i),job=finish(new t.ShotPrediction(i)),live=simulate(i);
  assert.equal(JSON.stringify(i),before);assert.deepEqual(job.balls,live);assert.equal(job.target.id,1);
  for(const path of [job.cue,job.target]){const b=live.find(b=>b.id===path.id);assert.deepEqual(path.end,{x:b.x,z:b.z});assert.deepEqual(path.points.at(-1),path.end);}
 }
});
test('weak cue stops before the geometric target and never invents a target trajectory',()=>{
 const i=input([ball(0,0,.9),ball(1,0,-.8)],{power:.4}),job=finish(new t.ShotPrediction(i));assert.equal(job.target,null);assert.ok(job.cue.end.z>-.7);assert.deepEqual(job.balls,simulate(i));
});
test('cue can bank before its first target and the path retains a cushion turn',()=>{
 const i=input([ball(0,.3,.3),ball(1,-.2,.3)],{dx:1,dz:0,power:2.4}),job=finish(new t.ShotPrediction(i));assert.equal(job.target.id,1);assert.ok(job.cue.points.some(q=>q.x>p.TABLE.halfWidth-p.TABLE.radius-.003));assert.deepEqual(job.balls,simulate(i));
});
test('pocket outcomes use drop coordinates and remain pocketed rather than respawning a fake end position',()=>{
 const i=input([ball(0,.35,0),ball(9,.52,0)],{dx:1,dz:0,power:1.2}),job=finish(new t.ShotPrediction(i));assert.equal(job.target.id,9);assert.notEqual(job.target.pocket,null);assert.ok(job.balls.find(b=>b.id===9).pocketed);assert.deepEqual(job.balls,simulate(i));
 const scratch=finish(new t.ShotPrediction(input([ball(0,.5,0)],{dx:1,dz:0,power:1})));assert.notEqual(scratch.cue.pocket,null);assert.ok(scratch.balls[0].pocketed);
});
test('sliced prediction agrees exactly with uninterrupted prediction, and an unfinished job has no final-state claim',()=>{
 const i=input(p.createRack(),{power:4}),a=new t.ShotPrediction(i),b=new t.ShotPrediction(i);a.advance(1);assert.equal(a.status,'running');finish(a);while(b.status==='running')b.advance(17);assert.deepEqual(a.balls,b.balls);assert.deepEqual(a.cue,b.cue);assert.deepEqual(a.target,b.target);
 const short=new t.ShotPrediction(i,1);short.advance();assert.equal(short.status,'incomplete');
});
test('every shot-relevant input invalidates the prediction key; invalid input cannot mutate the original balls',()=>{
 const i=input([ball(0,0,.6),ball(1,0,0)]),key=t.trajectoryKey(i);
 for(const change of [{power:4},{dx:.1},{tip:{x:.3,y:0}},{balls:i.balls.map(b=>({...b,x:b.x+.01}))},{balls:i.balls.map(b=>({...b,mass:1.003}))}])assert.notEqual(t.trajectoryKey({...i,...change}),key);
 const before=JSON.stringify(i);assert.equal(new t.ShotPrediction({...i,dx:NaN}).status,'invalid');assert.equal(new t.ShotPrediction({...i,power:0}).status,'invalid');assert.equal(JSON.stringify(i),before);
});
test('trajectory simplification preserves endpoints and bank corners without erasing a curved segment',()=>{
 const points=[{x:0,z:0},{x:.1,z:0},{x:.2,z:0},{x:.2,z:.1},{x:.18,z:.15},{x:.15,z:.19}],simple=t.simplifyTrajectory(points);assert.deepEqual(simple[0],points[0]);assert.deepEqual(simple.at(-1),points.at(-1));assert.ok(simple.some(p=>p.x===.2&&p.z===0));assert.ok(simple.length>=4&&simple.length<points.length);
});
