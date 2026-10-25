import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
import { CLUB, ballColor } from './BilliardsTheme';
import { fitNickname, PlayerProfile, playerName } from './BilliardsPlayers';
import { Group, groupName } from './BilliardsRules';

/** Reusable HUD component; gameplay and referee state remain outside this view. */
export class PlayerCardView {
    readonly node: Node;
    readonly nameLabel: Label;
    private readonly groupLabel: Label;
    private readonly fallbackLabel: Label;
    private readonly levelLabel:Label;
    private readonly artwork: Graphics;
    private readonly numbers: Label[] = [];
    private stamp = '';

    constructor(parent: Node, seat: number) {
        this.node = new Node(`Player ${seat + 1} card`);
        this.node.layer = Layers.Enum.UI_2D;
        parent.addChild(this.node);
        this.node.addComponent(UITransform);
        this.artwork = this.node.addComponent(Graphics);
        this.nameLabel = this.text('Nickname', CLUB.ink);
        this.groupLabel = this.text('Group', CLUB.muted);
        this.fallbackLabel = this.text('Targets status', CLUB.muted);this.levelLabel=this.text('AI difficulty badge',CLUB.gold,true);
        for (let i = 0; i < 7; i++) this.numbers.push(this.text(`Target ${i}`, CLUB.background, true));
    }

    private text(name: string, color: string, centered = false): Label {
        const node = new Node(name); node.layer = Layers.Enum.UI_2D;
        this.node.addChild(node); node.addComponent(UITransform);
        const label = node.addComponent(Label);label.fontFamily=CLUB.fontFamily;
        label.color = new Color().fromHEX(color);
        label.horizontalAlign = centered ? Label.HorizontalAlign.CENTER : Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        return label;
    }

    render(profile: PlayerProfile, seat: number, group: Group | null, ids: number[], active: boolean,
        width: number, height: number, scale: number,level=''): void {
        const stamp = [profile.id, profile.nickname, profile.avatar, level, seat, group, ...ids, active, width, height, scale].join('|');
        if (stamp === this.stamp) return;
        this.stamp = stamp;
        const g = this.artwork, x = -width / 2, y = height / 2, s = scale;
        const colour = (value: string): Color => new Color().fromHEX(value);
        const circle = (cx: number, cy: number, r: number, value: string): void => {
            g.fillColor = colour(value); g.circle(cx, cy, r); g.fill();
        };
        const text = (label: Label, value: string, cx: number, cy: number, w: number, size: number): void => {
            label.string = value; label.fontSize = size * s; label.lineHeight = (size + 4) * s;
            label.node.setPosition(cx, cy, 0); label.node.getComponent(UITransform)!.setContentSize(w, (size + 6) * s);
        };
        g.clear(); g.fillColor = colour(active ? CLUB.activeSurface : '#15251F');
        g.roundRect(x, -height / 2, width, height, CLUB.radius * s); g.fill();
        const ax = x + 23 * s, ay = y - 21 * s;
        drawAvatar(g,ax,ay,14*s,profile.avatar);
        if (active) { g.strokeColor = colour(CLUB.gold);g.lineWidth = 1.5*s;g.circle(ax, ay, 16*s);g.stroke(); }
        const textX = x + 46*s, textWidth = Math.max(1, width - 54*s-(level?29*s:0));
        text(this.nameLabel, fitNickname(level?'AI 陪练':playerName(profile, seat), textWidth / (13*s)), textX + textWidth/2, y - 14*s, textWidth, 13);
        this.levelLabel.node.active=!!level;if(level){const lx=x+width-20*s;text(this.levelLabel,level,lx,y-14*s,28*s,11);g.strokeColor=colour('#8D7855');g.lineWidth=.6;g.roundRect(lx-14*s,y-22*s,28*s,16*s,4);g.stroke();}
        text(this.groupLabel, group ? `${groupName(group)} · 剩${ids.length}` : '尚未分组', textX + (width-54*s)/2, y - 30*s, width-54*s, 11);
        this.fallbackLabel.node.active = !!group && ids.length === 0;
        text(this.fallbackLabel, group ? '目标 8 号' : '等待分组', x + width/2, -height/2 + 15*s, width - 20*s, 11);
        this.numbers.forEach((label, i) => {
            label.node.active = i < ids.length;
            if (i >= ids.length) return;
            const diameter=width<150?16*s:18*s,spacing=Math.min(diameter+3*s,(width-18*s-diameter)/Math.max(1,ids.length-1));
            const id = ids[i], cx = x + 9*s+diameter/2+i*spacing, cy = -height/2 + 13*s, r = diameter/2;
            circle(cx, cy, r, id > 8 ? '#F5F2E8' : ballColor(id));
            if (id > 8) {
                // The strip terminates on the circle, leaving continuous white caps.
                const half = Math.sqrt(r*r - (3.5*s)**2);
                g.fillColor = colour(ballColor(id));
                g.moveTo(cx-half, cy+3.5*s);g.lineTo(cx+half, cy+3.5*s);
                g.bezierCurveTo(cx+r, cy+2*s, cx+r, cy-2*s, cx+half, cy-3.5*s);
                g.lineTo(cx-half, cy-3.5*s);g.bezierCurveTo(cx-r, cy-2*s, cx-r, cy+2*s, cx-half, cy+3.5*s);g.close();g.fill();
            }
            circle(cx, cy, r*.61, '#FCF9F0');
            text(label, String(id), cx, cy, 14*s, 8);
            circle(cx-r*.35,cy+r*.5,r*.16,'#FFFFFF38');
        });
    }
}

