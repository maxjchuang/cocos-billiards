import { ballColor } from './BilliardsTheme';
const DIGITS=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
/** Local glyph generation, no DOM canvas, font download or third-party artwork. */
export function numberedBallPixels(id:number,w=256,h=128):Uint8Array {
    const rgb=(s:string)=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16)),colour=rgb(ballColor(id)),white=[245,241,230],ink=[24,40,30];
    const out=new Uint8Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=x/w,v=y/h,band=v>=1/3&&v<=2/3;let c=id>8&&!band?white:colour;
        if(id){let delta=Math.min(Math.abs(u-.25),Math.abs(u-.75));const vx=delta/.072,vy=(v-.5)/.14;
            if(vx*vx+vy*vy<1){c=white;const centre=Math.abs(u-.25)<Math.abs(u-.75)?.25:.75,text=String(id),glyphW=.023,gap=.008,total=text.length*glyphW+(text.length-1)*gap;
                const xx=u-(centre-total/2),yy=(v-.5+.068)/.136;
                if(yy>=0&&yy<1&&xx>=0&&xx<total){const slot=Math.floor(xx/(glyphW+gap)),gx=(xx-slot*(glyphW+gap))/glyphW;if(gx>=0&&gx<1&&DIGITS[Number(text[slot])]?.[Math.floor(yy*5)*3+Math.floor(gx*3)]==='1')c=ink;}
            }
        }
        out.set([...c,255],(y*w+x)*4);
    }
    return out;
}
