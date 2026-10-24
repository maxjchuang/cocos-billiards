import { BallState,FIXED_STEP,isMoving,step,strike } from './BilliardsPhysics';
import { powerToSpeed } from './BilliardsShot';
import { TipOffset } from './BilliardsSpin';
export interface TrajectoryPoint {x:number;z:number;}
export interface BallTrajectory {id:number;points:TrajectoryPoint[];end:TrajectoryPoint;pocket:number|null;}
export type PredictionStatus='running'|'complete'|'incomplete'|'invalid';
export interface TrajectoryInput {balls:readonly BallState[];dx:number;dz:number;power:number;tip:Readonly<TipOffset>;}
export function trajectoryKey(input:TrajectoryInput):string {
 return JSON.stringify([input.dx,input.dz,input.power,input.tip.x,input.tip.y,input.balls.map(b=>[b.id,b.bodyId,b.mass,b.x,b.z,b.vx,b.vz,b.wx,b.wy,b.wz,!!b.pocketed])]);
}
/** A disposable full-table replay. No referee, audio, randomness or live-ball writes.
 * Uses the exact same fixed step/cloth/spin/contact solver as the real committed shot.
 */
export class ShotPrediction {
 readonly balls:BallState[];readonly cue:BallTrajectory;target:BallTrajectory|null=null;
 status:PredictionStatus='running';steps=0;readonly maxSteps:number;
 private initial=new Map<number,TrajectoryPoint>();
 constructor(input:TrajectoryInput,maxSteps=240*120){
  this.maxSteps=maxSteps;this.balls=input.balls.map(b=>({...b}));
  for(const b of this.balls)this.initial.set(b.id,{x:b.x,z:b.z});
  const cue=this.balls.find(b=>b.id===0);this.cue={id:0,points:cue?[{x:cue.x,z:cue.z}]:[],end:{x:cue?.x??0,z:cue?.z??0},pocket:null};
  if(!cue||![input.dx,input.dz,input.power,input.tip.x,input.tip.y].every(Number.isFinite)||input.power<=0||input.power>4||Math.hypot(input.tip.x,input.tip.y)>1+1e-9||!this.balls.every(b=>[b.x,b.z,b.vx,b.vz,b.wx??0,b.wy??0,b.wz??0,b.mass??1].every(Number.isFinite))||!strike(this.balls,input.dx,input.dz,powerToSpeed(input.power),{...input.tip}))this.status='invalid';
 }
 private sample(path:BallTrajectory,force=false):void {
  const b=this.balls.find(b=>b.id===path.id);if(!b)return;
  path.end={x:b.x,z:b.z};const previous=path.points[path.points.length-1];
  if(!previous||Math.hypot(b.x-previous.x,b.z-previous.z)>=(force?1e-8:.004))path.points.push({...path.end});
 }
 advance(count=1):void {
  for(let n=0;n<count&&this.status==='running';n++){
   try{step(this.balls,FIXED_STEP,{respawnCue:false,onEvent:event=>{
    if(event.type==='contact'&&this.target===null&&(event.a===0||event.b===0)){
     const id=event.a===0?event.b:event.a,start=this.initial.get(id)!;this.target={id,points:[{...start}],end:{...start},pocket:null};
    }
    for(const path of [this.cue,this.target])if(path){
     if(event.type==='pocket'&&event.id===path.id){path.pocket=event.pocket;this.sample(path,true);}
     else if(event.type==='cushion'&&event.id===path.id||event.type==='contact'&&(event.a===path.id||event.b===path.id))this.sample(path,true);
    }
   }});}catch{this.status='invalid';return;}
   this.steps++;this.sample(this.cue);if(this.target)this.sample(this.target);
   if(!isMoving(this.balls)){
    this.sample(this.cue,true);if(this.target)this.sample(this.target,true);this.status='complete';
    this.cue.points=simplifyTrajectory(this.cue.points);if(this.target)this.target.points=simplifyTrajectory(this.target.points);
   }else if(this.steps>=this.maxSteps)this.status='incomplete';
  }
 }
}
/** Iterative RDP with sub-pixel world tolerance; preserves curved rolls and cushion corners. */
export function simplifyTrajectory(points:readonly TrajectoryPoint[],epsilon=.0008):TrajectoryPoint[]{
 if(points.length<=2)return points.map(p=>({...p}));
 const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;const stack=[[0,points.length-1]];
 while(stack.length){const [a,b]=stack.pop()!,A=points[a],B=points[b],dx=B.x-A.x,dz=B.z-A.z,length=dx*dx+dz*dz;let best=epsilon*epsilon,index=-1;
  for(let i=a+1;i<b;i++){const p=points[i],t=length?Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.z-A.z)*dz)/length)):0,d=(p.x-A.x-t*dx)**2+(p.z-A.z-t*dz)**2;if(d>best){best=d;index=i;}}
  if(index>=0){keep[index]=1;stack.push([a,index],[index,b]);}
 }
 return points.filter((_,i)=>!!keep[i]).map(p=>({...p}));
}
