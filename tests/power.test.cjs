const {test}=require('node:test'),assert=require('node:assert/strict');
const p=require(process.env.BILLIARDS_TEST_MODULE),s=require(process.env.BILLIARDS_SHOT_MODULE),{Referee}=require(process.env.BILLIARDS_RULES_MODULE);
const {measureBreak}=require('../scripts/measure-break.cjs');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('power curve keeps gentle strokes and expands the upper range smoothly',()=>{
 for(const v of [.4,1,2,2.4])near(s.powerToSpeed(v),v);
 near(s.powerToSpeed(4),8);near(s.powerToSpeed(3.2),4.2);near(s.powerToSpeed(3.6),5.85);
 for(let v=.41;v<=4;v+=.01)assert.ok(s.powerToSpeed(v)>s.powerToSpeed(v-.01));
 near(s.powerToSpeed(2.4-1e-7),2.4-1e-7);near(s.powerToSpeed(2.4+1e-7),2.4+1e-7);
 assert.equal(s.powerToSpeed(NaN),0);assert.equal(s.powerToSpeed(Infinity),0);assert.equal(s.powerToSpeed(-1),0);
});
test('100% commits the stronger stroke only at the unique 220ms contact frame',()=>{
 const balls=p.createRack(),ref=new Referee(),sequence=new s.ShotSequence();ref.confirmPlacement(balls);
 const request={gameId:1,player:0,direction:{x:0,z:-1},power:4,tipOffset:{x:0,y:0},selectedGroup:null};
 assert.ok(sequence.begin(request));let count=0;const commit=x=>{count++;return s.commitShot(x,1,balls,ref);};
 sequence.advance(.219,commit);assert.equal(p.isMoving(balls),false);sequence.advance(.001,commit);near(balls[0].vz,-8);assert.equal(count,1);
 sequence.advance(.5,commit);assert.equal(count,1);assert.equal(new s.ShotSequence().begin({...request,power:8}),false);
});
test('high-speed opposing balls exchange velocity before crossing each other',()=>{
 const balls=[{id:0,x:-.03,z:0,vx:8,vz:0},{id:1,x:.03,z:0,vx:-8,vz:0}];
 p.step(balls,p.FIXED_STEP,{respawnCue:false});assert.ok(balls[0].vx<0&&balls[1].vx>0);assert.ok(balls[0].x<balls[1].x);
 assert.ok(balls[1].x-balls[0].x>=p.TABLE.radius*2-1e-8);
});
test('maximum-speed cushion contact returns the ball inside the bed',()=>{
 const b={id:1,x:p.TABLE.halfWidth-p.TABLE.radius-.001,z:.3,vx:8,vz:0};p.step([b],p.FIXED_STEP,{respawnCue:false});
 assert.ok(b.vx<0&&b.x<=p.TABLE.halfWidth-p.TABLE.radius+1e-8);
});
test('extreme spin remains dissipative and finite at the new maximum stroke',()=>{
 const energy=b=>.5*(b.vx*b.vx+b.vz*b.vz)+.2*p.TABLE.radius**2*((b.wx??0)**2+(b.wy??0)**2+(b.wz??0)**2);
 for(const tip of [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:.6,y:-.8}]){
  const b={id:0,x:0,z:.3,vx:0,vz:0};p.strike([b],1,.3,p.TABLE.maxStrikeSpeed,tip);let last=energy(b);
  for(let i=0;i<240*12;i++){p.step([b],p.FIXED_STEP,{respawnCue:false});const e=energy(b);assert.ok(Number.isFinite(e)&&e<=last+1e-7);last=e;}
  assert.equal(p.isMoving([b]),false);
 }
});
for(const offset of [0,.12,-.12])test(`full-power break disperses the rack more strongly at cue x=${offset}`,()=>{
 const old=measureBreak(p,4,offset),updated=measureBreak(p,s.powerToSpeed(4),offset);
 assert.ok(updated.frameDisplacementSumM>=old.frameDisplacementSumM*2);
 assert.ok(updated.spreadAreaAt1sM2>=old.spreadAreaAt1sM2*1.5);
 assert.ok(updated.targetCushionIds.length>=7);
 assert.ok(updated.finite&&updated.inBounds&&updated.settled&&updated.settleSeconds<15);
});
