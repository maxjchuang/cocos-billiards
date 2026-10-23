const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const p=require(process.env.BILLIARDS_TEST_MODULE),r=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsRack.js')),{Referee}=require(process.env.BILLIARDS_RULES_MODULE);
const config=(seed,variation=r.TARGET_MASS_VARIATION)=>r.rackConfig(seed,0x5eed1234,variation);
function settle(balls){p.strike(balls,0,-1,8);let i=0;for(;i<7200&&p.isMoving(balls);i++)p.step(balls,p.FIXED_STEP,{respawnCue:false});assert.ok(i<3600);return balls.slice().sort((a,b)=>a.bodyId-b.bodyId).map(b=>({bodyId:b.bodyId,x:b.x,z:b.z,pocketed:!!b.pocketed}));}
test('seeded racks preserve all Chinese-pool placement constraints without extra gaps',()=>{
 const orders=new Set();for(let seed=0;seed<100;seed++){
  const balls=p.createRack(config(seed)),apex=balls.find(b=>b.bodyId===r.RACK_BODY_ORDER[0]);
  assert.deepEqual(balls.map(b=>b.id),Array.from({length:16},(_,i)=>i));assert.equal(new Set(balls.map(b=>b.bodyId)).size,16);
  assert.equal(apex.x,0);assert.equal(apex.z,p.FOOT_SPOT);assert.equal(balls[8].x,0);assert.equal(balls[8].bodyId,8);
  const rear=balls.filter(b=>b.id).sort((a,b)=>a.z-b.z||a.x-b.x).slice(0,5);assert.notEqual(rear[0].id<8,rear[4].id<8);
  for(let i=0;i<16;i++)for(let j=i+1;j<16;j++)assert.ok(Math.hypot(balls[i].x-balls[j].x,balls[i].z-balls[j].z)>=p.TABLE.radius*2-1e-12);
  for(const b of balls.filter(b=>b.id))assert.ok(Math.min(...balls.filter(q=>q.id&&q!==b).map(q=>Math.hypot(q.x-b.x,q.z-b.z)))<=p.TABLE.radius*2+.000010001);
  orders.add(balls.slice().sort((a,b)=>a.bodyId-b.bodyId).map(b=>b.id).join(','));
 }
 assert.ok(orders.size>95);
});
test('target masses stay small, balanced and attached to ball identity across re-racks',()=>{
 const a=p.createRack(config(1)),b=p.createRack(config(2));assert.deepEqual(a.map(x=>x.mass),b.map(x=>x.mass));assert.equal(a[0].mass,1);
 assert.ok(Math.abs(a.slice(1).reduce((sum,b)=>sum+b.mass,0)-15)<1e-12);
 assert.ok(a.slice(1).every(b=>Math.abs(b.mass-1)<=.005000000001));assert.ok(a.some(x=>x.mass<1)&&a.some(x=>x.mass>1));
 for(const tip of [{x:0,y:0},{x:.3,y:-.4}]){const states=[];for(let seed=1;seed<10;seed++){const balls=p.createRack(config(seed));p.strike(balls,.2,-1,8,tip);states.push({...balls[0]});}for(const s of states)assert.deepEqual(s,states[0]);}
});
test('same recipe and inputs reproduce exact settled coordinates; physics samples no randomness',()=>{
 const a=p.createRack(config(20)),b=p.createRack(r.restoreRackConfig(JSON.parse(JSON.stringify(config(20)))));
 const random=Math.random;try{Math.random=()=>{throw Error('Randomness during physics');};assert.deepEqual(settle(a),settle(b));}finally{Math.random=random;}
});
test('changing only visible ball numbers cannot change equal-mass trajectories',()=>{
 const reference=settle(p.createRack(config(1,0)));
 for(let seed=2;seed<=20;seed++)assert.deepEqual(settle(p.createRack(config(seed,0))),reference);
});
test('array order does not change unequal-mass collision solving',()=>{
 const a=p.createRack(config(7)),b=p.createRack(config(7)).reverse();assert.deepEqual(settle(a),settle(b));
});
test('unequal masses preserve momentum and dissipate energy according to restitution',()=>{
 const a={id:0,bodyId:0,mass:1,x:0,z:0,vx:1,vz:0},b={id:1,bodyId:1,mass:1.005,x:.056,z:0,vx:0,vz:0};
 const centre=a.mass*a.x+b.mass*b.x;p.step([a,b],0,{respawnCue:false});
 assert.ok(Math.abs(a.mass*a.vx+b.mass*b.vx-1)<1e-12);
 assert.ok(Math.abs(a.mass*a.x+b.mass*b.x-centre)<1e-12);
 assert.ok(.5*a.mass*a.vx*a.vx+.5*b.mass*b.vx*b.vx<.5);
 assert.ok(Math.abs(b.vx-(1+p.TABLE.ballRestitution)/(1+b.mass))<1e-12);
});
test('50 seeded default breaks produce visibly different geometric outcomes and settle safely',()=>{
 const results=Array.from({length:50},(_,i)=>settle(p.createRack(config(i+1))));
 const hashes=new Set(results.map(b=>JSON.stringify(b.filter(q=>!q.pocketed).map(q=>[+q.x.toFixed(3),+q.z.toFixed(3)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]))));assert.equal(hashes.size,50);
 const points=r=>r.filter(b=>b.bodyId&&!b.pocketed),directed=(a,b)=>Math.max(...a.map(p=>Math.min(...b.map(q=>Math.hypot(p.x-q.x,p.z-q.z)))));
 let different=0,total=0;for(let i=0;i<50;i++)for(let j=i+1;j<50;j++){total++;const a=points(results[i]),b=points(results[j]);if(Math.max(directed(a,b),directed(b,a))>=.02)different++;}
 assert.ok(different/total>=.9);
 for(const list of results)for(const b of list){assert.ok(Number.isFinite(b.x)&&Number.isFinite(b.z));if(!b.pocketed)assert.ok(Math.abs(b.x)<=p.TABLE.outerHalfWidth&&Math.abs(b.z)<=p.TABLE.outerHalfLength);}
});
test('rack journal persists recipes, keeps the ball set, and advances seed sequence after reload',()=>{
 const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},session=new r.RackSession(store,()=>.25);
 const a=session.next(),b=session.next();assert.notEqual(a.rackSeed,b.rackSeed);assert.equal(a.ballSetSeed,b.ballSetSeed);assert.ok(Object.isFrozen(a));
 const restored=new r.RackSession(store,()=>{throw Error('Must load the saved ball set');});assert.equal(restored.ballSetSeed,a.ballSetSeed);assert.deepEqual(restored.history,[a,b]);assert.deepEqual(restored.next(),session.next());
 for(let i=0;i<50;i++)restored.next();assert.equal(restored.history.length,32);assert.equal(JSON.parse(data.get(r.RACK_STORAGE_KEY)).history.length,32);
});
test('unavailable or corrupted seed storage does not block play',()=>{
 const bad={getItem(){throw Error('unavailable');},setItem(){throw Error('unavailable');}},a=new r.RackSession(bad,()=>.5),first=a.next();assert.equal(a.persistent,false);assert.notEqual(a.next().rackSeed,first.rackSeed);
 const broken={getItem:()=>'{bad json',setItem(){}},b=new r.RackSession(broken,()=>.1);assert.equal(p.createRack(b.next()).length,16);
});
test('replay profile survives a referee-requested re-rack; accepting the table does not consume a recipe',()=>{
 const session=new r.RackSession(undefined,()=>.1),profile=config(42),calls=[];const ref=new Referee(()=>{const c=session.next(profile);calls.push(c);return p.createRack(c);}),balls=p.createRack(profile);
 ref.phase='choice';ref.breakChoice='illegal';ref.current=1;ref.chooseBreak(balls,'self');assert.equal(calls.length,1);assert.equal(calls[0].ballSetSeed,profile.ballSetSeed);assert.equal(calls[0].massVariation,profile.massVariation);assert.deepEqual(balls.map(b=>b.mass),p.createRack(profile).map(b=>b.mass));
 ref.phase='choice';ref.breakChoice='illegal';ref.chooseBreak(balls,'accept');assert.equal(calls.length,1);
});
test('replay validation rejects unknown versions, malformed seeds and exaggerated variations',()=>{
 for(const bad of [null,{}, {...config(1),version:'future'}, {...config(1),rackSeed:NaN},{...config(1),rackSeed:-1},{...config(1),ballSetSeed:2**32},{...config(1),massVariation:.1}])assert.throws(()=>r.restoreRackConfig(bad));
 assert.deepEqual(r.restoreRackConfig(config(0)),config(0));
});

