/** Along-the-cue face view: x is right english, y is follow (top). */
export interface TipOffset { x: number; y: number; }
export interface SpinMotion { vx: number; vz: number; wx?: number; wy?: number; wz?: number; }
const TIP_CONTACT_FRACTION=0.64;
export const SPIN = { contactFraction:TIP_CONTACT_FRACTION, leverage:2.5*TIP_CONTACT_FRACTION, slidingAcceleration: 1.8, sideDecay: 12, cushionFriction: 0.18 } as const;

export function tipOffset(x: number, y: number): TipOffset | null {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const length=Math.hypot(x,y);
    if(length<0.1)return {x:0,y:0};
    const divisor=Math.max(1,length);return {x:x/divisor,y:y/divisor};
}
export function tipLabel(tip: Readonly<TipOffset>): string {
    const parts=[];
    if(Math.abs(tip.y)>=.005)parts.push(`${tip.y>0?'高杆':'低杆'} ${Math.round(Math.abs(tip.y)*100)}%`);
    if(Math.abs(tip.x)>=.005)parts.push(`${tip.x>0?'右塞':'左塞'} ${Math.round(Math.abs(tip.x)*100)}%`);
    return parts.join(' · ') || '中杆';
}
export class TipSelection {
    active=false;
    private current: Readonly<TipOffset>=Object.freeze({x:0,y:0});
    draft: TipOffset={x:0,y:0};
    get value(): Readonly<TipOffset> { return this.current; }
    open():void { this.draft={...this.current};this.active=true; }
    select(x:number,y:number):void { const value=tipOffset(x,y);if(this.active&&value)this.draft=value; }
    recenter():void { if(this.active)this.draft={x:0,y:0}; }
    confirm():void { if(this.active){this.current=Object.freeze({...this.draft});this.active=false;} }
    cancel():void { this.draft={...this.current};this.active=false; }
    reset():void { this.current=Object.freeze({x:0,y:0});this.draft={x:0,y:0};this.active=false; }
}

export function clearSpin(ball: SpinMotion):void { ball.wx=ball.wy=ball.wz=0; }

/** Equal stroke-energy budget for different offsets. Unit-mass solid sphere: I = 2R²/5. */
export function strikeWithSpin(ball: SpinMotion, dx:number, dz:number, speed:number, tip:TipOffset, radius:number):void {
    const top=SPIN.leverage*tip.y,side=SPIN.leverage*tip.x;
    const translation=speed/Math.sqrt(1+0.4*(top*top+side*side));
    ball.vx=dx*translation;ball.vz=dz*translation;
    ball.wx=dz*translation/radius*top;ball.wz=-dx*translation/radius*top;
    ball.wy=translation/radius*side;
}

/** Cloth impulse opposes contact-point slip v + omega × (0,-R,0). */
export function clothStep(ball:SpinMotion,radius:number,dt:number,rollingDeceleration:number,stop:number):void {
    let wx=ball.wx??0,wz=ball.wz??0;
    const ux=ball.vx+radius*wz,uz=ball.vz-radius*wx,slip=Math.hypot(ux,uz);
    if(slip>1e-7) {
        // The 7/2 effective inverse mass comes from translation plus the solid sphere inertia.
        const impulse=Math.min(slip/3.5,SPIN.slidingAcceleration*dt);
        const dvx=-ux/slip*impulse,dvz=-uz/slip*impulse;
        ball.vx+=dvx;ball.vz+=dvz;wx-=2.5*dvz/radius;wz+=2.5*dvx/radius;
    } else {
        const speed=Math.hypot(ball.vx,ball.vz),next=Math.max(0,speed-rollingDeceleration*dt);
        const scale=speed>0?next/speed:0;ball.vx*=scale;ball.vz*=scale;
        wx=ball.vz/radius;wz=-ball.vx/radius;
    }
    const side=ball.wy??0;
    ball.wy=Math.sign(side)*Math.max(0,Math.abs(side)-SPIN.sideDecay*dt);
    ball.wx=wx;ball.wz=wz;
    if(Math.hypot(ball.vx,ball.vz)<=stop&&Math.hypot(wx,wz)*radius<=stop) {
        ball.vx=ball.vz=0;ball.wx=ball.wz=0;
    }
}

/** Cushion normal impulse plus friction at the side-spin contact point; no jump/throw model. */
export function spinCushion(ball:SpinMotion,nx:number,nz:number,radius:number,restitution:number):void {
    const normal=ball.vx*nx+ball.vz*nz;
    if(normal<=0)return;
    const normalImpulse=(1+restitution)*normal,tx=-nz,tz=nx;
    const tangent=ball.vx*tx+ball.vz*tz-radius*(ball.wy??0);
    const limit=SPIN.cushionFriction*normalImpulse;
    const impulse=Math.max(-limit,Math.min(limit,-tangent/3.5));
    ball.vx+=-normalImpulse*nx+impulse*tx;ball.vz+=-normalImpulse*nz+impulse*tz;
    ball.wy=(ball.wy??0)-2.5*impulse/radius;
}
