import { Color, Graphics, Label, Layers, MaskComponent, Node, UITransform } from 'cc';
import { AimContact } from './BilliardsAim';
import { BallState,TABLE } from './BilliardsPhysics';
import { CUSHION_SEGMENTS } from './BilliardsTableGeometry';
import { ballColor,CLUB } from './BilliardsTheme';
import { HudRect } from './BilliardsLayout';
/** A clipped, non-interactive projection of the SAME first-contact geometry. */
export class MagnifierView {
    readonly node:Node;private content:Graphics;private title:Label;private numbers:Label[]=[];
    bounds:HudRect={x:0,y:0,width:132,height:116};
    constructor(parent:Node){
        this.node=new Node('Contact magnifier');this.node.layer=Layers.Enum.UI_2D;parent.addChild(this.node);this.node.addComponent(UITransform).setContentSize(132,116);
        this.node.addComponent(MaskComponent).type=MaskComponent.Type.GRAPHICS_RECT;
        const artwork=new Node('Magnified geometry');artwork.layer=Layers.Enum.UI_2D;this.node.addChild(artwork);artwork.addComponent(UITransform);this.content=artwork.addComponent(Graphics);
        const text=new Node('Magnifier caption');text.layer=Layers.Enum.UI_2D;this.node.addChild(text);text.addComponent(UITransform).setContentSize(124,20);text.setPosition(0,46,0);
        this.title=text.addComponent(Label);this.title.string='接触点放大';this.title.fontFamily=CLUB.fontFamily;this.title.fontSize=11;this.title.color=new Color().fromHEX(CLUB.ink);
        for(let id=1;id<=15;id++){const n=new Node('Magnifier number '+id);n.layer=Layers.Enum.UI_2D;artwork.addChild(n);n.addComponent(UITransform).setContentSize(14,14);const l=n.addComponent(Label);l.string=String(id);l.fontFamily=CLUB.numberFontFamily;l.fontSize=8;l.lineHeight=10;l.overflow=Label.Overflow.SHRINK;l.color=new Color().fromHEX('#223328');this.numbers.push(l);}
        this.node.active=false;
    }
    render(width:number,height:number,area:HudRect,balls:readonly BallState[],hit:AimContact|null,pointer:{x:number;y:number}|null,active:boolean):void{
        this.node.active=active&&!!hit&&area.height>=132;if(!this.node.active||!hit)return;
        const candidates=[area.x+8,area.x+area.width-140].flatMap(x=>[area.y+8,area.y+area.height-124].map(y=>({x,y})));
        const distance=(p:{x:number;y:number})=>pointer?Math.hypot(Math.max(p.x-pointer.x,0,pointer.x-p.x-132),Math.max(p.y-pointer.y,0,pointer.y-p.y-116)):0;
        const upper=candidates.filter(p=>p.y===area.y+8&&distance(p)>=12),pool=upper.length?upper:candidates;
        const chosen=pointer?pool.sort((a,b)=>distance(b)-distance(a))[0]:candidates[0];const {x,y}=chosen;
        this.bounds={x,y,width:132,height:116};
        this.node.setPosition(x+66-width/2,height/2-y-58,0);
        const g=this.content,color=(s:string)=>new Color().fromHEX(s),scale=420;
        const point=(x:number,z:number)=>({x:(x-hit.x)*scale,y:-(z-hit.z)*scale-8});
        g.clear();g.fillColor=color(CLUB.felt);g.rect(-66,-58,132,116);g.fill();
        g.strokeColor=color(CLUB.cushion);g.lineWidth=8;
        for(const segment of CUSHION_SEGMENTS){const a=point(segment.a.x,segment.a.z),b=point(segment.b.x,segment.b.z);g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();}
        this.numbers.forEach(l=>l.node.active=false);
        for(const ball of balls){if(ball.pocketed)continue;const p=point(ball.x,ball.z),r=TABLE.radius*scale;if(Math.abs(p.x)>90||Math.abs(p.y)>90||p.y>25)continue;
            g.fillColor=color(ball.id>8?'#F5F2E8':ballColor(ball.id));g.circle(p.x,p.y,r);g.fill();
            if(ball.id>8){const h=r*.5,half=Math.sqrt(r*r-h*h);g.fillColor=color(ballColor(ball.id));g.moveTo(p.x-half,p.y+h);g.lineTo(p.x+half,p.y+h);g.bezierCurveTo(p.x+r,p.y+h*.5,p.x+r,p.y-h*.5,p.x+half,p.y-h);g.lineTo(p.x-half,p.y-h);g.bezierCurveTo(p.x-r,p.y-h*.5,p.x-r,p.y+h*.5,p.x-half,p.y+h);g.close();g.fill();}
            if(ball.id){g.fillColor=color('#FCF9F0');g.circle(p.x,p.y,r*.48);g.fill();const l=this.numbers[ball.id-1];l.node.active=true;l.node.setPosition(p.x,p.y,0);}
        }
        const cue=balls[0],along=Math.hypot(cue.x-hit.x,cue.z-hit.z),dx=(cue.x-hit.x)/Math.max(along,1e-6),dy=-(cue.z-hit.z)/Math.max(along,1e-6);
        g.strokeColor=color(CLUB.line);g.lineWidth=1;for(let d=TABLE.radius*scale+4;d<90;d+=8){g.moveTo(dx*d,-8+dy*d);g.lineTo(dx*(d+4),-8+dy*(d+4));g.stroke();}
        g.strokeColor=color(CLUB.gold);g.lineWidth=1.5;g.circle(0,-8,TABLE.radius*scale);g.stroke();
        g.fillColor=color(CLUB.background);g.rect(-66,36,132,22);g.fill();
    }
}
