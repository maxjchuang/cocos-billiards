const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {compile}=require('./calibrate-contacts.cjs');
function evaluate(c,fixture,material,step){
 const bodies=fixture.initial.map(b=>({...b})),m={...material,maxStep:step},initial=c.contactSample(bodies,m),speed=Math.max(...bodies.map(b=>Math.hypot(b.vx,b.vz))),momentumScale=bodies.reduce((s,b)=>s+m.baseMassKg*Math.hypot(b.vx,b.vz),0),angularScale=Math.max(1e-12,momentumScale*m.radius);
 let time=0,maxVelocityError=0,maxPositionError=0,maxEnergyExcess=0,maxMomentumError=0,maxAngularError=0;const samples=[],forces=[],onsets=[];
 const monitor=s=>{maxEnergyExcess=Math.max(maxEnergyExcess,(s.kinetic+s.elastic)/(initial.kinetic+initial.elastic)-1);maxMomentumError=Math.max(maxMomentumError,Math.hypot(s.px-initial.px,s.pz-initial.pz)/momentumScale);maxAngularError=Math.max(maxAngularError,Math.abs(s.angularY-initial.angularY)/angularScale);};
 for(const ref of fixture.samples){c.advanceContacts(bodies,ref.time-time,m,{onSample:monitor,onForce:s=>forces.push({...s,time:time+s.time}),onContact:(a,b,t)=>onsets.push({a,b,time:time+t})});time=ref.time;for(let i=0;i<bodies.length;i++){const b=bodies[i],s=ref.states[i];maxVelocityError=Math.max(maxVelocityError,Math.hypot(b.vx-s[2],b.vz-s[3],m.radius*((b.wy??0)-s[4]))/speed);maxPositionError=Math.max(maxPositionError,Math.hypot(b.x-s[0],b.z-s[1]));}samples.push({time,states:bodies.map(b=>[b.x,b.z,b.vx,b.vz,b.wy??0]),...c.contactSample(bodies,m,time)});}
 return {step,maxVelocityError,maxPositionError,maxEnergyExcess,maxMomentumError,maxAngularError,samples,forces,onsets};
}
module.exports={evaluate};
if(require.main===module){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'contact-reference-'));try{
 const {c}=compile(dir),reference=JSON.parse(fs.readFileSync('validation/calibration/independent-reference.json','utf8'));
 const cases=reference.cases.map(f=>{const coarse=evaluate(c,f,reference.material,2e-6),fine=evaluate(c,f,reference.material,1e-6);let delta=0;for(let i=0;i<coarse.samples.length;i++)for(let b=0;b<f.initial.length;b++)delta=Math.max(delta,Math.hypot(coarse.samples[i].states[b][2]-fine.samples[i].states[b][2],coarse.samples[i].states[b][3]-fine.samples[i].states[b][3]));return {name:f.name,coarse,fine,halfStepVelocityDelta:delta};});
 const report={date:'2026-10-24',scope:reference.scope,cases,checks:{independentVelocity:cases.every(c=>c.coarse.maxVelocityError<.01),independentPosition:cases.every(c=>c.coarse.maxPositionError<reference.material.radius*.01),energy:cases.every(c=>c.coarse.maxEnergyExcess<=.001),momentum:cases.every(c=>c.coarse.maxMomentumError<=1e-6&&c.coarse.maxAngularError<=1e-6),halfStep:cases.every(c=>c.halfStepVelocityDelta<.01)}};
 fs.writeFileSync('validation/calibration/numerical.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({cases:cases.map(({samples,coarse,fine,...rest})=>({...rest,coarse:{...coarse,samples:undefined,forces:undefined},fine:{...fine,samples:undefined,forces:undefined}})),checks:report.checks},null,2));
}finally{fs.rmSync(dir,{recursive:true,force:true});}}
