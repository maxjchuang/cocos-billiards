/** Sound-only scheduling. It never changes simulation state or consumes rack randomness. */
export type SoundKind='strike'|'collision'|'cushion'|'pocket'|'applause';
export const AUDIO_ASSETS:Readonly<Record<SoundKind,readonly string[]>>={
 strike:['strike','strike-1','strike-2'],collision:['collision','collision-1','collision-2','collision-3'],
 cushion:['cushion','cushion-1','cushion-2'],pocket:['pocket','pocket-1','pocket-2'],applause:['applause'],
};
export const AUDIO_CLIP_COUNT=14;
export const AUDIO_VOICES:Readonly<Record<SoundKind,number>>={strike:2,collision:5,cushion:2,pocket:3,applause:1};
export interface SoundRequest {kind:SoundKind;speed:number;key:string;}
export function soundVolume(kind:SoundKind,speed=2):number {
 if(!Number.isFinite(speed)||speed<0)return 0;
 const t=Math.min(1,Math.sqrt(speed/(kind==='strike'?8:5)));
 if(kind==='applause')return .26;
 if(kind==='pocket')return .18+.12*t;
 if(speed<.035)return 0;
 return kind==='strike'?.09+.34*t:kind==='collision'?.025+.245*t:.025+.21*t;
}
/** Collapse micro-contact chatter by pair; prioritize energetic contacts within each rendered frame. */
export class SoundQueue {
 private pending=new Map<string,SoundRequest>();private last=new Map<string,number>();
 add(kind:'collision'|'cushion'|'pocket',speed:number,key:string):void {
  if(!soundVolume(kind,speed))return;
  const id=kind+':'+key,old=this.pending.get(id);if(!old||speed>old.speed)this.pending.set(id,{kind,speed,key});
 }
 drain(now:number):SoundRequest[]{
  const sorted=Array.from(this.pending.values()).sort((a,b)=>(a.kind==='pocket'?-1:0)-(b.kind==='pocket'?-1:0)||b.speed-a.speed),counts={collision:0,cushion:0,pocket:0},out:SoundRequest[]=[];
  this.pending.clear();
  for(const r of sorted){const kind=r.kind as keyof typeof counts,id=kind+':'+r.key;
   if(counts[kind]>=(kind==='collision'?3:kind==='cushion'?2:3)||now-(this.last.get(id)??-Infinity)<28)continue;
   counts[kind]++;this.last.set(id,now);out.push(r);
  }
  for(const [key,time] of Array.from(this.last.entries()))if(now-time>1000)this.last.delete(key);
  return out;
 }
 clear():void {this.pending.clear();this.last.clear();}
}
