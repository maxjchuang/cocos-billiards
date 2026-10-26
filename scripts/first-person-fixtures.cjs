// Reproducible shot and camera fixtures. No runtime import by the game.
function firstPersonFixtures(P,G){
 const base=()=>{const balls=P.createRack();for(const b of balls){b.pocketed=true;b.vx=b.vz=b.wx=b.wy=b.wz=0;}return balls;};
 const make=(id,name,setup,command={})=>{const balls=base(),place=(n,x,z)=>Object.assign(balls[n],{x,z,pocketed:false});place(0,0,.65);place(1,0,.1);place(8,-.35,-.8);setup(place,balls);return {id,name,balls,command:{direction:{x:0,z:-1},power:2.4,tipOffset:{x:0,y:0},...command},black:id==='E14',expected:id==='E11'?'scratch':id==='E14'?'win':id==='E15'?'early-eight':id==='E16'?'miss':id==='E12'||id==='E13'?'pot':id==='E08'||id==='E09'||id==='E10'?'cushion':'contact'};};
 const shots=[
 make('E01','straight',()=>{}),make('E02','left cut',p=>p(1,.025,.1)),make('E03','right cut',p=>p(1,-.025,.1)),
 make('E04','long table',p=>{p(0,0,.65);p(1,0,-1.1);},{power:3.4}),make('E05','near ball',p=>p(1,0,.45),{power:1.4}),
 make('E06','follow',()=>{},{tipOffset:{x:0,y:.55}}),make('E07','draw',()=>{},{tipOffset:{x:0,y:-.55}}),
 make('E08','left english bank',(p,b)=>{p(0,0,.3);b[1].pocketed=true;},{direction:{x:1,z:0},tipOffset:{x:-.55,y:0}}),
 make('E09','right english bank',(p,b)=>{p(0,0,.3);b[1].pocketed=true;},{direction:{x:1,z:0},tipOffset:{x:.55,y:0}}),
 make('E10','multiple banks',(p,b)=>{p(0,0,0);b[1].pocketed=true;},{direction:{x:.9,z:-.4358898943540673},power:4}),
 make('E11','cue scratch',(p,b)=>{p(0,.45,0);b[1].pocketed=true;},{direction:{x:1,z:0},power:1.2}),
 ...['corner','side'].map((kind,i)=>{const pocket=G.POCKETS.find(p=>p.kind===kind),d=pocket.normal;return make(i?'E13':'E12',kind+' pot',p=>{p(1,pocket.lip.x-d.x*.2,pocket.lip.z-d.z*.2);p(0,pocket.lip.x-d.x*.65,pocket.lip.z-d.z*.65);p(8,-.35,-.8);},{direction:{...d},power:2});}),
 make('E14','legal black eight',(p,b)=>{b[1].pocketed=true;p(8,.5,0);p(0,.1,0);},{direction:{x:1,z:0},power:1.6,tipOffset:{x:0,y:-.4}}),
 make('E15','early eight',p=>{p(8,.5,0);p(0,.1,0);p(1,-.3,-.7);},{direction:{x:1,z:0},power:1.6}),
 make('E16','weak miss',()=>{},{power:.4})];
 const safety=[];for(const axis of ['x','z'])for(const sign of [-1,1])for(const t of [-.65,-.3,.45]){
  const w=axis==='x'?.63:1.27,other=axis==='x'?'z':'x',cue={[axis]:sign*(w-.028575-.001),[other]:axis==='x'?t:t*.65};if(G.validTablePlacement(cue))safety.push({id:'C'+String(safety.length+1).padStart(2,'0'),cue,direction:{[axis]:sign,[other]:0},kind:'rail'});
 }
 for(const pocket of G.POCKETS)for(const turn of [-.25,.25]){
  let cue;for(const distance of [.14,.18,.22,.28]){const point={x:pocket.lip.x-pocket.normal.x*distance+pocket.tangent.x*turn*.1,z:pocket.lip.z-pocket.normal.z*distance+pocket.tangent.z*turn*.1};if(G.validTablePlacement(point)){cue=point;break;}}
  if(!cue)throw Error('No legal pocket fixture');safety.push({id:'C'+String(safety.length+1).padStart(2,'0'),cue,direction:{x:pocket.normal.x*Math.cos(turn)-pocket.normal.z*Math.sin(turn),z:pocket.normal.x*Math.sin(turn)+pocket.normal.z*Math.cos(turn)},kind:'pocket'});
 }
 const reverse=safety.filter(s=>s.kind==='rail').map(s=>({...s,id:'',kind:'rail-back-cue',direction:{x:-s.direction.x,z:-s.direction.z}}));for(const s of reverse){s.id='C'+String(safety.length+1).padStart(2,'0');safety.push(s);}
 return {version:1,shots,safety};
}
module.exports={firstPersonFixtures};
