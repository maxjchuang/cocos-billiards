import { AudioClip, AudioSource, Node, resources } from 'cc';
import { GameSettings } from './BilliardsSettings';
import { AUDIO_ASSETS,AUDIO_VOICES,SoundKind,SoundQueue,soundVolume } from './BilliardsAudio';
export type {SoundKind} from './BilliardsAudio';
/** Packed Scheme A clips, bounded independent voices; pause/mute clears all pending output. */
export class Feedback {
    private sources=new Map<SoundKind,AudioSource>();
    private voices=new Map<SoundKind,AudioSource[]>();private clips=new Map<SoundKind,AudioClip[]>();
    private variants=new Map<SoundKind,number>();private queue=new SoundQueue();private last=new Map<string,number>();
    private busyUntil=new Map<AudioSource,number>();
    private applauseAt:number|null=null;
    unlocked=false;available=0;events:{kind:string;time:number;volume?:number;variant?:number;speed?:number}[]=[];
    constructor(parent:Node,private options:()=>GameSettings){
        for(const kind of Object.keys(AUDIO_ASSETS) as SoundKind[]){
            const voices:AudioSource[]=[];this.voices.set(kind,voices);this.clips.set(kind,[]);
            for(let i=0;i<AUDIO_VOICES[kind];i++){const node=new Node('Feedback '+kind+' '+i);parent.addChild(node);const source=node.addComponent(AudioSource);source.playOnAwake=false;voices.push(source);}
            this.sources.set(kind,voices[0]);
            AUDIO_ASSETS[kind].forEach((name,index)=>resources.load('audio/'+name,AudioClip,(error,clip)=>{
                if(error||!parent.isValid)return;
                this.clips.get(kind)![index]=clip;this.available++;
                for(const source of voices)if(!source.clip)source.clip=clip;
            }));
        }
    }
    unlock():void{if(this.unlocked)return;this.unlocked=true;
        for(const sources of Array.from(this.voices.values()))for(const source of sources)if(source.clip){
            try{source.volume=0;source.play();source.stop();}catch{/* Playback support never blocks touch. */}
            finally{source.volume=1;}
        }}
    enqueue(kind:'collision'|'cushion'|'pocket',speed:number,key:string):void {
        if(this.options().sound&&this.unlocked)this.queue.add(kind,speed,key);
    }
    flush():void {
        if(!this.options().sound||!this.unlocked){this.queue.clear();this.applauseAt=null;return;}
        for(const request of this.queue.drain(Date.now()))this.play(request.kind,request.speed);
        if(this.applauseAt!==null&&Date.now()>=this.applauseAt){this.applauseAt=null;this.play('applause');}
    }
    celebrate():void {if(this.options().sound&&this.unlocked&&this.applauseAt===null)this.applauseAt=Date.now()+350;}
    play(kind:SoundKind,speed=2):void{
        if(!this.options().sound||!this.unlocked)return;
        const volume=soundVolume(kind,speed);if(!volume)return;
        const sources=this.voices.get(kind),clips=this.clips.get(kind);if(!sources||!clips)return;
        // Never stop/restart an active impact: a busy pool drops the new request.
        const now=Date.now(),source=sources.find(s=>(this.busyUntil.get(s)??0)<=now);if(!source)return;
        const loaded=clips.filter(Boolean);if(!loaded.length)return;
        const turn=this.variants.get(kind)??0;
        const variant=kind==='strike'?Math.min(loaded.length-1,Math.floor(speed/3)):turn%loaded.length;
        let activeVolume=0;for(const group of Array.from(this.voices.values()))for(const s of group)if((this.busyUntil.get(s)??0)>now)activeVolume+=s.volume;
        const gain=Math.min(volume,Math.max(0,.9-activeVolume));if(gain<.015)return;
        try{source.clip=loaded[variant];source.volume=gain;source.play();this.busyUntil.set(source,now+Math.max(20,source.clip.getDuration()*1000));this.variants.set(kind,turn+1);this.record(kind,now,gain,variant,speed);}catch{/* Optional output. */}
    }
    haptic():void{
        if(!this.options().haptics||Date.now()-(this.last.get('haptic')??0)<80)return;
        this.last.set('haptic',Date.now());
        try{
            const platform=globalThis as unknown as {wx?:{vibrateShort:(o:{type:string;fail:()=>void})=>void};navigator?:{vibrate?:(ms:number)=>boolean}};
            if(platform.wx?.vibrateShort)platform.wx.vibrateShort({type:'light',fail:()=>{}});
            else platform.navigator?.vibrate?.(12);
            this.record('haptic',Date.now());
        }catch{/* Lack of vibration does not affect gameplay. */}
    }
    stop():void{this.queue.clear();this.busyUntil.clear();this.applauseAt=null;for(const group of Array.from(this.voices.values()))for(const source of group)try{source.stop();}catch{/* Optional output. */}}
    private record(kind:string,time:number,volume?:number,variant?:number,speed?:number):void{this.events.push({kind,time,volume,variant,speed});if(this.events.length>160)this.events.shift();}
}
