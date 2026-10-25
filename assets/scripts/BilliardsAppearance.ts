/** Deterministic appearance only. No physics state or random-number generator is used. */
export type Surface='felt'|'wood'|'rail'|'pocket';
const rgb=(h:string):number[]=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export function surfacePixels(kind:Surface,size=128):Uint8Array {
    const dark=rgb({felt:'#1B4A3F',wood:'#3D3027',rail:'#102F27',pocket:'#030907'}[kind]);
    const light=rgb({felt:'#286556',wood:'#72533D',rail:'#214B40',pocket:'#19271F'}[kind]);
    const pixels=new Uint8Array(size*size*4);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const u=x/(size-1),v=y/(size-1);
        let mix=kind==='felt'?Math.max(0,1-Math.hypot((u-.42)*.85,(v-.36)*.7)):
            kind==='wood'?.72-.35*u-.16*v+.025*Math.sin(v*220+u*3):
            kind==='rail'?.7*(1-v)+.12*Math.cos(u*Math.PI):Math.max(0,(Math.hypot(u-.5,v-.45)-.2)*1.2);
        mix=Math.max(0,Math.min(1,mix));const i=(y*size+x)*4;
        for(let c=0;c<3;c++)pixels[i+c]=Math.round(dark[c]+(light[c]-dark[c])*mix);pixels[i+3]=255;
    }
    return pixels;
}
export interface Disc {x:number;y:number;r:number;}
/** Visible fractions of a line segment, excluding projected ball silhouettes. */
export function visibleFractions(a:{x:number;y:number},b:{x:number;y:number},discs:readonly Disc[]):[number,number][] {
    const dx=b.x-a.x,dy=b.y-a.y,aa=dx*dx+dy*dy;if(aa<1e-12)return [];
    const hidden:[number,number][]=[];
    for(const p of discs){const x=a.x-p.x,y=a.y-p.y,bb=2*(x*dx+y*dy),cc=x*x+y*y-p.r*p.r,d=bb*bb-4*aa*cc;if(d<=0)continue;
        const start=Math.max(0,(-bb-Math.sqrt(d))/(2*aa)),end=Math.min(1,(-bb+Math.sqrt(d))/(2*aa));if(end>start)hidden.push([start,end]);}
    hidden.sort((x,y)=>x[0]-y[0]);const visible:[number,number][]=[];let start=0;
    for(const [a,b] of hidden){if(a>start)visible.push([start,a]);start=Math.max(start,b);}if(start<1)visible.push([start,1]);return visible;
}
