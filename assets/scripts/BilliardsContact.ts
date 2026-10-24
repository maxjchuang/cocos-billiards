/** Free-space XZ contact dynamics. SI units internally, relative ball masses externally.
 * Hertz elastic normal force + restitution damping and dissipative surface friction.
 * Positions retain elastic indentation across calls; no overlap projection is performed.
 * No Cocos, table geometry, stroke noise, or random sampling.
 */
export interface ContactBody {
    id:number; bodyId?:number; mass?:number; pocketed?:boolean;
    x:number;z:number;vx:number;vz:number;wx?:number;wy?:number;wz?:number;
}
export interface ContactMaterial {
    radius:number;baseMassKg:number;youngPa:number;poisson:number;
    restitution:number;friction:number;frictionVelocity:number;
    maxStep:number;dampingScale:number;
}
export const REFERENCE_MATERIAL:Readonly<ContactMaterial>=Object.freeze({
    radius:.028575,baseMassKg:.17,youngPa:3.8e9,poisson:.375,
    restitution:.93,friction:.06,frictionVelocity:.01,maxStep:0.000002,dampingScale:1,
});
export interface ContactSample {time:number;kinetic:number;elastic:number;px:number;pz:number;angularY:number;maxIndentation:number;}
export interface ContactBoundary {time:number;apply:()=>void;}
export interface ContactOptions {
    nextBoundary?:(balls:readonly ContactBody[],remaining:number)=>ContactBoundary|null;
    onContact?:(a:number,b:number,time:number)=>void;
    onSample?:(sample:ContactSample)=>void;
    /** Optional audit of the actual half-kick force and its integration weight. */
    onForce?:(sample:{time:number;a:number;b:number;indentation:number;normal:number;tangent:number;weight:number;impulseX:number;impulseZ:number})=>void;
}
export interface ContactAdvance {time:number;microSteps:number;freeFlights:number;contactStarts:number;maxIndentation:number;}
const inverse=(b:ContactBody,m:ContactMaterial)=>1/(m.baseMassKg*(Number.isFinite(b.mass)&&b.mass!>0?b.mass!:1));
export function hertzStiffness(m:ContactMaterial):number {
    return 4/3/(2*(1-m.poisson*m.poisson)/m.youngPa)*Math.sqrt(m.radius/2);
}
export function contactSample(balls:readonly ContactBody[],m:ContactMaterial,time=0):ContactSample {
    let kinetic=0,elastic=0,px=0,pz=0,angularY=0,maxIndentation=0;const k=hertzStiffness(m);
    for(const b of balls){if(b.pocketed)continue;const mass=1/inverse(b,m),i=.4*mass*m.radius*m.radius;
        kinetic+=.5*mass*(b.vx*b.vx+b.vz*b.vz)+.5*i*((b.wx??0)**2+(b.wy??0)**2+(b.wz??0)**2);
        px+=mass*b.vx;pz+=mass*b.vz;angularY+=mass*(b.z*b.vx-b.x*b.vz)+i*(b.wy??0);
    }
    for(let a=0;a<balls.length;a++)for(let b=a+1;b<balls.length;b++){
        if(balls[a].pocketed||balls[b].pocketed)continue;const q=2*m.radius-Math.hypot(balls[b].x-balls[a].x,balls[b].z-balls[a].z);
        if(q>0){elastic+=.4*k*Math.pow(q,2.5);maxIndentation=Math.max(maxIndentation,q);}
    }
    return {time,kinetic,elastic,px,pz,angularY,maxIndentation};
}
/** Advance actual elapsed time, resolving force-bearing contacts with microsteps.
 * Free flight is advanced to the next sphere contact. A bounded loop throws rather
 * than silently discarding unintegrated time. Event tolerance is 1 nanometre.
 */
