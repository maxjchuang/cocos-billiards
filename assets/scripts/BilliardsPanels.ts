import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
import { drawAvatar } from './BilliardsPlayerCard';
import { CLUB } from './BilliardsTheme';
export type PanelMode='pause'|'confirm'|'settings'|'rules'|'identity'|'result'|'view'|'rotate'|'break'|'new-game'|'ai-options';
export interface PanelAction { id:string; title:string; primary?:boolean; checked?:boolean; }
export interface PanelModel { mode:PanelMode|null; title:string; body:string; actions:PanelAction[]; avatar?:string;pressed?:number; }
/** One modal surface with stable buttons. No referee or shot mutation occurs here. */
export class PanelsView {
    readonly node:Node;readonly card:Node;readonly title:Label;readonly body:Label;
    readonly buttons:Label[]=[];actionIds:string[]=[];
    private stamp='';
    private descriptions:Label[]=[];
    private footer:Label;
    constructor(parent:Node){
        const node=(name:string,p=parent):Node=>{const n=new Node(name);n.layer=Layers.Enum.UI_2D;p.addChild(n);n.addComponent(UITransform);return n;};
        this.node=node('Application modal');this.node.addComponent(Graphics);
        this.card=node('Modal card',this.node);this.card.addComponent(Graphics);
        const label=(name:string,p:Node):Label=>{const n=node(name,p),l=n.addComponent(Label);l.fontFamily=CLUB.fontFamily;l.color=new Color().fromHEX(CLUB.ink);l.overflow=Label.Overflow.SHRINK;return l;};
        this.title=label('Modal title',this.card);this.body=label('Modal body',this.card);this.footer=label('Modal footer',this.card);
        this.body.horizontalAlign=Label.HorizontalAlign.LEFT;
        for(let i=0;i<8;i++){const n=node('Modal action '+i,this.card);n.addComponent(Graphics);this.buttons.push(label('Modal label '+i,n));this.descriptions.push(label('Action description '+i,n));}
        this.node.active=false;
    }
    render(width:number,height:number,bottom:number,model:PanelModel):void{
        this.node.active=!!model.mode;if(!model.mode)return;
        const stamp=JSON.stringify([width,height,bottom,model]);if(stamp===this.stamp)return;this.stamp=stamp;
        const color=(s:string):Color=>new Color().fromHEX(s),overlay=this.node.getComponent(Graphics)!;
        overlay.clear();overlay.fillColor=model.mode==='rotate'?new Color(0,0,0,255):new Color(5,16,12,model.mode==='view'?0:163);
        overlay.rect(-width/2,-height/2,width,height);overlay.fill();this.node.getComponent(UITransform)!.setContentSize(width,height);
        const view=model.mode==='view',rotation=model.mode==='rotate',w=model.mode==='rules'||model.mode==='break'?width:Math.min(model.mode==='settings'?345:331,width-48),available=height-bottom-32;
        const h=Math.min(available,model.mode==='new-game'?500:model.mode==='pause'?(model.actions.some(a=>a.id==='ai-options')?490:436):model.mode==='result'?314:model.mode==='confirm'?314:model.mode==='settings'?568:model.mode==='rules'?558:model.mode==='break'?383:model.mode==='identity'?420:Math.max(420,Math.min(660,available)));
        this.card.active=true;let cardY=view?height/2-72:model.mode==='pause'?-9:4;
        if(model.mode==='rules'||model.mode==='break')cardY=-height/2+h/2;
        if(model.mode==='settings'){const top=Math.max(8,Math.min(height-bottom-h-8,(height-h)/2+48));cardY=height/2-top-h/2;}
        this.card.setPosition(0,cardY,0);
        this.card.getComponent(UITransform)!.setContentSize(w,view?56:h);
        const bg=this.card.getComponent(Graphics)!;bg.clear();
        if(!view){bg.fillColor=color(CLUB.surface);bg.roundRect(-w/2,-h/2,w,h,24);bg.fill();}
        this.title.node.active=!view;this.body.node.active=!view;
        this.title.string=model.title;this.title.fontSize=model.mode==='result'?26:model.mode==='rules'?23:model.mode==='break'?22:24;this.title.lineHeight=28;this.title.isBold=false;this.title.horizontalAlign=model.mode==='settings'||model.mode==='rules'||model.mode==='break'?Label.HorizontalAlign.LEFT:Label.HorizontalAlign.CENTER;
        this.title.node.setPosition(0,h/2-(model.mode==='result'?110:model.mode==='break'?54:42),0);this.title.node.getComponent(UITransform)!.setContentSize(w-48,44);
        if(model.mode==='identity')drawAvatar(bg,0,h/2-108,24,model.avatar??'default');
        this.footer.node.active=model.mode==='pause'||model.mode==='rules';this.footer.string=model.mode==='rules'?(model.title==='音频署名'?'音效方案 A · 来源与授权':'中台协2017年1月修订版 · 核心规则'):'当前球局保持';this.footer.horizontalAlign=model.mode==='rules'?Label.HorizontalAlign.LEFT:Label.HorizontalAlign.CENTER;this.footer.fontSize=11;this.footer.color=color(CLUB.muted);this.footer.node.setPosition(0,h/2-(model.mode==='rules'?66.5:model.actions.some(a=>a.id==='ai-options')?454:400),0);this.footer.node.getComponent(UITransform)!.setContentSize(w-48,20);
        this.body.color=color(model.mode==='result'&&/提前|犯规|判负/.test(model.body)?CLUB.loss:CLUB.ink);this.body.string=model.body;this.body.fontSize=14;this.body.lineHeight=22;this.body.enableWrapText=true;this.body.verticalAlign=model.mode==='rules'||model.mode==='identity'?Label.VerticalAlign.TOP:Label.VerticalAlign.CENTER;
        const count=model.actions.length,bottomButtons=model.actions.filter(a=>a.id!=='cancel-match').length*54,bodyH=Math.max(38,h-110-bottomButtons);
        this.body.node.setPosition(0,h/2-88-bodyH/2,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,bodyH);
        if(model.mode==='identity'){this.body.node.setPosition(0,-28,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,180);}
        if(model.mode==='pause'){this.body.fontSize=12;this.body.horizontalAlign=Label.HorizontalAlign.CENTER;this.body.node.setPosition(0,h/2-77,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,22);}
        if(model.mode==='result'){this.body.fontSize=13;this.body.horizontalAlign=Label.HorizontalAlign.CENTER;this.body.node.setPosition(0,h/2-150.5,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,40);bg.fillColor=color(CLUB.gold);bg.circle(0,h/2-60,26);bg.fill();bg.strokeColor=color(CLUB.background);bg.lineWidth=2;bg.moveTo(-9,h/2-60);bg.lineTo(-2,h/2-67);bg.lineTo(11,h/2-52);bg.stroke();}
        if(model.mode==='confirm'){this.body.fontSize=13;this.body.horizontalAlign=Label.HorizontalAlign.CENTER;this.body.node.setPosition(0,h/2-85.5,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,40);}
        if(model.mode==='settings'){this.body.fontSize=11;this.body.node.setPosition(0,-h/2+30,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,44);}
        if(model.mode==='break'){this.body.fontSize=12;this.body.lineHeight=27;this.body.node.setPosition(0,h/2-98,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,70);}
        if(model.mode==='rules'){this.body.fontSize=12;this.body.lineHeight=18;this.body.node.setPosition(0,0,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,h-172);}
        this.actionIds=model.actions.map(a=>a.id);
        this.buttons.forEach((label,i)=>{
            const a=model.actions[i],n=label.node.parent!;n.active=!!a;if(!a)return;
            let bw=w-48,bh=48,x=0,y=view?0:-h/2+32+(count-1-i)*54,plain=false;
            if(model.mode==='pause'){
                const top=a.id==='resume'?108:a.id==='rules'?170:a.id==='new-game'?294:a.id==='ai-options'?356:232;y=h/2-top-24;
                if(a.id==='settings'||a.id==='restart'){bw=(w-59)/2;x=(a.id==='settings'?-1:1)*(bw/2+5.5);}
            }
            if(model.mode==='new-game'){
                if(a.id==='cancel-match'){plain=true;bw=64;bh=44;x=w/2-48;y=h/2-38;}
                else{const rows=model.actions.filter(a=>a.id!=='cancel-match');y=-h/2+32+(rows.length-1-rows.findIndex(r=>r.id===a.id))*54;}
            }
            if(model.mode==='break')y=h/2-(165+i*64);
            if(model.mode==='confirm')y=h/2-(a.id==='cancel-restart'?163:225);
            if(model.mode==='result'){y=h/2-(a.id==='new-round'?213:273);if(a.id==='view-table'){plain=true;bh=44;}}
            if(model.mode==='settings'){
                if(a.checked!==undefined){y=h/2-(98+i*84);bh=68;}
                else{plain=true;bw=64;bh=44;x=w/2-56;y=h/2-39;}
            }
            if(model.mode==='rules'){
                if(a.id==='back-pause'){plain=true;bw=64;bh=44;x=w/2-56;y=h/2-40;}
                else{const n=model.actions.filter(a=>a.id!=='back-pause').length;bw=(w-48-(n-1)*8)/n;x=-(w-48)/2+bw/2+i*(bw+8);y=-h/2+38;}
            }
            n.setPosition(x,y,0);n.getComponent(UITransform)!.setContentSize(bw,bh);
            const g=n.getComponent(Graphics)!;g.clear();g.fillColor=color(model.pressed===i?a.primary?'#CCB276':'#314A3D':a.primary?CLUB.gold:CLUB.surface);
            g.strokeColor=color('#395044');g.lineWidth=1;
            if(!plain){g.roundRect(-bw/2,-bh/2,bw,bh,12);g.fill();if(!a.primary&&a.checked===undefined)g.stroke();}
            label.string=a.title;label.fontSize=plain?14:16;label.lineHeight=22;label.isBold=false;label.horizontalAlign=Label.HorizontalAlign.CENTER;label.node.setPosition(0,0,0);
            label.color=color(!plain&&a.primary?CLUB.background:a.id==='view-table'?CLUB.muted:CLUB.ink);label.node.getComponent(UITransform)!.setContentSize(bw-16,40);
            const desc=this.descriptions[i];desc.node.active=model.mode==='settings'&&a.checked!==undefined;
            if(desc.node.active){
                label.horizontalAlign=Label.HorizontalAlign.LEFT;label.node.setPosition(0,4,0);label.node.getComponent(UITransform)!.setContentSize(bw,30);
                desc.string=['击球、碰库与落袋声音','出杆与重要结果的轻反馈','显示基础方向线','瞄准与微调时显示接触点','简化位移，保留触球同步'][i];
                desc.fontSize=11;desc.horizontalAlign=Label.HorizontalAlign.LEFT;desc.color=color(CLUB.muted);desc.node.setPosition(0,-21.5,0);desc.node.getComponent(UITransform)!.setContentSize(bw,22);
                g.fillColor=color(a.checked?CLUB.gold:CLUB.track);g.roundRect(bw/2-44,-12,44,24,12);g.fill();
                g.fillColor=color(a.checked?CLUB.background:CLUB.muted);g.circle(bw/2-(a.checked?12:32),0,9);g.fill();
            }

        });
    }
}
