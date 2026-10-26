import { TablePoint } from './BilliardsTableGeometry';
export interface MeshData {positions:number[];normals:number[];uvs:number[];indices:number[];}
export const emptyMesh=():MeshData=>({positions:[],normals:[],uvs:[],indices:[]});
/** Ear-clipped top plus explicit vertical faces. Visual mesh only. */
export function prism(input:readonly TablePoint[],top:number,bottom?:number):MeshData {
    const points=cleanPolygon(input);if(points.length<3)throw Error('Degenerate visual polygon');
    const m=emptyMesh(),area=points.reduce((s,a,i)=>{const b=points[(i+1)%points.length];return s+a.x*b.z-a.z*b.x;},0),sign=Math.sign(area),remaining=points.map((_,i)=>i);
    const cross=(a:TablePoint,b:TablePoint,c:TablePoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
    for(const p of points){m.positions.push(p.x,top,p.z);m.normals.push(0,1,0);m.uvs.push((p.x+.77)/1.54,1-(p.z+1.41)/2.82);}
    while(remaining.length>3){let found=false;for(let i=0;i<remaining.length;i++){
        const a=remaining[(i+remaining.length-1)%remaining.length],b=remaining[i],c=remaining[(i+1)%remaining.length];
        if(cross(points[a],points[b],points[c])*sign<=1e-12)continue;
        if(remaining.some(j=>j!==a&&j!==b&&j!==c&&cross(points[a],points[b],points[j])*sign>=-1e-12&&cross(points[b],points[c],points[j])*sign>=-1e-12&&cross(points[c],points[a],points[j])*sign>=-1e-12))continue;
        m.indices.push(...(sign>0?[a,c,b]:[a,b,c]));remaining.splice(i,1);found=true;break;
    }if(!found)throw Error('Invalid visual polygon');}
    m.indices.push(...(sign>0?[remaining[0],remaining[2],remaining[1]]:remaining));
    if(bottom!==undefined)for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<1e-10)continue;const base=m.positions.length/3;
        m.positions.push(a.x,bottom,a.z,b.x,bottom,b.z,b.x,top,b.z,a.x,top,a.z);
        for(let j=0;j<4;j++)m.normals.push(sign*dz/l,0,-sign*dx/l);
        m.uvs.push(0,0,l,0,l,1,0,1);m.indices.push(...(sign>0?[base,base+2,base+1,base,base+3,base+2]:[base,base+1,base+2,base,base+2,base+3]));
    }
    return m;
}
export function ribbon(m:MeshData,a:TablePoint,b:TablePoint,width:number,y=.00045):void {
    const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz);if(l<1e-9)return;const x=-dz/l*width/2,z=dx/l*width/2,i=m.positions.length/3;
    m.positions.push(a.x+x,y,a.z+z,b.x+x,y,b.z+z,b.x-x,y,b.z-z,a.x-x,y,a.z-z);
    for(let n=0;n<4;n++)m.normals.push(0,1,0);m.uvs.push(0,0,1,0,1,1,0,1);m.indices.push(i,i+1,i+2,i,i+2,i+3);
}

const cross2=(a:TablePoint,b:TablePoint,c:TablePoint)=>(b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x);
export function cleanPolygon(input:readonly TablePoint[]):TablePoint[]{
    const p=input.filter((q,i)=>Math.hypot(q.x-input[(i+input.length-1)%input.length].x,q.z-input[(i+input.length-1)%input.length].z)>1e-9).map(q=>({...q}));
    let changed=true;while(changed&&p.length>3){changed=false;for(let i=0;i<p.length;i++)if(Math.abs(cross2(p[(i+p.length-1)%p.length],p[i],p[(i+1)%p.length]))<1e-11){p.splice(i,1);changed=true;break;}}
    return p;
}
const halfPlane=(input:TablePoint[],a:TablePoint,b:TablePoint,sign:number,inside:boolean):TablePoint[]=>{
    const output:TablePoint[]=[];for(let i=0;i<input.length;i++){
        const p=input[i],q=input[(i+1)%input.length],dp=cross2(a,b,p)*sign,dq=cross2(a,b,q)*sign,yes=inside?dp>=-1e-10:dp<=1e-10,next=inside?dq>=-1e-10:dq<=1e-10;
        if(yes)output.push(p);if(yes!==next){const t=dp/(dp-dq);output.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
    }
    return cleanPolygon(output);
};
/** Subtract the triangulated proxy openings from render surfaces. No collision use. */
export function subtractOpenings(surfaces:TablePoint[][],openings:readonly (readonly TablePoint[])[]):TablePoint[][] {
    let result=surfaces.map(cleanPolygon);
    for(const outline of openings){const data=prism(outline,0),triangles=[];
        for(let i=0;i<data.indices.length;i+=3)triangles.push(data.indices.slice(i,i+3).map(j=>({x:data.positions[j*3],z:data.positions[j*3+2]})));
        for(const triangle of triangles){const next:TablePoint[][]=[],sign=Math.sign(cross2(triangle[0],triangle[1],triangle[2]));
            const minX=Math.min(...triangle.map(p=>p.x)),maxX=Math.max(...triangle.map(p=>p.x)),minZ=Math.min(...triangle.map(p=>p.z)),maxZ=Math.max(...triangle.map(p=>p.z));
            for(const polygon of result){if(polygon.every(p=>p.x<minX)||polygon.every(p=>p.x>maxX)||polygon.every(p=>p.z<minZ)||polygon.every(p=>p.z>maxZ)){next.push(polygon);continue;}
                let remaining=polygon;
                for(let i=0;i<3&&remaining.length>=3;i++){
                    const outside=halfPlane(remaining,triangle[i],triangle[(i+1)%3],sign,false);if(outside.length>=3&&Math.abs(outside.reduce((s,a,j)=>{const b=outside[(j+1)%outside.length];return s+a.x*b.z-a.z*b.x;},0))>1e-10)next.push(outside);
                    remaining=halfPlane(remaining,triangle[i],triangle[(i+1)%3],sign,true);
                }
            }result=next;
        }
    }
    return result;
}
export function mergeMeshes(parts:readonly MeshData[]):MeshData {
    const m=emptyMesh();for(const p of parts){const offset=m.positions.length/3;m.positions.push(...p.positions);m.normals.push(...p.normals);m.uvs.push(...p.uvs);m.indices.push(...p.indices.map(i=>i+offset));}return m;
}

/** Convex intersection for a render-only local transparency window. */
export function intersectConvex(input:TablePoint[],clip:TablePoint[]):TablePoint[]{
    const area=clip.reduce((s,a,i)=>{const b=clip[(i+1)%clip.length];return s+a.x*b.z-a.z*b.x;},0);let out=input;
    for(let i=0;i<clip.length&&out.length>=3;i++)out=halfPlane(out,clip[i],clip[(i+1)%clip.length],Math.sign(area),true);
    return out.length>=3?out:[];
}
