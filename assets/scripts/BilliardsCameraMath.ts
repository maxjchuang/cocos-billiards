import { SPIN,TipOffset } from './BilliardsSpin';
import { TABLE_GEOMETRY as G,CUSHION_PATHS,POCKETS,TablePoint } from './BilliardsTableGeometry';
export interface Point3 {x:number;y:number;z:number;}
export interface CameraPose {position:Point3;target:Point3;distance:number;height:number;safe:boolean;reason:string;tip?:Point3;direction?:TablePoint;}
export const CAMERA_CONFIG={distance:.45,minDistance:.35,maxDistance:.55,minHeight:.15,maxHeight:.25,fov:55,near:.01,far:6} as const;
export const clamp=(n:number,a:number,b:number):number=>Math.max(a,Math.min(b,n));
export function insidePolygon(p:TablePoint,points:readonly TablePoint[]):boolean {
    let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)yes=!yes;}return yes;
}
/** Render-only cloth support. Never used for pocket capture or ball placement. */
export function onCloth(p:TablePoint):boolean{return Math.abs(p.x)<=G.halfWidth&&Math.abs(p.z)<=G.halfLength&&!POCKETS.some(h=>insidePolygon(p,h.outline));}
const obstacle=(p:Point3):boolean=>{
    if(p.y>.065||p.y<-.18)return false;
    if(Math.abs(p.x)>G.outerHalfWidth||Math.abs(p.z)>G.outerHalfLength)return false;
    if(p.y<=.005&&(Math.abs(p.x)>G.halfWidth||Math.abs(p.z)>G.halfLength))return true;
    return p.y<=.04&&CUSHION_PATHS.some(r=>insidePolygon(p,r.polygon));
};
export function poseIsSafe(p:CameraPose,cue:TablePoint):boolean {
    const {position:eye,target}=p;if(!Object.values(eye).every(Number.isFinite))return false;
    // Eye and its near-plane margin must clear the visual volumes, not the placement rectangle.
    for(const x of [-.012,0,.012])for(const z of [-.012,0,.012])if(obstacle({x:eye.x+x,y:eye.y-.012,z:eye.z+z}))return false;
    // The eye clears actual geometry. Cue/ball occlusion is resolved by local visual
    // clearance, rather than denying the requested perspective.
    return Math.hypot(target.x-eye.x,target.y-eye.y,target.z-eye.z)>CAMERA_CONFIG.near*4;
}
export function solveCamera(cue:TablePoint,direction:TablePoint,height=.2,tip:Readonly<TipOffset>={x:0,y:0},power=2.4):CameraPose {
    const length=Math.hypot(direction.x,direction.z),dx=direction.x/length,dz=direction.z/length;
    const make=(distance:number,h:number):CameraPose=>({position:{x:cue.x-dx*distance,y:h,z:cue.z-dz*distance},target:{x:cue.x+dx*.38,y:G.radius,z:cue.z+dz*.38},distance,height:h,safe:false,reason:'',direction:{x:dx,z:dz},tip:{x:cue.x-dx*(G.radius*Math.sqrt(Math.max(0,1-SPIN.contactFraction**2*(tip.x**2+tip.y**2)))+.02+power/4*.025)-dz*tip.x*SPIN.contactFraction*G.radius,y:G.radius+tip.y*SPIN.contactFraction*G.radius,z:cue.z-dz*(G.radius*Math.sqrt(Math.max(0,1-SPIN.contactFraction**2*(tip.x**2+tip.y**2)))+.02+power/4*.025)+dx*tip.x*SPIN.contactFraction*G.radius}});
    if(![cue.x,cue.z,length,height].every(Number.isFinite)||length<1e-8)return {...make(.45,.2),safe:false,reason:'invalid'};
    const h=clamp(height,.15,.25);
    for(const lift of [h,.25])for(const distance of [.45,.4,.35]){const p=make(distance,lift);if(poseIsSafe(p,cue))return {...p,safe:true,reason:lift!==h?'raised':distance!==.45?'shortened':''};}
    return {...make(.35,.25),safe:false,reason:'blocked'};
}
export function cameraProjection(pose:CameraPose,p:Point3,aspect:number):{x:number;y:number;depth:number;visible:boolean} {
    const a=pose.position,t=pose.target,dx=t.x-a.x,dy=t.y-a.y,dz=t.z-a.z,l=Math.hypot(dx,dy,dz),f={x:dx/l,y:dy/l,z:dz/l};
    const rl=Math.hypot(f.x,f.z),right={x:-f.z/rl,y:0,z:f.x/rl},up={x:-f.y*right.z,y:f.x*right.z-f.z*right.x,z:f.y*right.x};
    const v={x:p.x-a.x,y:p.y-a.y,z:p.z-a.z},dot=(b:Point3)=>v.x*b.x+v.y*b.y+v.z*b.z,depth=dot(f),scale=Math.tan(CAMERA_CONFIG.fov*Math.PI/360);
    const x=dot(right)/(depth*scale*aspect),y=dot(up)/(depth*scale);
    return {x,y,depth,visible:depth>=CAMERA_CONFIG.near&&depth<=CAMERA_CONFIG.far&&Math.abs(x)<=1&&Math.abs(y)<=1};
}

/** Cosmetic tail lift; never used by strike, spin, collision or the referee. */
export function cueDisplayPitch(tip:Point3,direction:TablePoint):number {
    for(let degrees=0;degrees<=8;degrees+=2){const a=degrees*Math.PI/180;let blocked=false;
        for(let i=1;i<=28;i++){const d=.55*i/28;if(obstacle({x:tip.x-direction.x*d*Math.cos(a),y:tip.y+d*Math.sin(a)-.005,z:tip.z-direction.z*d*Math.cos(a)})){blocked=true;break;}}
        if(!blocked)return degrees;
    }return 8;
}
