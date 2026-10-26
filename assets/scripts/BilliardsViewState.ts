/** Presentation-only policy. Never mutates a referee, ball or shot command. */
export type ViewMode='overhead'|'first-person';
export interface ViewContext {phase:string;human:boolean;canAim:boolean;paused:boolean;blocked:boolean;tipOpen:boolean;shotActive:boolean;committed:boolean;}
export const VIEW_KEY='eight-club.view.v1';
interface Storage {getItem(k:string):string|null;setItem(k:string,v:string):void;}
export class ViewPreferenceStore {
    mode:ViewMode='overhead';seen=false;persistent=true;
    constructor(private storage?:Storage){try{const d=JSON.parse(storage?.getItem(VIEW_KEY)??'null');if(d?.version===1&&(d.mode==='overhead'||d.mode==='first-person'))this.mode=d.mode;if(d?.version===1&&typeof d.seen==='boolean')this.seen=d.seen;}catch{this.persistent=false;}}
    markSeen():void{this.seen=true;this.set(this.mode);}
    set(mode:ViewMode):void{this.mode=mode;try{this.storage?.setItem(VIEW_KEY,JSON.stringify({version:1,mode,seen:this.seen}));}catch{this.persistent=false;}}
}
export class ViewState {
    mode:ViewMode='overhead';target:ViewMode='overhead';reason='';transitionMs=0;shotLocked=false;returnedDuringShot=false;enabled=true;
    constructor(readonly preference=new ViewPreferenceStore()){}
    get transitioning():boolean{return this.transitionMs>0;}
    get fade():number{return this.transitionMs?1-Math.abs(this.transitionMs-140)/140:0;}
    maySwitch(c:ViewContext):boolean{return this.enabled&&c.phase!=='placing';}
    request(c:ViewContext,reduced=false):boolean {
        if(!this.maySwitch(c))return false;
        // A second tap reverses the pending transition; no gameplay permission is changed.
        const next=this.target==='overhead'?'first-person':'overhead';
        this.preference.set(next);this.to(next,reduced||c.paused||c.blocked||c.tipOpen||c.shotActive);return true;
    }
    to(mode:ViewMode,reduced=false):void {if(mode===this.target&&this.transitioning||mode===this.mode&&!this.transitioning)return;this.target=mode;if(reduced){this.mode=mode;this.transitionMs=0;}else this.transitionMs=280;}
    update(c:ViewContext,dt:number,reduced=false):void {
        const forced=!this.enabled?'disabled':c.phase==='placing'?'placement':'';
        this.reason=forced;
        if(forced){this.mode=this.target='overhead';this.transitionMs=0;this.shotLocked=false;return;}
        if(!c.shotActive&&c.phase!=='shooting'){this.shotLocked=false;this.returnedDuringShot=false;}
        this.to(this.preference.mode,reduced||c.paused||c.blocked||c.tipOpen||c.shotActive);
        if(this.transitioning){const before=this.transitionMs;this.transitionMs=Math.max(0,this.transitionMs-Math.max(0,dt)*1000);if(before>=140&&this.transitionMs<=140||this.transitionMs===0)this.mode=this.target;if(reduced){this.mode=this.target;this.transitionMs=0;}}
    }
    lock():void{this.shotLocked=true;this.returnedDuringShot=false;}
    unsafe():void{this.mode=this.target='overhead';this.transitionMs=0;this.reason='unsafe-camera';}
    reset():void{this.mode=this.target='overhead';this.transitionMs=0;this.shotLocked=false;this.returnedDuringShot=false;this.reason='';}
}