/** Code-native avatar artwork from the editable design, shared by cards and identity view. */
export function drawAvatar(g:Graphics,x:number,y:number,r:number,kind:string):void {
    const color=(s:string)=>new Color().fromHEX(s);
    const circle=(a:number,b:number,size:number,c:string)=>{g.fillColor=color(c);g.circle(x+a*r,y+b*r,size*r);g.fill();};
    const polygon=(points:number[][],c:string)=>{
        let clipped=points;
        for(let i=0;i<64&&clipped.length;i++){
            const a=[Math.cos(i*Math.PI/32),Math.sin(i*Math.PI/32)],b=[Math.cos((i+1)*Math.PI/32),Math.sin((i+1)*Math.PI/32)];
            const side=(p:number[]) => (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
            const output:number[][]=[];
            for(let j=0;j<clipped.length;j++){const p=clipped[j],q=clipped[(j+1)%clipped.length],sp=side(p),sq=side(q);
                if(sp>=0)output.push(p);if((sp>=0)!==(sq>=0)){const t=sp/(sp-sq);output.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}
            clipped=output;
        }
        if(!clipped.length)return;g.fillColor=color(c);g.moveTo(x+clipped[0][0]*r,y+clipped[0][1]*r);for(const p of clipped.slice(1))g.lineTo(x+p[0]*r,y+p[1]*r);g.close();g.fill();
    };
    circle(0,0,1,kind==='fox'?'#A67658':kind==='forest'?'#5C7F6A':'#735B3D');
    if(kind==='forest'){
        circle(.36,.42,.26,'#E7D4A3');
        polygon([[-1,-1],[-.4,.3],[.64,-1]],'#1F493A');
        polygon([[-.48,-1],[.38,.1],[1.3,-1]],'#395F47');
    }else if(kind==='fox'){
        polygon([[-.7,.7],[-.1,.42],[.7,.7],[.6,-.36],[0,-.76],[-.6,-.36]],'#EDC58F');
        polygon([[-.7,.7],[-.2,.38],[-.5,.1]],'#553C31');polygon([[.7,.7],[.2,.38],[.5,.1]],'#553C31');
        polygon([[-.56,-.1],[0,-.36],[.56,-.1],[0,-.76]],'#FFF0CB');
        circle(-.3,-.02,.07,'#24362D');circle(.3,-.02,.07,'#24362D');circle(0,-.4,.08,'#24362D');
    }else if(kind==='sun'){circle(0,.2,.38,CLUB.gold);}
    else{circle(0,.3,.28,CLUB.muted);circle(0,-.45,.4,CLUB.muted);}
}
