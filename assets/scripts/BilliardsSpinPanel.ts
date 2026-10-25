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
            const n=node(name,this.panel);const label=n.addComponent(Label);label.fontFamily=CLUB.fontFamily;
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
        const h=Math.min(496*s,height-top-8*s),w=Math.min(width,430*s);
        const colour=(hex:string):Color=>new Color().fromHEX(hex);
        const dim=this.node.getComponent(Graphics)!;dim.clear();dim.fillColor=new Color(5,16,12,163);
        dim.rect(-width/2,-height/2,width,height);dim.fill();
        this.node.getComponent(UITransform)!.setContentSize(width,height);
        this.panel.setPosition(0,-height/2+h/2,0);this.panel.getComponent(UITransform)!.setContentSize(w,h);
        const bg=this.panel.getComponent(Graphics)!;bg.clear();bg.fillColor=colour(CLUB.surface);
        bg.roundRect(-w/2,-h/2,w,h,24*s);bg.fill();
        bg.fillColor=colour(CLUB.muted);bg.roundRect(-18,h/2-14,36,4,2);bg.fill();
        const text=(label:Label,value:string,x:number,y:number,tw:number,size:number,muted=false):void=>{
            label.string=value;label.fontSize=size*s;label.lineHeight=(size+5)*s;
            label.color=colour(muted?CLUB.muted:CLUB.ink);label.node.setPosition(x,y,0);label.horizontalAlign=Label.HorizontalAlign.CENTER;
            label.node.getComponent(UITransform)!.setContentSize(tw,(size+8)*s);
        };
        text(this.title,'母球打点',-w/2+100*s,h/2-45*s,152*s,22);this.title.horizontalAlign=Label.HorizontalAlign.LEFT;
        text(this.subtitle,'沿球杆看向母球 · 与屏幕方位无关',0,h/2-75*s,w-48*s,12,true);this.subtitle.horizontalAlign=Label.HorizontalAlign.LEFT;
        const cy=h/2-216*s;
        this.surface.setPosition(0,cy,0);this.surface.getComponent(UITransform)!.setContentSize(208*s,208*s);
        this.selectionRadius=60*s;
        const g=this.face;g.clear();g.fillColor=colour('#D5CEBA');g.circle(0,0,88*s);g.fill();for(let i=0;i<12;i++){g.fillColor=new Color(255,253,244,14);g.circle(-i*.5*s,i*.6*s,(87-i*2)*s);g.fill();}
        g.fillColor=new Color(120,139,114,20);g.circle(0,0,this.selectionRadius);g.fill();
        g.lineWidth=1*s;g.strokeColor=colour('#728475');for(let a=0;a<Math.PI*2;a+=.14){g.arc(0,0,this.selectionRadius,a,a+.08,false);g.stroke();}
        g.strokeColor=colour('#728475');for(let i=-60;i<60;i+=8){g.moveTo(i,0);g.lineTo(i+4,0);g.moveTo(0,i);g.lineTo(0,i+4);g.stroke();}
        g.fillColor=colour(CLUB.muted);g.circle(0,0,3*s);g.fill();
        g.strokeColor=colour(CLUB.gold);g.moveTo(0,0);g.lineTo(tip.x*this.selectionRadius,tip.y*this.selectionRadius);g.stroke();
        g.fillColor=colour(CLUB.cushion);g.strokeColor=colour(CLUB.gold);g.lineWidth=2*s;g.circle(tip.x*this.selectionRadius,tip.y*this.selectionRadius,8*s);g.fill();g.stroke();
        text(this.axes[0],'高杆',0,cy+108.5*s,60*s,13,true);text(this.axes[1],'低杆',0,cy-108.5*s,60*s,13,true);
        text(this.axes[2],'左塞',-w/2+67*s,cy,60*s,13,true);text(this.axes[3],'右塞',w/2-67*s,cy,60*s,13,true);this.axes.forEach(label=>label.color=colour(CLUB.gold));
        text(this.summary,tipLabel(tip),0,cy-146.5*s,w-32*s,15);
        text(this.hint,'虚线圆内选择 · 百分比表示打点偏移',0,cy-170*s,w-32*s,11,true);
        const button=(label:Label,x:number,y:number,bw:number,title:string,primary=false):void=>{
            const n=label.node.parent!;n.setPosition(x,y,0);n.getComponent(UITransform)!.setContentSize(bw,48*s);
            const g=n.getComponent(Graphics)!;g.clear();g.fillColor=colour(primary?CLUB.gold:CLUB.background);
            g.roundRect(-bw/2,-24*s,bw,48*s,12*s);g.fill();
            text(label,title,0,0,bw-12*s,16);label.color=colour(primary?CLUB.background:CLUB.ink);
        };
        button(this.cancel,w/2-44*s,h/2-40*s,64*s,'取消');this.cancel.node.parent!.getComponent(Graphics)!.clear();this.cancel.fontSize=14;this.cancel.color=colour(CLUB.muted);this.cancel.horizontalAlign=Label.HorizontalAlign.RIGHT;this.cancel.node.getComponent(UITransform)!.setContentSize(40,22);
        const inner=w-48*s,resetWidth=122*s,doneWidth=inner-resetWidth-12*s;
        button(this.center,-w/2+24*s+resetWidth/2,-h/2+bottom+28*s,resetWidth,'复位中杆');
        button(this.done,w/2-24*s-doneWidth/2,-h/2+bottom+28*s,doneWidth,'完成',true);
    }
}
