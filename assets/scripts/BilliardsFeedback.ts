import { AudioClip, AudioSource, Node, resources } from 'cc';
import { GameSettings } from './BilliardsSettings';
export type SoundKind='strike'|'collision'|'cushion'|'pocket';
/** Local packed audio and optional haptics. Unsupported platform feedback never blocks a shot. */
export class Feedback {
    private sources=new Map<SoundKind,AudioSource>();private last=new Map<string,number>();
    unlocked=false;available=0;events:{kind:string;time:number}[]=[];
    constructor(parent:Node,private options:()=>GameSettings){
        for(const kind of ['strike','collision','cushion','pocket'] as SoundKind[]){
            const node=new Node('Feedback '+kind);parent.addChild(node);const source=node.addComponent(AudioSource);source.playOnAwake=false;this.sources.set(kind,source);
            resources.load('audio/'+kind,AudioClip,(error,clip)=>{if(!error&&node.isValid){source.clip=clip;this.available++;}});
        }
    }
    unlock():void{if(this.unlocked)return;this.unlocked=true;
        for(const source of this.sources.values())if(source.clip){
            try{source.volume=0;source.play();source.stop();}catch{/* Unsupported unlock must not block the touch owner. */}
            finally{source.volume=1;}
        }}
    play(kind:SoundKind):void{
        if(!this.options().sound||!this.unlocked)return;
        const now=Date.now();if(now-(this.last.get(kind)??0)<(kind==='strike'?1:45))return;this.last.set(kind,now);
        const source=this.sources.get(kind);if(!source?.clip)return;
        try{source.stop();source.volume=kind==='collision'?.32:.5;source.play();this.record(kind,now);}catch{/* Unsupported playback remains optional. */}
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
    stop():void{for(const source of this.sources.values())try{source.stop();}catch{/* Optional output. */}}
    private record(kind:string,time:number):void{this.events.push({kind,time});if(this.events.length>40)this.events.shift();}
}
