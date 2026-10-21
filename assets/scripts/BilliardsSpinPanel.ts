import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
import { CLUB } from './BilliardsTheme';
import { TipOffset, tipLabel } from './BilliardsSpin';
import { SafeInsets } from './BilliardsLayout';

/** Blocking editor for a draft tip position. It never submits a shot. */
export class SpinPanelView {
    readonly node: Node;
    readonly panel: Node;
    readonly surface: Node;
    readonly cancel: Label;
    readonly done: Label;
    readonly center: Label;
    private readonly face: Graphics;
    private readonly title: Label;
    private readonly subtitle: Label;
    private readonly summary: Label;
    private readonly hint: Label;
    private readonly axes: Label[]=[];
    private stamp='';
    selectionRadius=60;

    constructor(parent:Node) {
        const node=(name:string,root:Node):Node=>{
            const n=new Node(name);n.layer=Layers.Enum.UI_2D;root.addChild(n);n.addComponent(UITransform);return n;
        };
        this.node=node('Cue tip overlay',parent);this.node.addComponent(Graphics);
        this.panel=node('Cue tip panel',this.node);this.panel.addComponent(Graphics);
        const text=(name:string):Label=>{
            const n=node(name,this.panel);const label=n.addComponent(Label);
            label.overflow=Label.Overflow.SHRINK;label.color=new Color().fromHEX(CLUB.ink);return label;
        };
        const button=(name:string):Label=>{
            const n=node(name,this.panel);n.addComponent(Graphics);const labelNode=node(name+' title',n);
            const label=labelNode.addComponent(Label);label.overflow=Label.Overflow.SHRINK;return label;
        };
        this.title=text('母球打点');this.subtitle=text('沿球杆看向母球 · 与屏幕方位无关');
        this.summary=text('Draft tip description');this.hint=text('相对选择范围的偏移量');
        this.axes=['高杆','低杆','左塞','右塞'].map(text);
        this.surface=node('Cue tip surface',this.panel);this.face=this.surface.addComponent(Graphics);
        this.cancel=button('取消');this.center=button('复位中杆');this.done=button('完成');
        this.node.active=false;
    }

    render(width:number,height:number,insets:Partial<SafeInsets>,tip:Readonly<TipOffset>,active:boolean):void {
        this.node.active=active;
        if(!active)return;
        const stamp=[width,height,insets.top,insets.bottom,tip.x,tip.y].join('|');
        if(stamp===this.stamp)return;this.stamp=stamp;
        const s=Math.min(1,width/320),top=insets.top??0,bottom=insets.bottom??0;
        const h=Math.min(496*s,height-top-bottom-8*s),w=Math.min(width,430*s);
        const colour=(hex:string):Color=>new Color().fromHEX(hex);
        const dim=this.node.getComponent(Graphics)!;dim.clear();dim.fillColor=new Color(0,0,0,175);
        dim.rect(-width/2,-height/2,width,height);dim.fill();
        this.node.getComponent(UITransform)!.setContentSize(width,height);
        this.panel.setPosition(0,-height/2+bottom+h/2,0);this.panel.getComponent(UITransform)!.setContentSize(w,h);
        const bg=this.panel.getComponent(Graphics)!;bg.clear();bg.fillColor=colour(CLUB.surface);
        bg.roundRect(-w/2,-h/2,w,h,24*s);bg.fill();
        const text=(label:Label,value:string,x:number,y:number,tw:number,size:number,muted=false):void=>{
            label.string=value;label.fontSize=size*s;label.lineHeight=(size+5)*s;
            label.color=colour(muted?CLUB.muted:CLUB.ink);label.node.setPosition(x,y,0);
            label.node.getComponent(UITransform)!.setContentSize(tw,(size+8)*s);
        };
        text(this.title,'母球打点',-w/2+100*s,h/2-40*s,152*s,22);
        text(this.subtitle,'沿球杆看向母球 · 与屏幕方位无关',0,h/2-78*s,w-40*s,11,true);
        const cy=h/2-223*s;
        this.surface.setPosition(0,cy,0);this.surface.getComponent(UITransform)!.setContentSize(208*s,208*s);
        this.selectionRadius=60*s;
        const g=this.face;g.clear();g.fillColor=colour(CLUB.ink);g.circle(0,0,88*s);g.fill();
        g.lineWidth=s;g.strokeColor=colour(CLUB.gold);g.circle(0,0,this.selectionRadius);g.stroke();
        g.strokeColor=colour('#B3B199');g.moveTo(-60*s,0);g.lineTo(60*s,0);g.moveTo(0,-60*s);g.lineTo(0,60*s);g.stroke();
        g.fillColor=colour(CLUB.muted);g.circle(0,0,3*s);g.fill();
        g.strokeColor=colour(CLUB.gold);g.moveTo(0,0);g.lineTo(tip.x*this.selectionRadius,tip.y*this.selectionRadius);g.stroke();
        g.fillColor=colour(CLUB.cushion);g.circle(tip.x*this.selectionRadius,tip.y*this.selectionRadius,7*s);g.fill();g.stroke();
        text(this.axes[0],'高杆',0,cy+110*s,60*s,11,true);text(this.axes[1],'低杆',0,cy-110*s,60*s,11,true);
        text(this.axes[2],'左塞',-w/2+32*s,cy,60*s,11,true);text(this.axes[3],'右塞',w/2-32*s,cy,60*s,11,true);
        text(this.summary,tipLabel(tip),0,cy-142*s,w-32*s,14);
        text(this.hint,'相对选择范围的偏移量',0,cy-166*s,w-32*s,10,true);
        const button=(label:Label,x:number,y:number,bw:number,title:string,primary=false):void=>{
            const n=label.node.parent!;n.setPosition(x,y,0);n.getComponent(UITransform)!.setContentSize(bw,48*s);
            const g=n.getComponent(Graphics)!;g.clear();g.fillColor=colour(primary?CLUB.gold:CLUB.background);
            g.roundRect(-bw/2,-24*s,bw,48*s,12*s);g.fill();
            text(label,title,0,0,bw-12*s,14);label.color=colour(primary?CLUB.background:CLUB.ink);
        };
        button(this.cancel,w/2-44*s,h/2-40*s,64*s,'取消');
        const inner=w-48*s,resetWidth=inner*.36,doneWidth=inner-resetWidth-12*s;
        button(this.center,-w/2+24*s+resetWidth/2,-h/2+40*s,resetWidth,'复位中杆');
        button(this.done,w/2-24*s-doneWidth/2,-h/2+40*s,doneWidth,'完成',true);
    }
}
