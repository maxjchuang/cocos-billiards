const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const c=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsContact.js'));
const fixtures=JSON.parse(fs.readFileSync('validation/calibration/reference-fixtures.json','utf8'));
const reference=JSON.parse(fs.readFileSync('validation/calibration/independent-reference.json','utf8'));
const {evaluate}=require('../scripts/verify-contact-reference.cjs'),{isolated}=require('../scripts/calibrate-contacts.cjs');
const material={...fixtures.material};
test('finite contact pair matches independently specified restitution and analytic momentum transfer',()=>{
 for(const speed of [1,4,8,10.729])for(const ratio of [1,1.005]){
  const result=isolated(c,{...material,friction:0,maxStep:1e-7},speed,ratio),A=(1-material.restitution*ratio)/(1+ratio)*speed,B=(1+material.restitution)/(1+ratio)*speed;
  assert.ok(Math.abs(result.balls[0].vx-A)/speed<1e-6);assert.ok(Math.abs(result.balls[1].vx-B)/speed<1e-6);
 }
});
for(const fixture of reference.cases)test(`contact dynamics agree with independent DOP853: ${fixture.name}`,()=>{
 const coarse=evaluate(c,fixture,material,2e-6),fine=evaluate(c,fixture,material,1e-6);
 assert.ok(coarse.maxVelocityError<.01);assert.ok(coarse.maxPositionError<material.radius*.01);
 assert.ok(coarse.maxEnergyExcess<=.001);assert.ok(coarse.maxMomentumError<1e-6&&coarse.maxAngularError<1e-6);
 assert.ok(fine.maxVelocityError<coarse.maxVelocityError);
 const impulses=fixture.initial.map(()=>({x:0,z:0}));
 for(const force of coarse.forces){
  assert.ok(force.normal>=0&&force.weight>0&&Number.isFinite(force.impulseX+force.impulseZ));
  for(const [id,sign] of [[force.a,-1],[force.b,1]]){const i=fixture.initial.findIndex(b=>b.id===id);impulses[i].x+=sign*force.impulseX;impulses[i].z+=sign*force.impulseZ;}
 }
 const final=coarse.samples.at(-1).states;
 fixture.initial.forEach((b,i)=>{const mass=material.baseMassKg*(b.mass??1);assert.ok(Math.hypot(mass*(final[i][2]-b.vx)-impulses[i].x,mass*(final[i][3]-b.vz)-impulses[i].z)<1e-10);});
});
test('compression survives an outer frame boundary and is released without a position projection',()=>{
 const f=reference.cases[0],one=f.initial.map(b=>({...b})),split=f.initial.map(b=>({...b}));
 c.advanceContacts(one,.0015,material);c.advanceContacts(split,.0001,material);
 assert.ok(c.contactSample(split,material).elastic>0);c.advanceContacts(split,.0014,material);
 assert.ok(c.contactSample(split,material).elastic<1e-10);
 for(let i=0;i<one.length;i++)assert.ok(Math.hypot(one[i].vx-split[i].vx,one[i].vz-split[i].vz)<.001);
});
test('surface friction transfers side spin while preserving total angular momentum and dissipating energy',()=>{
 const d=2*material.radius,b=[{id:0,x:-d,z:0,vx:2,vz:1,wy:5},{id:1,x:0,z:0,vx:0,vz:0,wy:0}],initial=c.contactSample(b,material);
 let worstEnergy=0,momentum=0,angular=0;c.advanceContacts(b,.003,material,{onSample:s=>{worstEnergy=Math.max(worstEnergy,(s.kinetic+s.elastic)/initial.kinetic-1);momentum=Math.max(momentum,Math.hypot(s.px-initial.px,s.pz-initial.pz));angular=Math.max(angular,Math.abs(s.angularY-initial.angularY));}});
 assert.ok(Math.abs(b[1].wy)>1e-3);assert.ok(worstEnergy<=.001);assert.ok(momentum<1e-10&&angular<1e-10);
});
test('symmetric four-ball control stays symmetric, and array ordering cannot manufacture randomness',()=>{
 const f=reference.cases[1],a=f.initial.map(b=>({...b})),b=f.initial.map(b=>({...b})).reverse();c.advanceContacts(a,.0015,material);c.advanceContacts(b,.0015,material);
 assert.deepEqual(a,b.reverse());assert.ok(Math.abs(a[2].x-a[3].x)<1e-12&&Math.abs(a[2].z+a[3].z)<1e-12);assert.ok(Math.abs(a[0].z)<1e-12&&Math.abs(a[1].z)<1e-12);
});
test('contact onset follows geometric contact time and a zero-time call does not invent an impact',()=>{
 const d=material.radius*2,b=[{id:0,x:-d-.001,z:0,vx:4,vz:0},{id:1,x:0,z:0,vx:0,vz:0}],before=JSON.stringify(b),events=[];
 c.advanceContacts(b,0,material);assert.equal(JSON.stringify(b),before);
 c.advanceContacts(b,.003,material,{onContact:(a,b,time)=>events.push({a,b,time})});assert.equal(events.length,1);assert.ok(Math.abs(events[0].time-.00025)<=material.maxStep+1e-12);
});
test('invalid integration parameters are rejected rather than hanging or discarding elapsed time',()=>{
 for(const m of [{...material,maxStep:0},{...material,radius:NaN},{...material,restitution:0},{...material,friction:-1}])assert.throws(()=>c.advanceContacts([],1,m));
 assert.throws(()=>c.advanceContacts([],-1,material));
});
test('the recorded v5 severe-cluster seed remains a mandatory positive-time gameplay regression',()=>{
 const p=require(process.env.BILLIARDS_TEST_MODULE),r=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsRack.js')),{sample}=require('../scripts/measure-break-balance.cjs');
 const c=sample(p,r,1955789292,0,3294803093,.00025);assert.ok(c.finite&&c.inBounds&&c.settled);assert.ok(c.core<=3,`Recorded failure still traps ${c.core} balls`);
});
test('a ball departing a cushion has a future swept hit instead of a zero-time self-hit',()=>{
 const geometry=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsTableGeometry.js')),T=geometry.TABLE_GEOMETRY;
 const hit=geometry.traceTable({x:T.halfWidth-T.radius,z:.3},-1,0);assert.ok(hit&&hit.distance>1);
});
test('coupled ball and rail contacts do not create mechanical energy through position repair',()=>{
 const p=require(process.env.BILLIARDS_TEST_MODULE),R=p.TABLE.radius,b=[{id:0,x:p.TABLE.halfWidth-R-.09,z:.3,vx:4,vz:.2,wy:10},{id:1,x:p.TABLE.halfWidth-R-.03,z:.3,vx:0,vz:0,wy:0}],m={...material,restitution:p.TABLE.ballRestitution},initial=c.contactSample(b,m),budget=initial.kinetic+initial.elastic;
 let excess=0;for(let i=0;i<240;i++){p.step(b,1/240,{respawnCue:false});const q=c.contactSample(b,m);excess=Math.max(excess,(q.kinetic+q.elastic)/budget-1);assert.ok(b.every(x=>Number.isFinite(x.x)&&Math.abs(x.x)<=p.TABLE.outerHalfWidth));}
 assert.ok(excess<=.001,`Mechanical energy grew by ${excess}`);
});
