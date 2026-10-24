import {BallState,FIXED_STEP,isMoving,step,strike,TABLE} from './BilliardsPhysics';
import {POCKETS,traceTable} from './BilliardsTableGeometry';
import {Referee,Group,groupOf,remaining,validCuePosition} from './BilliardsRules';
import {powerToSpeed} from './BilliardsShot';
import {AIDifficulty} from './BilliardsPractice';
import {TipOffset} from './BilliardsSpin';
export interface AICandidate {direction:{x:number;z:number};power:number;tip:TipOffset;group:Group|null;target:number;kind:'pot'|'bank'|'safety'|'break';prior:number;}
export interface AIDecision extends AICandidate {difficulty:AIDifficulty;seed:number;score:number;trials:number;fallback:boolean;}
export const AI_LEVELS=Object.freeze({
 easy:{trials:10,angleError:.85*Math.PI/180,powerError:.09,positionWeight:.05,defenseWeight:.05,banks:false,tips:false,deadlineMs:1600,minThinkMs:650},
 standard:{trials:26,angleError:.22*Math.PI/180,powerError:.035,positionWeight:.45,defenseWeight:.4,banks:false,tips:true,deadlineMs:2600,minThinkMs:850},
 hard:{trials:52,angleError:.04*Math.PI/180,powerError:.008,positionWeight:.9,defenseWeight:.9,banks:true,tips:true,deadlineMs:4200,minThinkMs:1050},
});
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const direction=(x:number,z:number)=>{const n=Math.hypot(x,z);return {x:x/n,z:z/n};};
export function legalAITargets(balls:readonly BallState[],ref:Referee):BallState[]{
 const group=ref.groups[ref.current],eight=group&&remaining(balls,group).length===0;
 return balls.filter(b=>!b.pocketed&&b.id!==0&&(ref.isBreak?true:eight?b.id===8:group?groupOf(b.id)===group:b.id!==8));
}
function clearSegment(balls:readonly BallState[],a:{x:number;z:number},b:{x:number;z:number},exclude:readonly number[]):boolean {
 const dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz;if(d<1e-12)return false;
 return balls.every(q=>{if(q.pocketed||exclude.includes(q.id))return true;const t=clamp(((q.x-a.x)*dx+(q.z-a.z)*dz)/d,0,1);return Math.hypot(q.x-a.x-t*dx,q.z-a.z-t*dz)>=2*TABLE.radius+.0001;});
}
function routes(balls:readonly BallState[],ref:Referee):AICandidate[]{
 const cue=balls.find(b=>b.id===0);if(!cue||cue.pocketed)return [];const out:AICandidate[]=[];
 for(const target of legalAITargets(balls,ref))for(const pocket of POCKETS){
  const object=direction(pocket.x-target.x,pocket.z-target.z);let ghost={x:target.x-object.x*2*TABLE.radius,z:target.z-object.z*2*TABLE.radius},aim=direction(ghost.x-cue.x,ghost.z-cue.z);
  // Ball-ball tangential friction throws a cut toward the incoming cue direction.
  // A rigid-sphere estimate seeds the inverse aim; full material trials still decide.
  for(let n=0;n<3;n++){const cos=aim.x*object.x+aim.z*object.z,sin=Math.sqrt(Math.max(0,1-cos*cos));if(cos<=.1||sin<1e-5)break;const ratio=Math.min(.05,sin/(3.5*(1+TABLE.ballRestitution)*cos)),tx=(aim.x-cos*object.x)/sin,tz=(aim.z-cos*object.z)/sin,normal=direction(object.x-ratio*tx,object.z-ratio*tz);ghost={x:target.x-normal.x*2*TABLE.radius,z:target.z-normal.z*2*TABLE.radius};aim=direction(ghost.x-cue.x,ghost.z-cue.z);}
  const d=Math.hypot(ghost.x-cue.x,ghost.z-cue.z);if(d<.001)continue;
  const cos=aim.x*object.x+aim.z*object.z,objectDistance=Math.hypot(target.x-pocket.x,target.z-pocket.z);
  const edge=traceTable(target,object.x,object.z);
  if(cos<.2||edge?.kind!=='pocket'||!clearSegment(balls,cue,ghost,[0,target.id])||!clearSegment(balls,target,pocket,[0,target.id]))continue;
  const power=clamp(.8+.38*d+.45*objectDistance/Math.max(.35,cos),.8,3.2);
  out.push({direction:aim,power,tip:{x:0,y:0},group:ref.groups[ref.current]??groupOf(target.id),target:target.id,kind:'pot',prior:200+100*cos-16*(d+objectDistance)});
 }
 return out.sort((a,b)=>b.prior-a.prior||a.target-b.target);
}
function bankRoutes(balls:readonly BallState[],ref:Referee,objectPots:boolean):AICandidate[]{
 const cue=balls.find(b=>b.id===0)!;const out:AICandidate[]=[],x=TABLE.halfWidth-TABLE.radius,z=TABLE.halfLength-TABLE.radius;
 const targets=legalAITargets(balls,ref);
 for(const target of targets){
  const goals:{x:number;z:number;pot:boolean}[]=[{x:target.x,z:target.z,pot:false}];
  if(objectPots)for(const pocket of POCKETS){const d=direction(pocket.x-target.x,pocket.z-target.z);if(traceTable(target,d.x,d.z)?.kind==='pocket'&&clearSegment(balls,target,pocket,[0,target.id]))goals.push({x:target.x-d.x*2*TABLE.radius,z:target.z-d.z*2*TABLE.radius,pot:true});}
  for(const goal of goals)for(const [axis,wall] of [['x',x],['x',-x],['z',z],['z',-z]] as const){
   const mirror={...goal,[axis]:2*wall-goal[axis]},aim=direction(mirror.x-cue.x,mirror.z-cue.z),t=(wall-cue[axis])/aim[axis];if(!Number.isFinite(t)||t<=.02)continue;
   const bounce={x:cue.x+aim.x*t,z:cue.z+aim.z*t},hit=traceTable(cue,aim.x,aim.z);
   if(!hit||hit.kind!=='cushion'||Math.abs(hit.distance-t)>.004||!clearSegment(balls,cue,bounce,[0])||!clearSegment(balls,bounce,goal,[0,target.id]))continue;
   out.push({direction:aim,power:2.4,tip:{x:0,y:0},group:ref.groups[ref.current]??groupOf(target.id),target:target.id,kind:goal.pot?'bank':'safety',prior:goal.pot?120:15-t});
  }
 }
 return out.sort((a,b)=>b.prior-a.prior);
}
export function generateAICandidates(balls:readonly BallState[],ref:Referee,difficulty:AIDifficulty):AICandidate[]{
 const cue=balls.find(b=>b.id===0),targets=legalAITargets(balls,ref),level=AI_LEVELS[difficulty];if(!cue||cue.pocketed||!targets.length||ref.phase!=='ready'||isMoving(balls))return [];
 if(ref.isBreak){const apex=targets.slice().sort((a,b)=>Math.hypot(a.x-cue.x,a.z-cue.z)-Math.hypot(b.x-cue.x,b.z-cue.z))[0];return [0,.002,-.002].map(offset=>({direction:direction(apex.x-cue.x+offset,apex.z-cue.z),power:4,tip:{x:0,y:0},group:null,target:apex.id,kind:'break' as const,prior:100}));}
 const pots=routes(balls,ref),safety:AICandidate[]=[];
 for(const target of targets)if(clearSegment(balls,cue,target,[0,target.id]))safety.push({direction:direction(target.x-cue.x,target.z-cue.z),power:2.4,tip:{x:0,y:0},group:ref.groups[ref.current]??groupOf(target.id),target:target.id,kind:'safety',prior:20-Math.hypot(target.x-cue.x,target.z-cue.z)});
 const banks=bankRoutes(balls,ref,level.banks),bases=[...pots,...banks.filter(c=>c.kind==='bank'),...safety,...banks.filter(c=>c.kind==='safety')];
 const out:AICandidate[]=[],seen=new Set<string>(),add=(c:AICandidate)=>{const k=[c.direction.x.toFixed(5),c.direction.z.toFixed(5),c.power.toFixed(2),c.tip.y].join(':');if(!seen.has(k)){seen.add(k);out.push(c);}};
 // Consider varied routes before refinements; retain a few safe contacts when direct pots exist.
 for(const c of bases.slice(0,Math.max(4,Math.floor(level.trials*.55))))add(c);
 for(const c of safety.slice(0,2))add(c);
 for(const c of bases)for(const variation of [{power:.8,angle:0,tip:0},{power:1.25,angle:0,tip:0},{power:1,angle:.006,tip:0},{power:1,angle:-.006,tip:0},...(level.tips?[{power:1,angle:0,tip:.45},{power:1,angle:0,tip:-.45}]:[])]){
  const a=Math.atan2(c.direction.x,c.direction.z)+variation.angle;add({...c,direction:{x:Math.sin(a),z:Math.cos(a)},power:clamp(c.power*variation.power,.4,4),tip:{x:0,y:variation.tip}});
 }
 // A snookered board can have no clear geometric contact. Sample kicks and let the referee judge.
 if(out.length===0)for(let i=0;i<24;i++){const a=i*Math.PI/12;add({direction:{x:Math.sin(a),z:Math.cos(a)},power:2.4,tip:{x:0,y:0},group:ref.groups[ref.current]??groupOf(targets[0].id),target:targets[0].id,kind:'safety',prior:0});}
 return out.slice(0,level.trials);
}
export function chooseAIPlacement(balls:readonly BallState[],ref:Referee,difficulty:AIDifficulty):{x:number;z:number}|null {
 const head=ref.hand==='head',targets=legalAITargets(balls,ref),spots:{x:number;z:number}[]=[];
 for(const target of targets)for(const pocket of POCKETS){const d=direction(pocket.x-target.x,pocket.z-target.z);for(const distance of [.22,.4])spots.push({x:target.x-d.x*distance,z:target.z-d.z*distance});}
 for(const z of head?[.8,1,1.15]:[.8,.4,0,-.4,-.8,1.1,-1.1])for(const x of [0,-.25,.25,-.48,.48])spots.push({x,z});
 let best:null|{x:number;z:number}=null,bestScore=-Infinity,checked=0;const limit=difficulty==='easy'?6:difficulty==='standard'?20:48;
 for(const spot of spots){if(!validCuePosition(balls,spot.x,spot.z,head))continue;const copy=balls.map(b=>b.id===0?{...b,...spot,pocketed:false}:{...b}),quality=routes(copy,ref)[0]?.prior??-100;
  if(quality>bestScore){bestScore=quality;best=spot;}if(++checked>=limit)break;
 }
 if(best)return {...best};
 for(let z=head?HEAD_PLACEMENT_MIN:-1.1;z<=1.15;z+=.1)for(let x=-.5;x<=.5;x+=.1)if(validCuePosition(balls,x,z,head))return {x,z};return null;
}
const HEAD_PLACEMENT_MIN=.7;
interface TrialResult {score:number;foul:boolean;potted:number;winner:number|null;complete:boolean;}
class AITrial {
 balls:BallState[];ref:Referee;steps=0;done=false;private player:0|1;private fouls:number;private before:Set<number>;private contactQuality=0;
 constructor(balls:readonly BallState[],ref:Referee,readonly candidate:AICandidate,private difficulty:AIDifficulty){
  this.balls=balls.map(b=>({...b}));this.ref=ref.cloneForSimulation();this.player=ref.current;this.fouls=ref.foulCount[this.player];this.before=new Set(balls.filter(b=>!b.pocketed&&b.id!==0&&groupOf(b.id)===(ref.groups[ref.current]??candidate.group)).map(b=>b.id));
  if(candidate.group)this.ref.select(candidate.group);
  if(!this.ref.beginShot(this.balls)||!strike(this.balls,candidate.direction.x,candidate.direction.z,powerToSpeed(candidate.power),candidate.tip))this.done=true;
 }
 step():void {if(this.done)return;try{step(this.balls,FIXED_STEP,{respawnCue:false,onEvent:e=>{if(e.type==='contact'&&this.ref.shot?.first===null&&(e.a===0||e.b===0)){const cue=this.balls.find(b=>b.id===0)!;this.contactQuality=Math.min(1,(e.speed??0)/Math.max(.01,Math.hypot(cue.vx,cue.vz)));}this.ref.observe(e,this.balls);}});this.ref.trackCue(this.balls);this.steps++;if(!isMoving(this.balls)){this.ref.finishShot(this.balls);this.done=true;}else if(this.steps>=28800)this.done=true;}catch{this.done=true;}}
 result():TrialResult {
  const complete=this.steps>0&&this.ref.phase!=='shooting',foul=this.ref.foulCount[this.player]>this.fouls,potted=this.balls.filter(b=>this.before.has(b.id)&&b.pocketed).length;
  if(!complete)return {score:-2e6,foul:true,potted:0,winner:null,complete:false};
  let score=this.ref.winner===this.player?1e6:this.ref.winner!==null?-1e6:foul?-10000:0;
  if(this.balls[0].pocketed)score-=5000;
  if(!foul&&this.ref.winner===null){
   score+=potted*1200+(this.ref.current===this.player?150:0)+100*this.contactQuality;
   if(!potted&&this.candidate.kind==='bank')score-=80;
   const level=AI_LEVELS[this.difficulty],own=this.ref.cloneForSimulation();own.current=this.player;own.phase='ready';
   score+=level.positionWeight*(routes(this.balls,own)[0]?.prior??0);
   if(this.ref.current!==this.player){const opponent=this.ref.cloneForSimulation();opponent.phase='ready';score-=level.defenseWeight*(routes(this.balls,opponent)[0]?.prior??0);}
  }
  return {score,foul,potted,winner:this.ref.winner,complete};
 }
}
export class AIPlanner {
 readonly candidates:AICandidate[];readonly reports:{index:number;kind:string;target:number;score:number;foul:boolean;potted:number;complete:boolean}[]=[];
 private trial:AITrial|null=null;private best:AICandidate|null=null;private bestScore=-Infinity;private index=0;private frozen:AIDecision|null=null;
 get done():boolean{return this.index>=this.candidates.length;}
 constructor(private balls:readonly BallState[],private ref:Referee,readonly difficulty:AIDifficulty,readonly seed=1){this.balls=balls.map(b=>({...b}));this.ref=ref.cloneForSimulation();this.candidates=generateAICandidates(this.balls,this.ref,difficulty);}
 advance(count=1):void {
  for(let i=0;i<count&&!this.done;i++){
   if(!this.trial)this.trial=new AITrial(this.balls,this.ref,this.candidates[this.index],this.difficulty);
   this.trial.step();if(!this.trial.done)continue;
   const result=this.trial.result(),candidate=this.candidates[this.index];this.reports.push({index:this.index,kind:candidate.kind,target:candidate.target,...result});
   if(result.complete&&result.score>this.bestScore){this.bestScore=result.score;this.best=candidate;}
   this.trial=null;this.index++;
  }
 }
 decision():AIDecision|null {
  if(this.frozen)return this.frozen;const base=this.best??this.candidates[0];if(!base)return null;
  let n=(this.seed>>>0)||1;const noise=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296*2-1;},level=AI_LEVELS[this.difficulty],angle=Math.atan2(base.direction.x,base.direction.z)+noise()*level.angleError;
  this.frozen=Object.freeze({...base,direction:Object.freeze({x:Math.sin(angle),z:Math.cos(angle)}),tip:Object.freeze({...base.tip}),power:clamp(base.power*(1+noise()*level.powerError),.4,4),difficulty:this.difficulty,seed:this.seed,score:this.bestScore,trials:this.reports.length,fallback:!this.best});return this.frozen;
 }
}
/** No timers or promises: cancellation drops all work; a locked command survives a pause. */
export class AITurn {
 planner:AIPlanner|null=null;locked:AIDecision|null=null;elapsedMs=0;generation=0;
 begin(balls:readonly BallState[],ref:Referee,difficulty:AIDifficulty,seed:number):void {this.cancel();this.planner=new AIPlanner(balls,ref,difficulty,seed);}
 clock(ms:number):void {if(this.planner){this.elapsedMs+=Math.max(0,ms);if(!this.locked&&this.elapsedMs>=AI_LEVELS[this.planner.difficulty].deadlineMs)this.lock();}}
 work(count=1):void {if(!this.planner||this.locked)return;this.planner.advance(count);if(this.planner.done)this.lock();}
 private lock():void {this.locked=this.planner?.decision()??null;}
 pause():void {if(!this.locked)this.cancel();}
 cancel():void {this.generation++;this.planner=null;this.locked=null;this.elapsedMs=0;}
}
