const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const geom=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsTableGeometry.js'));
const {TABLE,POCKETS,step,FIXED_STEP}=require(process.env.BILLIARDS_TEST_MODULE);
const {pocketCoordinates,pocketAt,traceTable,validTablePlacement,CUSHION_PATHS,POCKET_MODEL}=geom;
const make=(p,distance,speed,offset=0)=>({id:1,x:p.lip.x-p.normal.x*distance+p.tangent.x*offset,
 z:p.lip.z-p.normal.z*distance+p.tangent.z*offset,vx:p.normal.x*speed,vz:p.normal.z*speed});
test('table, ball and mouth ratios follow the design prototype and all visible paths stay inside the frame',()=>{
 assert.equal(TABLE.halfWidth*2,1.26);assert.equal(TABLE.halfLength*2,2.54);
 for(const p of POCKETS){assert.equal(p.mouth,p.kind==='corner'?.085:.082);
  for(const v of p.outline)assert.ok(Math.abs(v.x)<TABLE.outerHalfWidth&&Math.abs(v.z)<TABLE.outerHalfLength);}
 for(const rail of CUSHION_PATHS)for(const p of rail.polygon)assert.ok(Math.abs(p.x)<TABLE.outerHalfWidth&&Math.abs(p.z)<TABLE.outerHalfLength);
 assert.ok(POCKET_MODEL.cornerMouth/(2*TABLE.radius)>1.48);
});
test('six pockets accept centred approaches at slow and maximum speed, once and only behind the drop plane',()=>{
 for(const p of POCKETS)for(const speed of [.3,4]){
  const ball=make(p,speed<1?.025:.09,speed),events=[];let before=false;
  for(let i=0;i<240*4&&!ball.pocketed;i++){
   if(pocketCoordinates(ball,p).v<p.dropDepth)before=true;
   step([ball],FIXED_STEP,{respawnCue:false,onEvent:e=>events.push(e)});
   if(ball.pocketed)assert.ok(pocketCoordinates(ball,p).v>=p.dropDepth-1e-9);
  }
  assert.ok(before);assert.ok(ball.pocketed,`${p.kind} speed ${speed}`);
  for(let i=0;i<5;i++)step([ball],FIXED_STEP,{respawnCue:false,onEvent:e=>events.push(e)});
  assert.equal(events.filter(e=>e.type==='pocket').length,1);
 }
});
test('a ball on the middle mouth or just in front of the drop plane is not captured',()=>{
 for(const p of POCKETS){const ball=make(p,0,0);step([ball],FIXED_STEP,{respawnCue:false});assert.ok(!ball.pocketed);
  const front={x:p.lip.x+p.normal.x*(p.dropDepth-.001),z:p.lip.z+p.normal.z*(p.dropDepth-.001)};
  assert.equal(pocketAt(front),-1);
 }
});
test('jaw contact rejects a shot whose ball cannot fit, instead of capturing it through a large circle',()=>{
 for(const p of POCKETS){
  const ball=make(p,.1,1,p.mouth/2-TABLE.radius+.012),events=[];
  for(let i=0;i<150;i++)step([ball],FIXED_STEP,{respawnCue:false,onEvent:e=>events.push(e)});
  assert.ok(!ball.pocketed,p.kind);assert.ok(events.some(e=>e.type==='cushion'));
 }
});
test('table placement excludes jaw penetration while leaving a ball before the middle pocket supported',()=>{
 assert.ok(validTablePlacement({x:TABLE.halfWidth-TABLE.radius,z:0}));
 for(const p of POCKETS){assert.ok(!validTablePlacement(p));
  assert.ok(!validTablePlacement({x:p.lip.x+p.tangent.x*p.mouth/2,z:p.lip.z+p.tangent.z*p.mouth/2}));}
});
test('aim enters open mouths and predicts the same first boundary as actual jaw collisions',()=>{
 for(const p of POCKETS){
  const centred=make(p,.12,1);const clear=traceTable(centred,p.normal.x,p.normal.z);
  assert.equal(clear.kind,'pocket');assert.ok(Math.abs(clear.distance-(.12+p.dropDepth))<1e-8);
  const ball=make(p,.12,1,p.mouth/2-TABLE.radius+.012);const hit=traceTable(ball,p.normal.x,p.normal.z);
  assert.equal(hit.kind,'cushion');let first;
  for(let i=0;i<100&&!first;i++)step([ball],FIXED_STEP,{respawnCue:false,onEvent:e=>{first??=e;}});
  assert.equal(first.type,'cushion');
 }
});

test('insufficient speed stops before the pocket instead of attracting the ball',()=>{
 for(const p of POCKETS){const ball=make(p,.09,.2);
  for(let i=0;i<240*3;i++)step([ball],FIXED_STEP,{respawnCue:false});
  assert.ok(!ball.pocketed);assert.ok(pocketCoordinates(ball,p).v<p.dropDepth);
  assert.equal(ball.vx,0);assert.equal(ball.vz,0);
 }
});

test('an exactly overlapping cushion centre resolves inward without a zero-distance normal',()=>{
 const ball={id:1,x:TABLE.halfWidth,z:.35,vx:0,vz:0};
 step([ball],FIXED_STEP,{respawnCue:false});
 assert.ok(ball.x<=TABLE.halfWidth-TABLE.radius+1e-9);
 assert.ok(Number.isFinite(ball.x)&&Number.isFinite(ball.z));
});
