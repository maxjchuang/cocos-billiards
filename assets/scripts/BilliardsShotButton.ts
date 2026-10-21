import { Color, Graphics, Label, Layers, MaskComponent, Node, UITransform } from 'cc';
import { CLUB } from './BilliardsTheme';
import { shotPose } from './BilliardsShot';

/** Separate line-art icon, clipped to its own 24px window. */
export class ShotButtonView {
    readonly node: Node;
    readonly label: Label;
    private readonly background: Graphics;
    private readonly iconRoot: Node;
    private readonly icon: Graphics;
    constructor(parent: Node) {
        this.node=new Node('Shoot button');this.node.layer=Layers.Enum.UI_2D;parent.addChild(this.node);
        this.node.addComponent(UITransform);this.background=this.node.addComponent(Graphics);
        this.iconRoot=new Node('Shot icon window');this.iconRoot.layer=Layers.Enum.UI_2D;this.node.addChild(this.iconRoot);
        this.iconRoot.addComponent(UITransform).setContentSize(24,24);
        this.iconRoot.addComponent(MaskComponent).type=MaskComponent.Type.GRAPHICS_RECT;
        const icon=new Node('Animated line icon');icon.layer=Layers.Enum.UI_2D;this.iconRoot.addChild(icon);
        icon.addComponent(UITransform).setContentSize(24,24);this.icon=icon.addComponent(Graphics);
        const text=new Node('Shoot title');text.layer=Layers.Enum.UI_2D;this.node.addChild(text);text.addComponent(UITransform);
        this.label=text.addComponent(Label);this.label.overflow=Label.Overflow.SHRINK;
    }
    render(width: number, height: number, s: number, enabled: boolean, active: boolean, ms: number, moving: boolean): void {
        const bg=this.background, g=this.icon;
        bg.clear();bg.fillColor=new Color().fromHEX(enabled||active?CLUB.gold:CLUB.surface);
        bg.roundRect(-width/2,-height/2,width,height,12*s);bg.fill();
        const color=enabled||active?CLUB.background:CLUB.muted;
        const title=active&&!moving?'出杆中':moving?'球运动中':'出杆';
        this.label.string=title;this.label.fontSize=14*s;this.label.lineHeight=20*s;
        this.label.color=new Color().fromHEX(color);
        this.label.node.getComponent(UITransform)!.setContentSize(title.length*14*s,32*s);
        this.label.node.setPosition(13*s,0,0);
        this.iconRoot.setPosition(-(title.length*7+7)*s,0,0);this.iconRoot.setScale(s*20/24,s*20/24,1);
        const pose=shotPose(ms,active), a=pose.cueShift;
        g.clear();g.lineWidth=1.8;g.lineCap=Graphics.LineCap.ROUND;g.lineJoin=Graphics.LineJoin.ROUND;
        g.strokeColor=new Color().fromHEX(color);
        const line=(x:number,y:number,x2:number,y2:number):void=>{g.moveTo(x-12,12-y);g.lineTo(x2-12,12-y2);g.stroke();};
        line(3+a,21-a,11+a,13-a);
        if (pose.ballAlpha>0) {
            const c=new Color().fromHEX(color);c.a=Math.round(pose.ballAlpha*255);g.strokeColor=c;
            g.circle(5+pose.ballTravel,5+pose.ballTravel,4);g.stroke();
        }
        if (pose.burstAlpha>0) {
            const c=new Color().fromHEX(color);c.a=Math.round(pose.burstAlpha*255);g.strokeColor=c;
            for (let i=0;i<8;i++) {
                const angle=i*Math.PI/4, inner=5+pose.burst*4, outer=inner+1.8;
                line(17+Math.cos(angle)*inner,7+Math.sin(angle)*inner,
                    17+Math.cos(angle)*outer,7+Math.sin(angle)*outer);
            }
        }
    }
}
