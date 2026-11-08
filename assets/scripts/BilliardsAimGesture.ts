/** Relative, single-owner gestures in logical HUD pixels. */
export class AimGesture {
    axis:'x'|'y'|null=null;private start={x:0,y:0};private last={x:0,y:0};active=false;
    begin(x:number,y:number):void{this.start=this.last={x,y};this.axis=null;this.active=true;}
    move(x:number,y:number,width:number,height:number):{yaw:number;lift:number}{
        if(!this.active||![x,y,width,height].every(Number.isFinite)||width<=0||height<=0)return {yaw:0,lift:0};
        if(!this.axis){const a=Math.abs(x-this.start.x),b=Math.abs(y-this.start.y);if(Math.max(a,b)>=6){if(a>=b*1.3)this.axis='x';else if(b>=a*1.3)this.axis='y';}this.last={x,y};return {yaw:0,lift:0};}
        const dx=x-this.last.x,dy=y-this.last.y;this.last={x,y};
        return {yaw:this.axis==='x'?-dx/width*Math.PI/3:0,lift:this.axis==='y'?-dy/height*.2:0};
    }
    cancel():void{this.active=false;this.axis=null;}
}

export type TouchMode = 'free' | 'top' | 'aim';

/** A single aiming touch owns either angle adjustment or a pull stroke. */
export class PullGesture {
    active = false;
    intent: 'angle' | 'pull' | null = null;
    power = 0;
    waitingForSpace = false;
    origin = {x:0,y:0};
    private last = {x:0,y:0};
    private lastMs = 0;
    private height = 0;
    begin(x:number,y:number,height:number,ms:number):void {
        this.cancel();this.active=true;this.origin=this.last={x,y};this.height=height;this.lastMs=ms;
        this.waitingForSpace=height-y<112;
    }
    move(x:number,y:number,width:number,ms:number):number {
        if(!this.active||![x,y,width,ms].every(Number.isFinite)||width<=0)return 0;
        if(this.waitingForSpace&&y<this.origin.y){
            this.origin={x,y};this.last={x,y};this.lastMs=ms;
            this.waitingForSpace=this.height-y<112;
            return 0;
        }
        const dx=x-this.origin.x,dy=y-this.origin.y;
        if(!this.intent){
            if(Math.abs(dx)>=8&&Math.abs(dx)>Math.abs(dy)*1.3)this.intent='angle';
            else if(!this.waitingForSpace&&dy>=8&&dy>Math.abs(dx)*1.3)this.intent='pull';
            else return 0;
        }
        if(this.intent==='pull'){
            this.power=4*Math.max(0,Math.min(1,(dy-4)/92))**1.6;
            return 0;
        }
        const delta=x-this.last.x,elapsed=Math.max(8,ms-this.lastMs);
        const speed=Math.min(1,Math.abs(delta)/elapsed);
        this.last={x,y};this.lastMs=ms;
        return -delta/width*Math.PI/3*(.2+.8*speed);
    }
    cancel():void {this.active=false;this.intent=null;this.power=0;this.waitingForSpace=false;}
}
