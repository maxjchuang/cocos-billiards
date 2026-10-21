/** Shared table-plane geometry. Metres. Candidate mouth sizes, NOT a certified table model.
 * Rounded jaws and drop planes are independently constructed gameplay proxies, not SVG imports.
 */
export interface TablePoint { x: number; z: number; }
export type CushionSide = 'left' | 'right' | 'top' | 'bottom';
export const TABLE_GEOMETRY = {
    halfWidth: 0.63, halfLength: 1.27, radius: 0.028575,
    outerHalfWidth: 0.77, outerHalfLength: 1.41,
};
export const POCKET_MODEL = {
    cornerMouth: 0.085, sideMouth: 0.082,
    // Dimensionless gameplay tuning, not measured jaw/shelf dimensions.
    jawRadiusInBallRadii: 0.5, dropDepthInBallRadii: 1,
    railDepth: 0.07, arcSegments: 16,
};
const G = TABLE_GEOMETRY, J = G.radius * POCKET_MODEL.jawRadiusInBallRadii;
const cornerCut = POCKET_MODEL.cornerMouth / Math.sqrt(2) + J * (Math.sqrt(2) - 1);
export interface PocketGeometry extends TablePoint {
    kind: 'corner' | 'side'; mouth: number;
    lip: TablePoint; normal: TablePoint; tangent: TablePoint; dropDepth: number;
    outline: TablePoint[];
}
export const POCKETS: PocketGeometry[] = [-1, 1].flatMap(sx => [-1, 0, 1].map(sz => {
    const corner = sz !== 0, mouth = corner ? POCKET_MODEL.cornerMouth : POCKET_MODEL.sideMouth;
    const normal = corner ? { x:sx/Math.sqrt(2), z:sz/Math.sqrt(2) } : { x:sx, z:0 };
    const tangent = { x:-normal.z, z:normal.x };
    const shift = (cornerCut-J)/2;
    const lip = corner ? { x:sx*(G.halfWidth-shift), z:sz*(G.halfLength-shift) }
        : { x:sx*(G.halfWidth+J), z:0 };
    const dropDepth = G.radius * POCKET_MODEL.dropDepthInBallRadii;
    const toWorld = (u:number,v:number):TablePoint => ({ x:lip.x+tangent.x*u+normal.x*v, z:lip.z+tangent.z*u+normal.z*v });
    const jaw:TablePoint[]=[];
    for(let i=0;i<=POCKET_MODEL.arcSegments;i++) {
        const a=(corner?Math.PI/4:Math.PI/2)*i/POCKET_MODEL.arcSegments;
        const u=corner ? -mouth/2+J*(Math.cos(a)+Math.sin(a)-Math.sqrt(2))/Math.sqrt(2) : -mouth/2-J+J*Math.sin(a);
        const v=corner ? J*(-Math.cos(a)+Math.sin(a))/Math.sqrt(2) : -J*Math.cos(a);
        jaw.push({x:u,z:v});
    }
    // Visual round back only. It does NOT participate in collision or capture tests.
    const back=Array.from({length:33},(_,i)=>{
        const a=-Math.PI/2+i*Math.PI/32;
        return {x:mouth/2*Math.sin(a),z:dropDepth+mouth/2*Math.cos(a)};
    });
    const outline=[...jaw,...back,...jaw.slice().reverse().map(p=>({x:-p.x,z:p.z}))].map(p=>toWorld(p.x,p.z));
    const centre=toWorld(0,dropDepth+0.0001);
    return {...centre,kind:corner?'corner' as const:'side' as const,mouth,lip,normal,tangent,dropDepth,outline};
}));
export interface CushionPath { side:CushionSide; nose:TablePoint[]; polygon:TablePoint[]; }
export const CUSHION_PATHS:CushionPath[]=[];
// Four long half-rails: middle facing -> rounded jaw -> straight nose -> corner jaw -> facing.
for(const sx of [-1,1]) for(const sz of [-1,1]) {
    const mouth=POCKET_MODEL.sideMouth/2, nose:TablePoint[]=[{x:G.halfWidth+POCKET_MODEL.railDepth,z:mouth}];
    for(let i=POCKET_MODEL.arcSegments;i>=0;i--) {
        const a=Math.PI/2*i/POCKET_MODEL.arcSegments;
        nose.push({x:G.halfWidth+J*(1-Math.cos(a)),z:mouth+J-J*Math.sin(a)});
    }
    nose.push({x:G.halfWidth,z:G.halfLength-cornerCut});
    for(let i=1;i<=POCKET_MODEL.arcSegments;i++) {
        const a=Math.PI/4*i/POCKET_MODEL.arcSegments;
        nose.push({x:G.halfWidth+J*(1-Math.cos(a)),z:G.halfLength-cornerCut+J*Math.sin(a)});
    }
    const tip=nose[nose.length-1];
    nose.push({x:G.halfWidth+POCKET_MODEL.railDepth,z:tip.z+G.halfWidth+POCKET_MODEL.railDepth-tip.x});
    const points=nose.map(p=>({x:p.x*sx,z:p.z*sz}));
    CUSHION_PATHS.push({side:sx<0?'left':'right',nose:points,polygon:points});
}
// Two end rails, split at the centre for convex procedural mesh construction.
for(const sz of [-1,1]) for(const sx of [-1,1]) {
    const nose:TablePoint[]=[{x:0,z:G.halfLength},{x:G.halfWidth-cornerCut,z:G.halfLength}];
    for(let i=1;i<=POCKET_MODEL.arcSegments;i++) {
        const a=Math.PI/4*i/POCKET_MODEL.arcSegments;
        nose.push({x:G.halfWidth-cornerCut+J*Math.sin(a),z:G.halfLength+J*(1-Math.cos(a))});
    }
    const tip=nose[nose.length-1];
    nose.push({x:tip.x+G.halfLength+POCKET_MODEL.railDepth-tip.z,z:G.halfLength+POCKET_MODEL.railDepth});
    const polygon=[...nose,{x:0,z:G.halfLength+POCKET_MODEL.railDepth}];
    CUSHION_PATHS.push({side:sz<0?'top':'bottom',nose:nose.map(p=>({x:p.x*sx,z:p.z*sz})),polygon:polygon.map(p=>({x:p.x*sx,z:p.z*sz}))});
}
export const CUSHION_SEGMENTS=CUSHION_PATHS.flatMap(path=>{
    const winding=Math.sign(path.polygon.reduce((sum,a,i)=>{
        const b=path.polygon[(i+1)%path.polygon.length];return sum+a.x*b.z-a.z*b.x;
    },0));
    return path.nose.slice(1).map((b,i)=>{
        const a=path.nose[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
        return {a,b,side:path.side,inward:{x:winding*dz/length,z:-winding*dx/length}};
    });
});
export function nearestOnSegment(p:TablePoint,a:TablePoint,b:TablePoint):TablePoint {
    const dx=b.x-a.x,dz=b.z-a.z,length=dx*dx+dz*dz;
    const t=length>0?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/length)):0;
    return {x:a.x+t*dx,z:a.z+t*dz};
}
export function pocketCoordinates(p:TablePoint,pocket:PocketGeometry):{u:number;v:number} {
    const x=p.x-pocket.lip.x,z=p.z-pocket.lip.z;
    return {u:x*pocket.tangent.x+z*pocket.tangent.z,v:x*pocket.normal.x+z*pocket.normal.z};
}
/** Capture is behind the jaws; the visible round back is never an attraction/capture circle. */
export function pocketAt(p:TablePoint):number {
    return POCKETS.findIndex(pocket=>{
        const {u,v}=pocketCoordinates(p,pocket);
        return v>=pocket.dropDepth-1e-9 && Math.abs(u)<=pocket.mouth/2-G.radius+1e-9;
    });
}
export function clearOfCushions(p:TablePoint, radius=G.radius):boolean {
    return CUSHION_SEGMENTS.every(segment=>{
        const q=nearestOnSegment(p,segment.a,segment.b);
        return Math.hypot(p.x-q.x,p.z-q.z)>=radius-1e-9;
    });
}
export function validTablePlacement(p:TablePoint):boolean {
    return Number.isFinite(p.x)&&Number.isFinite(p.z)&&Math.abs(p.x)<=G.halfWidth-G.radius&&
        Math.abs(p.z)<=G.halfLength-G.radius&&clearOfCushions(p)&&pocketAt(p)<0;
}

