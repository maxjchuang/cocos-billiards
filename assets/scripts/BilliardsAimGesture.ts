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