test('packed contact compression propagates to interior balls without creating energy',()=>{
 const d=p.TABLE.radius*2+.00001,balls=Array.from({length:3},(_,i)=>({id:i,mass:1+i*.002,x:i*d,z:0,vx:i===0?2:0,vz:0})),events=[];
 const momentum=balls.reduce((s,b)=>s+b.mass*b.vx,0),energy=balls.reduce((s,b)=>s+.5*b.mass*b.vx*b.vx,0);
 p.step(balls,0,{respawnCue:false,onEvent:e=>events.push(e)});
 assert.ok(balls[1].vx>.5&&balls[2].vx>.5);
 assert.ok(Math.abs(balls.reduce((s,b)=>s+b.mass*b.vx,0)-momentum)<1e-10);
 assert.ok(balls.reduce((s,b)=>s+.5*b.mass*b.vx*b.vx,0)<=energy+1e-10);
 assert.deepEqual(events.map(e=>[e.a,e.b]),[[0,1],[1,2]]);
});
test('a resting or separating contact network gets no invented impulse or contact event',()=>{
 for(const speed of [0,.3]){
  const d=p.TABLE.radius*2+.00001,balls=Array.from({length:3},(_,i)=>({id:i,x:i*d,z:0,vx:i*speed,vz:0})),events=[];
  p.step(balls,0,{respawnCue:false,onEvent:e=>events.push(e)});assert.deepEqual(balls.map(b=>b.vx),[0,speed,2*speed]);assert.equal(events.length,0);
 }
});
test('default full-power break releases the original rack interior over 50 consecutive seeds',()=>{
 const {measure}=require('../scripts/measure-core.cjs');
 for(let seed=1;seed<=50;seed++){
  const c=measure({p,r},seed);assert.ok(c.coreCount<=2,`seed ${seed}: ${c.coreCount} targets trapped in core`);
  assert.ok(c.interiorMinMaxExcursionM>=p.TABLE.radius*4,`seed ${seed}: interior travelled ${c.interiorMinMaxExcursionM}`);
  assert.ok(c.finite&&c.inBounds&&c.settled&&c.seconds<15);
 }
});
test('dense unequal-mass contact networks conserve momentum and never add kinetic energy',()=>{
 let state=19;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
 const total=balls=>balls.reduce((s,b)=>({x:s.x+b.mass*b.vx,z:s.z+b.mass*b.vz,e:s.e+.5*b.mass*(b.vx*b.vx+b.vz*b.vz)}),{x:0,z:0,e:0});
 for(let n=0;n<100;n++){
  const balls=Array.from({length:16},(_,i)=>({id:i,mass:.995+random()*.01,x:(i%4-1.5)*p.TABLE.radius*2,z:(Math.floor(i/4)-1.5)*p.TABLE.radius*2,vx:(random()-.5)*16,vz:(random()-.5)*16}));
  const before=total(balls);p.step(balls,0,{respawnCue:false});const after=total(balls);
  assert.ok(Math.abs(before.x-after.x)<1e-9&&Math.abs(before.z-after.z)<1e-9);
  assert.ok(Number.isFinite(after.e)&&after.e<=before.e+1e-9);
 }
});