/** First swept-circle contact with actual cushion segments or a clear pocket drop plane. */
export function traceTable(p:TablePoint,dx:number,dz:number):{distance:number;kind:'cushion'|'pocket'}|null {
    let distance=Infinity,kind:'cushion'|'pocket'='cushion';
    const endpoint=(centre:TablePoint):void=>{
        const x=p.x-centre.x,z=p.z-centre.z,b=x*dx+z*dz,c=x*x+z*z-G.radius*G.radius;
        const disc=b*b-c;
        if(disc<0||b>=0)return;
        const t=-b-Math.sqrt(disc);
        if(t>=-1e-9&&t<distance){distance=Math.max(0,t);kind='cushion';}
    };
    for(const {a,b} of CUSHION_SEGMENTS) {
        endpoint(a);endpoint(b);
        const x=b.x-a.x,z=b.z-a.z,length=Math.hypot(x,z),nx=-z/length,nz=x/length;
        const velocity=dx*nx+dz*nz;
        if(Math.abs(velocity)<1e-10)continue;
        for(const sign of [-1,1]) {
            const t=(sign*G.radius-((p.x-a.x)*nx+(p.z-a.z)*nz))/velocity;
            if(t<0||t>=distance)continue;
            const u=((p.x+dx*t-a.x)*x+(p.z+dz*t-a.z)*z)/(length*length);
            if(u>=0&&u<=1){distance=t;kind='cushion';}
        }
    }
    for(const pocket of POCKETS) {
        const q=pocketCoordinates(p,pocket),dv=dx*pocket.normal.x+dz*pocket.normal.z;
        if(dv<=1e-10)continue;
        const t=(pocket.dropDepth-q.v)/dv;
        const u=q.u+t*(dx*pocket.tangent.x+dz*pocket.tangent.z);
        if(t>=0&&t<distance&&Math.abs(u)<=pocket.mouth/2-G.radius){distance=t;kind='pocket';}
    }
    return Number.isFinite(distance)?{distance,kind}:null;
}
