import { Color, Graphics, Label, Layers, Node, UITransform, UIOpacity } from 'cc';
import { drawAvatar } from './BilliardsPlayerCard';
import { CLUB } from './BilliardsTheme';
export type PanelMode='pause'|'confirm'|'settings'|'rules'|'identity'|'result'|'view'|'rotate'|'break'|'new-game'|'ai-options';
export interface PanelAction { id:string; title:string; primary?:boolean; checked?:boolean; selected?:boolean; value?:string; }
export interface PanelModel { mode:PanelMode|null; title:string; body:string; actions:PanelAction[]; avatar?:string;pressed?:number; detail?:string; caption?:string; targetIds?:number[]; }
/** One modal surface with stable buttons. No referee or shot mutation occurs here. */
export class PanelsView {
    readonly node:Node;readonly identityTarget:Node;readonly card:Node;readonly title:Label;readonly body:Label;
    readonly buttons:Label[]=[];actionIds:string[]=[];
    private stamp='';
    private descriptions:Label[]=[];
    private footer:Label;
    private section:Label;private subSection:Label;private detail:Label;private badge:Label;private targetLabels:Label[]=[];
    private previousMode:PanelMode|null=null;private motion=1;private baseY=0;private opacity:UIOpacity;
    constructor(parent:Node){
        const node=(name:string,p=parent):Node=>{const n=new Node(name);n.layer=Layers.Enum.UI_2D;p.addChild(n);n.addComponent(UITransform);return n;};
        this.node=node('Application modal');this.node.addComponent(Graphics);
        this.card=node('Modal card',this.node);this.identityTarget=node('Winner identity target',this.card);this.card.addComponent(Graphics);this.opacity=this.card.addComponent(UIOpacity);
        const label=(name:string,p:Node):Label=>{const n=node(name,p),l=n.addComponent(Label);l.fontFamily=CLUB.fontFamily;l.color=new Color().fromHEX(CLUB.ink);l.overflow=Label.Overflow.SHRINK;return l;};
        this.title=label('Modal title',this.card);this.body=label('Modal body',this.card);this.footer=label('Modal footer',this.card);
        this.body.horizontalAlign=Label.HorizontalAlign.LEFT;
        this.section=label('Modal section',this.card);this.subSection=label('Modal sub section',this.card);this.detail=label('Modal detail',this.card);this.badge=label('Result emblem',this.card);for(let i=0;i<7;i++)this.targetLabels.push(label('Identity target '+i,this.card));
        for(let i=0;i<8;i++){const n=node('Modal action '+i,this.card);n.addComponent(Graphics);this.buttons.push(label('Modal label '+i,n));this.descriptions.push(label('Action description '+i,n));}
        this.node.active=false;
    }
    render(width:number,height:number,bottom:number,model:PanelModel):void{
        this.node.active=!!model.mode;if(!model.mode){this.previousMode=null;return;}
        if(model.mode!==this.previousMode){this.motion=0;this.previousMode=model.mode;}
        const stamp=JSON.stringify([width,height,bottom,model]);if(stamp===this.stamp)return;this.stamp=stamp;
        const color=(s:string):Color=>new Color().fromHEX(s),overlay=this.node.getComponent(Graphics)!;
        overlay.clear();overlay.fillColor=model.mode==='rotate'?new Color(0,0,0,255):new Color(4,16,12,model.mode==='view'?0:184);
        overlay.rect(-width/2,-height/2,width,height);overlay.fill();this.node.getComponent(UITransform)!.setContentSize(width,height);
        const view=model.mode==='view',rotation=model.mode==='rotate',w=model.mode==='rules'||model.mode==='break'?width:Math.min(345,width-48),available=height-bottom-32;
        const h=Math.min(available,model.mode==='new-game'?(model.actions.some(a=>a.id.startsWith('draft-level:'))?480:330):model.mode==='ai-options'?360:model.mode==='pause'?(model.actions.some(a=>a.id==='ai-options')?452:400):model.mode==='result'?398:model.mode==='confirm'?314:model.mode==='settings'?568:model.mode==='rules'?558:model.mode==='break'?383:model.mode==='identity'?480:Math.max(420,Math.min(660,available)));
        this.card.active=true;let cardY=view?height/2-72:model.mode==='pause'?-9:4;
        if(model.mode==='rules'||model.mode==='break')cardY=-height/2+h/2;
        if(model.mode==='settings'){const top=Math.max(8,Math.min(height-bottom-h-8,(height-h)/2+48));cardY=height/2-top-h/2;}
        this.baseY=cardY;this.card.setPosition(0,cardY,0);
        this.card.getComponent(UITransform)!.setContentSize(w,view?56:h);
        const bg=this.card.getComponent(Graphics)!;bg.clear();
        if(!view){bg.fillColor=color(CLUB.surface);bg.roundRect(-w/2,-h/2,w,h,22);bg.fill();bg.strokeColor=color('#3A4D3E');bg.lineWidth=.7;bg.stroke();}
        this.title.node.active=!view;this.body.node.active=!view;
        this.title.string=model.title;this.title.fontSize=22;this.title.lineHeight=28;this.title.isBold=false;this.title.horizontalAlign=model.mode==='result'||model.mode==='confirm'?Label.HorizontalAlign.CENTER:Label.HorizontalAlign.LEFT;
        this.title.node.setPosition(0,h/2-(model.mode==='result'?148:model.mode==='break'?54:42),0);this.title.node.getComponent(UITransform)!.setContentSize(w-48,44);
        if(model.mode==='identity')drawAvatar(bg,0,h/2-108,24,model.avatar??'default');
        this.footer.node.active=model.mode==='pause'||model.mode==='rules';this.footer.string=model.mode==='rules'?(model.title==='音频署名'?'音效方案 A · 来源与授权':'中台协2017年1月修订版 · 核心规则'):'当前球局保持';this.footer.horizontalAlign=model.mode==='rules'?Label.HorizontalAlign.LEFT:Label.HorizontalAlign.CENTER;this.footer.fontSize=11;this.footer.color=color(CLUB.muted);this.footer.node.setPosition(0,h/2-(model.mode==='rules'?66.5:h-22),0);this.footer.node.getComponent(UITransform)!.setContentSize(w-48,20);
        this.body.horizontalAlign=Label.HorizontalAlign.LEFT;
        this.body.color=color(model.mode==='result'&&/提前|犯规|判负/.test(model.body)?CLUB.loss:CLUB.ink);this.body.string=model.body;this.body.fontSize=14;this.body.lineHeight=22;this.body.enableWrapText=true;this.body.verticalAlign=model.mode==='rules'||model.mode==='identity'?Label.VerticalAlign.TOP:Label.VerticalAlign.CENTER;
        const count=model.actions.length,bottomButtons=model.actions.filter(a=>a.id!=='cancel-match').length*54,bodyH=Math.max(38,h-110-bottomButtons);
        this.body.node.setPosition(0,h/2-88-bodyH/2,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,bodyH);
        if(model.mode==='identity'){this.body.node.setPosition(0,-10,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,220);}
        if(model.mode==='pause'){this.body.fontSize=12;this.body.horizontalAlign=Label.HorizontalAlign.LEFT;this.body.node.setPosition(0,h/2-72,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,22);}
        this.badge.node.active=model.mode==='result';this.identityTarget.active=model.mode==='result';this.identityTarget.setPosition(0,h/2-130,0);this.identityTarget.getComponent(UITransform)!.setContentSize(w-48,80);
        if(model.mode==='result'){
            const loss=/提前|犯规|判负/.test(model.body),accent=loss?CLUB.loss:CLUB.gold;
            this.body.fontSize=13;this.body.horizontalAlign=Label.HorizontalAlign.CENTER;this.body.node.setPosition(0,h/2-216,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,76);
            bg.fillColor=color('#293E2D');bg.strokeColor=color(accent);bg.lineWidth=1;bg.circle(0,h/2-60,30);bg.fill();bg.stroke();
            this.badge.string='8';this.badge.fontSize=27;this.badge.color=color(accent);this.badge.node.setPosition(0,h/2-60,0);this.badge.node.getComponent(UITransform)!.setContentSize(48,48);
        }
        if(model.mode==='confirm'){this.body.fontSize=13;this.body.horizontalAlign=Label.HorizontalAlign.CENTER;this.body.node.setPosition(0,h/2-85.5,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,40);}
        if(model.mode==='settings'){this.body.fontSize=11;this.body.node.setPosition(0,-h/2+30,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,44);}
        if(model.mode==='break'){this.body.fontSize=12;this.body.lineHeight=27;this.body.node.setPosition(0,h/2-98,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,70);}
        if(model.mode==='rules'){this.body.fontSize=12;this.body.lineHeight=18;this.body.node.setPosition(0,0,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,h-172);}
        const extra=(label:Label,value:string,y:number,size=12,center=false):void=>{
            label.node.active=!!value;label.string=value;label.color=color(CLUB.muted);label.fontSize=size;label.lineHeight=20;label.enableWrapText=true;label.horizontalAlign=center?Label.HorizontalAlign.CENTER:Label.HorizontalAlign.LEFT;
            label.node.setPosition(0,h/2-y,0);label.node.getComponent(UITransform)!.setContentSize(w-48,label===this.detail?70:24);
        };
        extra(this.section,'',0);extra(this.subSection,'',0);extra(this.detail,'',0);
        if(model.mode==='new-game'){
            this.body.fontSize=12;this.body.node.setPosition(0,h/2-76,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,28);
            this.body.color=color(CLUB.muted);extra(this.section,'对局方式',116);const ai=model.actions.some(a=>a.id.startsWith('draft-level:'));
            if(ai){extra(this.subSection,'陪练难度',216);extra(this.detail,model.detail??'',332,13);}
            extra(this.footer,model.caption??'你先开球 · 单局对战',h-104);this.footer.node.active=true;
        }
        if(model.mode==='ai-options'){
            this.body.node.setPosition(0,h/2-102,0);this.body.node.getComponent(UITransform)!.setContentSize(w-48,80);this.body.fontSize=12;
            extra(this.detail,model.detail??'',236,13);
        }
        if(model.mode==='result'){extra(this.section,model.caption??'',112,14,true);this.section.color=color(CLUB.gold);}
        this.targetLabels.forEach((label,i)=>{const id=model.mode==='identity'?model.targetIds?.[i]:undefined;label.node.active=id!==undefined;if(id===undefined)return;
            const x=(i-((model.targetIds?.length??1)-1)/2)*32,y=-h/2+92;
            bg.fillColor=color('#F4F0E6');bg.circle(x,y,13);bg.fill();label.string=String(id);label.fontSize=12;label.color=color(CLUB.background);label.node.setPosition(x,y,0);label.node.getComponent(UITransform)!.setContentSize(26,26);
        });
        this.actionIds=model.actions.map(a=>a.id);
        this.buttons.forEach((label,i)=>{
            const a=model.actions[i],n=label.node.parent!;n.active=!!a;if(!a)return;
            let bw=w-48,bh=48,x=0,y=view?0:-h/2+32+(count-1-i)*54,plain=false;
            if(model.mode==='pause'){
                const ai=model.actions.some(a=>a.id==='ai-options');
                const rows=ai?['ai-options','new-game','settings','rules']:['new-game','settings','rules'];
                y=h/2-(a.id==='resume'?112:a.id==='restart'?h-65:170+rows.indexOf(a.id)*52);
                plain=a.id!=='resume';bh=a.id==='restart'?44:48;
            }
            if(model.mode==='new-game'||model.mode==='ai-options'){
                if(a.id==='cancel-match'){plain=true;bw=64;bh=44;x=w/2-44;y=h/2-38;}
                else if(a.id.startsWith('mode:')){bw=(w-56)/2;x=(a.id==='mode:ai'?-1:1)*(bw/2+4);y=h/2-158;bh=44;}
                else if(a.id.startsWith('draft-level:')||a.id.startsWith('ai-level:')){
                    const index=['easy','standard','hard'].indexOf(a.id.split(':')[1]);bw=(w-64)/3;x=(index-1)*(bw+8);y=h/2-(model.mode==='new-game'?258:174);bh=44;
                }else y=-h/2+48;
            }
            if(model.mode==='break')y=h/2-(165+i*64);
            if(model.mode==='confirm')y=h/2-(a.id==='cancel-restart'?163:225);
            if(model.mode==='result'){y=h/2-(a.id==='new-round'?h-96:h-40);if(a.id==='view-table'){plain=true;bh=44;}}
            if(model.mode==='settings'){
                if(a.checked!==undefined){y=h/2-(98+i*84);bh=68;}
                else{plain=true;bw=64;bh=44;x=w/2-56;y=h/2-39;}
            }
            if(model.mode==='rules'){
                if(a.id==='back-pause'){plain=true;bw=64;bh=44;x=w/2-56;y=h/2-40;}
                else{const n=model.actions.filter(a=>a.id!=='back-pause').length;bw=(w-48-(n-1)*8)/n;x=-(w-48)/2+bw/2+i*(bw+8);y=-h/2+38;}
            }
            n.setPosition(x,y,0);n.getComponent(UITransform)!.setContentSize(bw,bh);
            const g=n.getComponent(Graphics)!;g.clear();g.fillColor=color(model.pressed===i?a.primary?'#CCB276':'#314A3D':a.primary?CLUB.gold:a.selected?'#3A4C3B':CLUB.surface);
            g.strokeColor=color(a.selected?'#8D7855':'#405247');g.lineWidth=1;
            if(!plain){g.roundRect(-bw/2,-bh/2,bw,bh,12);g.fill();if(a.checked===undefined){if(a.primary)g.strokeColor=color('#E5D1A5');g.stroke();}}
            label.string=a.title;label.fontSize=plain?14:model.mode==='new-game'||model.mode==='ai-options'?13:16;label.lineHeight=22;label.isBold=false;label.horizontalAlign=Label.HorizontalAlign.CENTER;label.node.setPosition(0,0,0);
            label.color=color(!plain&&a.primary?CLUB.background:a.id==='view-table'?CLUB.muted:CLUB.ink);label.node.getComponent(UITransform)!.setContentSize(bw-16,40);
            if(model.mode==='pause'&&a.id!=='resume'&&a.id!=='restart'){label.horizontalAlign=Label.HorizontalAlign.LEFT;label.node.getComponent(UITransform)!.setContentSize(bw,36);g.strokeColor=color('#35473B');g.moveTo(-bw/2,-24);g.lineTo(bw/2,-24);g.stroke();}
            const desc=this.descriptions[i];desc.node.active=model.mode==='settings'&&a.checked!==undefined;
            if(model.mode==='pause'&&a.value){desc.node.active=true;desc.string=a.value;desc.fontSize=12;desc.color=color(CLUB.muted);desc.horizontalAlign=Label.HorizontalAlign.RIGHT;desc.node.setPosition(bw/2-60,0,0);desc.node.getComponent(UITransform)!.setContentSize(120,32);label.node.setPosition(-60,0,0);label.node.getComponent(UITransform)!.setContentSize(bw-120,36);}
            if(model.mode==='settings'&&desc.node.active){
                label.horizontalAlign=Label.HorizontalAlign.LEFT;label.node.setPosition(0,4,0);label.node.getComponent(UITransform)!.setContentSize(bw-52,30);label.node.setPosition(-26,4,0);
                desc.string=['击球、碰库与落袋声音','出杆与重要结果的轻反馈','母球与目标球轨迹及预计停点','瞄准与微调时显示接触点','简化位移，保留触球同步'][i];
                desc.fontSize=12;desc.horizontalAlign=Label.HorizontalAlign.LEFT;desc.color=color(CLUB.muted);desc.node.setPosition(0,-21.5,0);desc.node.getComponent(UITransform)!.setContentSize(bw,22);
                g.fillColor=color(a.checked?CLUB.gold:CLUB.track);g.roundRect(bw/2-44,-12,44,24,12);g.fill();
                g.fillColor=color(a.checked?CLUB.background:CLUB.muted);g.circle(bw/2-(a.checked?12:32),0,9);g.fill();
            }

        });
    }
    advance(dt:number,reduced=false):void {
        if(!this.node.active)return;this.motion=reduced?1:Math.min(1,this.motion+Math.max(0,dt)/.18);
        const ease=1-(1-this.motion)**3;this.opacity.opacity=Math.round(255*(.7+.3*ease));this.card.setPosition(0,this.baseY-4*(1-ease),0);
    }
}
