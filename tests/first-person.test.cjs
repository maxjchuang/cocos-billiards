const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.dirname(process.env.BILLIARDS_TEST_MODULE),M=require(path.join(dir,'BilliardsCameraMath.js')),V=require(path.join(dir,'BilliardsViewState.js')),A=require(path.join(dir,'BilliardsAimGesture.js'));
const P=require(process.env.BILLIARDS_TEST_MODULE),R=require(process.env.BILLIARDS_RULES_MODULE),S=require(path.join(dir,'BilliardsShot.js')),G=require(path.join(dir,'BilliardsTableGeometry.js'));
const F=require('../scripts/first-person-fixtures.cjs').firstPersonFixtures(P,G);
const context=(extra={})=>({phase:'ready',human:true,canAim:true,paused:false,blocked:false,tipOpen:false,shotActive:false,committed:false,...extra});
test('only placement forces overhead; observation is independent of gameplay permission',()=>{
 const mem={value:null,getItem(){return this.value},setItem(k,v){this.value=v}},store=new V.ViewPreferenceStore(mem),view=new V.ViewState(store);
 assert.equal(store.mode,'overhead');view.request(context(),true);
 view.update(context({phase:'placing',canAim:false}),.016);assert.equal(view.mode,'overhead');assert.equal(store.mode,'first-person');assert.equal(view.request(context({phase:'placing'}),true),false);
 for(const c of [context({human:false}),context({phase:'over',paused:true,canAim:false}),context({phase:'choice',paused:true}),context({canAim:false}),context({tipOpen:true}),context({phase:'shooting',shotActive:true,committed:false}),context({phase:'shooting',committed:true})]){
  view.update(c,.3,true);assert.equal(view.mode,'first-person');assert.ok(view.request(c,true));assert.equal(view.mode,'overhead');assert.ok(view.request(c,true));assert.equal(view.mode,'first-person');
 }
 assert.equal(new V.ViewPreferenceStore(mem).mode,'first-person');
 const broken=new V.ViewPreferenceStore({getItem(){throw Error()},setItem(){throw Error()}});broken.set('first-person');assert.equal(broken.persistent,false);assert.equal(broken.mode,'first-person');
});
test('viewing either way during a shot preserves its lock and remembers explicit preference',()=>{
 const v=new V.ViewState();v.request(context(),true);v.lock();const moving=context({phase:'shooting',committed:true});v.update(moving,2);assert.ok(v.shotLocked);
 assert.ok(v.request(moving,true));assert.equal(v.mode,'overhead');assert.equal(v.preference.mode,'overhead');assert.ok(v.request(moving,true));assert.equal(v.mode,'first-person');assert.ok(v.shotLocked);
 v.update(context(),.3,true);assert.equal(v.shotLocked,false);
});
test('repeated taps reverse a view transition without touching gameplay',()=>{
 const v=new V.ViewState();v.request(context());assert.ok(v.transitioning);assert.ok(v.request(context()));assert.equal(v.target,'overhead');v.update(context(),.3);assert.equal(v.mode,'overhead');v.reset();v.update(context({phase:'placing'}),1);assert.equal(v.transitionMs,0);
});
test('axis ownership suppresses deadzone, diagonal ambiguity and first-event jumps',()=>{
 const a=new A.AimGesture();a.begin(0,0);assert.deepEqual(a.move(4,4,300,500),{yaw:0,lift:0});assert.deepEqual(a.move(10,10,300,500),{yaw:0,lift:0});a.move(20,10,300,500);assert.equal(a.axis,'x');let d=a.move(30,80,300,500);assert.notEqual(d.yaw,0);assert.equal(d.lift,0);a.cancel();assert.deepEqual(a.move(50,80,300,500),{yaw:0,lift:0});
 a.begin(300,200);a.move(300,190,300,500);d=a.move(100,150,300,500);assert.equal(d.yaw,0);assert.ok(d.lift>0);
});
for(const fixture of F.safety)test('camera remains available '+fixture.id,()=>{
 assert.ok(G.validTablePlacement(fixture.cue));for(const height of [.15,.25]){const p=M.solveCamera(fixture.cue,fixture.direction,height);assert.ok(Object.values(p.position).every(Number.isFinite));assert.ok(p.safe);if(p.safe){assert.ok(M.poseIsSafe(p,fixture.cue));const cue=M.cameraProjection(p,{...fixture.cue,y:P.TABLE.radius},353/500);assert.ok(cue.visible);assert.ok(cue.y<0);}else assert.equal(p.reason,'blocked');}
});
test('view mesh normals and triangle orientation agree, including concave extruded sides',()=>{
 const {prism}=require(path.join(dir,'BilliardsViewGeometry.js')),m=prism([{x:0,z:0},{x:1,z:0},{x:1,z:1},{x:.4,z:.5},{x:0,z:1}],.038,0);
 for(let i=0;i<m.indices.length;i+=3){const [a,b,c]=m.indices.slice(i,i+3).map(j=>m.positions.slice(j*3,j*3+3)),u=b.map((v,k)=>v-a[k]),v=c.map((t,k)=>t-a[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],normal=m.normals.slice(m.indices[i]*3,m.indices[i]*3+3);assert.ok(n.reduce((s,x,k)=>s+x*normal[k],0)>0);}
});
for(const f of F.shots)test('view-independent real simulation '+f.id+' '+f.name,()=>{
 const run=(orbit)=>{const balls=JSON.parse(JSON.stringify(f.balls)),ref=new R.Referee();ref.phase='ready';ref.isBreak=false;ref.groups=['solid','stripe'];ref.selected='solid';
  const sequence=new S.ShotSequence();sequence.begin({gameId:1,player:0,...f.command,selectedGroup:'solid'});const events=[];
  if(orbit)for(let i=0;i<10;i++)M.solveCamera(balls[0],f.command.direction,.15+i*.01);
  assert.ok(sequence.advance(.22,s=>S.commitShot(s,1,balls,ref)));
  let count=0;while(P.isMoving(balls)&&count++<28800)P.step(balls,P.FIXED_STEP,{respawnCue:false,onEvent:e=>{ref.observe(e,balls);events.push(e);}});
  assert.ok(count<28800);ref.finishShot(balls);return {balls,events,winner:ref.winner,message:ref.message};};
 const a=run(false),b=run(true);assert.deepEqual(a,b);if(f.expected==='scratch')assert.ok(a.balls[0].pocketed);else if(f.expected==='pot')assert.ok(a.balls[1].pocketed);else if(f.expected==='win')assert.equal(a.winner,0);else if(f.expected==='early-eight')assert.equal(a.winner,1);else if(f.expected==='cushion')assert.ok(a.events.some(e=>e.type==='cushion'));else if(f.expected==='contact')assert.ok(a.events.some(e=>e.type==='contact'&&(e.a===0||e.b===0)));else if(f.expected==='miss')assert.equal(a.events.some(e=>e.type==='contact'),false);
});
test('render openings remove actual surface area and ribbons face the +Y camera',()=>{
 const {subtractOpenings,prism,ribbon,emptyMesh}=require(path.join(dir,'BilliardsViewGeometry.js'));
 const outer=[{x:0,z:0},{x:2,z:0},{x:2,z:2},{x:0,z:2}],hole=[{x:.5,z:.5},{x:1.5,z:.5},{x:1.5,z:1.5},{x:.5,z:1.5}],pieces=subtractOpenings([outer],[hole]);
 let area=0;for(const p of pieces){const mesh=prism(p,0);for(let i=0;i<mesh.indices.length;i+=3){const t=mesh.indices.slice(i,i+3).map(k=>({x:mesh.positions[k*3],z:mesh.positions[k*3+2]})),c={x:t.reduce((s,p)=>s+p.x,0)/3,z:t.reduce((s,p)=>s+p.z,0)/3};assert.equal(M.insidePolygon(c,hole),false);area+=Math.abs((t[1].x-t[0].x)*(t[2].z-t[0].z)-(t[1].z-t[0].z)*(t[2].x-t[0].x))/2;}}
 assert.ok(Math.abs(area-3)<1e-8);const m=emptyMesh();ribbon(m,{x:0,z:1},{x:0,z:0},.003);const [a,b,c]=m.indices.slice(0,3).map(i=>m.positions.slice(i*3,i*3+3));const y=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);assert.ok(y>0);
});
test('paused result and break-choice views keep the selected mode',()=>{
 for(const phase of ['over','choice']){const v=new V.ViewState();v.request(context(),true);v.update(context({phase,paused:true,canAim:false}),.016);assert.equal(v.mode,'first-person');assert.ok(v.request(context({phase,paused:true}),true));assert.equal(v.mode,'overhead');}
});
test('display cue lift is local to obstructed geometry',()=>{
 assert.equal(M.cueDisplayPitch({x:0,y:P.TABLE.radius,z:.4},{x:0,z:-1}),0);
 assert.ok(M.cueDisplayPitch({x:.65,y:P.TABLE.radius,z:.3},{x:-1,z:0})>0);
 const {intersectConvex}=require(path.join(dir,'BilliardsViewGeometry.js'));const square=[{x:0,z:0},{x:2,z:0},{x:2,z:2},{x:0,z:2}],box=[{x:1,z:1},{x:3,z:1},{x:3,z:3},{x:1,z:3}];const clipped=intersectConvex(square,box);assert.equal(clipped.length,4);assert.ok(clipped.every(p=>p.x>=1&&p.x<=2&&p.z>=1&&p.z<=2));
});