export function advanceContacts(input:ContactBody[],dt:number,m:ContactMaterial=REFERENCE_MATERIAL,options:ContactOptions={}):ContactAdvance {
    if(!Number.isFinite(dt)||dt<0||!Number.isFinite(m.maxStep)||m.maxStep<=0)throw new RangeError('Invalid contact time step');
    if(![m.radius,m.baseMassKg,m.youngPa,m.frictionVelocity].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(m.poisson)||m.poisson<=-1||m.poisson>=.5||!Number.isFinite(m.restitution)||m.restitution<=0||m.restitution>1||!Number.isFinite(m.friction)||m.friction<0||!Number.isFinite(m.dampingScale)||m.dampingScale<0)throw new RangeError('Invalid contact material');
    const balls=input.slice().sort((a,b)=>(a.bodyId??a.id)-(b.bodyId??b.id)),n=balls.length,d=2*m.radius,k=hertzStiffness(m);
    const inv=balls.map(b=>inverse(b,m)),invI=inv.map(v=>v/(.4*m.radius*m.radius));
    const pairs:{a:number;b:number}[]=[];for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)if(!balls[a].pocketed&&!balls[b].pocketed)pairs.push({a,b});
    const log=Math.log(m.restitution),beta=m.restitution===1?0:-log/Math.sqrt(log*log+Math.PI*Math.PI);
    let time=0,microSteps=0,freeFlights=0,contactStarts=0,maxIndentation=0;
    const acc0=new Float64Array(n*3),acc1=new Float64Array(n*3),touch0=new Uint8Array(pairs.length),touch1=new Uint8Array(pairs.length);
    const drift=(h:number)=>{for(const b of balls)if(!b.pocketed){b.x+=b.vx*h;b.z+=b.vz*h;}};
    const kick=(a:Float64Array,h:number)=>{for(let i=0;i<n;i++){const b=balls[i];if(b.pocketed)continue;b.vx+=a[i*3]*h;b.vz+=a[i*3+1]*h;b.wy=(b.wy??0)+a[i*3+2]*h;}};
    const force=(acc:Float64Array,touch:Uint8Array,sampleTime:number,weight:number)=>{
        acc.fill(0);touch.fill(0);
        for(let p=0;p<pairs.length;p++){
            const {a,b}=pairs[p],A=balls[a],B=balls[b];if(A.pocketed||B.pocketed)continue;const x=B.x-A.x,z=B.z-A.z,len=Math.hypot(x,z),q=d-len;
            if(q<=0)continue;if(len<1e-12)throw new RangeError('Coincident contact centres');
            maxIndentation=Math.max(maxIndentation,q);touch[p]=q>1e-9?1:0;
            const nx=x/len,nz=z/len,tx=-nz,tz=nx,closing=(A.vx-B.vx)*nx+(A.vz-B.vz)*nz;
            // Material Hertz stiffness; restitution damping follows k_nd=K*sqrt(q).
            const damping=m.dampingScale*Math.sqrt(5)*beta*Math.sqrt(k*Math.sqrt(q)/(inv[a]+inv[b]));
            const normal=Math.max(0,k*q*Math.sqrt(q)+damping*closing),lever=len/2;
            const slip=(B.vx-A.vx)*tx+(B.vz-A.vz)*tz+lever*((A.wy??0)+(B.wy??0));
            const tangent=-m.friction*normal*Math.max(-1,Math.min(1,slip/m.frictionVelocity));
            const fx=normal*nx+tangent*tx,fz=normal*nz+tangent*tz;
            options.onForce?.({time:sampleTime,a:A.id,b:B.id,indentation:q,normal,tangent,weight,impulseX:fx*weight,impulseZ:fz*weight});
            acc[a*3]-=fx*inv[a];acc[a*3+1]-=fz*inv[a];acc[b*3]+=fx*inv[b];acc[b*3+1]+=fz*inv[b];
            // Midpoint lever arms conserve orbital + spin angular momentum while indented.
            acc[a*3+2]+=lever*tangent*invI[a];acc[b*3+2]+=lever*tangent*invI[b];
        }
    };
    options.onSample?.(contactSample(balls,m,time));
    const limit=Math.ceil(2*dt/m.maxStep)+64;
    for(let iteration=0;time<dt-1e-14;iteration++){
        if(iteration>=limit)throw new Error('Contact integration budget exhausted');
        let active=false,first=Infinity;
        for(const {a,b} of pairs){
            const A=balls[a],B=balls[b];if(A.pocketed||B.pocketed)continue;const x=B.x-A.x,z=B.z-A.z,vx=B.vx-A.vx,vz=B.vz-A.vz;
            const v2=vx*vx+vz*vz,dot=x*vx+z*vz,c=x*x+z*z-d*d;
            if(c< -1e-14||(c<=1e-14&&dot<0))active=true;
            if(v2<1e-20||dot>=0||c<=0)continue;
            const discriminant=dot*dot-v2*c;if(discriminant<0)continue;
            const t=c/(-dot+Math.sqrt(discriminant));if(t>1e-14&&t<=dt-time)first=Math.min(first,t);
        }
        const boundary=options.nextBoundary?.(balls,dt-time)??null;
        if(boundary&&(!Number.isFinite(boundary.time)||boundary.time<0||boundary.time>dt-time+1e-12))throw new RangeError('Invalid boundary time');
        if(boundary&&boundary.time<=1e-14){boundary.apply();continue;}
        if(!active){
            const h=Math.min(Number.isFinite(first)?first:dt-time,boundary?.time??Infinity);drift(h);time+=h;freeFlights++;
            if(boundary&&boundary.time<=h+1e-14)boundary.apply();
            options.onSample?.(contactSample(balls,m,time));continue;
        }
        const h=Math.min(m.maxStep,dt-time,boundary?.time??Infinity);
        force(acc0,touch0,time,h/2);kick(acc0,h/2);drift(h);force(acc1,touch1,time+h,h/2);kick(acc1,h/2);time+=h;microSteps++;
        if(boundary&&boundary.time<=h+1e-14)boundary.apply();
        for(let p=0;p<pairs.length;p++)if(touch1[p]&&!touch0[p]){const {a,b}=pairs[p];contactStarts++;options.onContact?.(balls[a].id,balls[b].id,time);}
        options.onSample?.(contactSample(balls,m,time));
    }
    return {time,microSteps,freeFlights,contactStarts,maxIndentation};
}
