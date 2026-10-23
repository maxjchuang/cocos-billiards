/** UI-space rectangles, measured from the top-left of the full HUD camera. */
export interface HudRect { x: number; y: number; width: number; height: number; }
export interface SafeInsets { top: number; right: number; bottom: number; left: number; }
export interface HudLayout {
    width: number; height: number; scale: number;
    status: HudRect; reset: HudRect; players: [HudRect, HudRect]; turn: HudRect;
    playArea: HudRect; dock: HudRect; decision: HudRect; actions: HudRect; power: HudRect; shoot: HudRect; fineButton: HudRect; fine: HudRect; spinButton: HudRect;
}
export interface HudOptions { insets?: Partial<SafeInsets>; showPower?: boolean; actionCount?: number; showShot?: boolean; showFine?: boolean; showDecision?:boolean; }

/** A shrunken embedded preview still lays out a complete mobile frame.
 * Physical pixels per HUD unit may differ from device DPR when the preview is zoomed.
 * Mobile acceptance targets begin at 320 CSS pixels; smaller frames are scaled presentations.
 */
export function computeHudViewport(pixelWidth:number,pixelHeight:number,deviceDpr:number):{width:number;height:number;pixelRatio:number} {
    const dpr=Math.max(1,deviceDpr||1),cssWidth=pixelWidth/dpr,cssHeight=pixelHeight/dpr;
    const zoom=cssWidth>0&&cssWidth<320&&cssHeight>cssWidth?320/cssWidth:1;
    return {width:cssWidth*zoom,height:cssHeight*zoom,pixelRatio:dpr/zoom};
}

/** Frozen reference layout. Short screens compress the table, never the touch targets. */
export function computeHudLayout(width:number,height:number,options:HudOptions={}):HudLayout {
    const compact=height<700;const s=1,scale=1,inset=options.insets??{},left=Math.max(0,inset.left??0),right=Math.max(0,inset.right??0);
    const top=Math.max(0,inset.top??0),bottom=Math.max(0,inset.bottom??0),innerWidth=width-left-right-40;
    const reset={x:left+14,y:top,width:44,height:44};
    const status={x:left+68,y:top+8,width:Math.max(44,innerWidth-100),height:24};
    const gap=11,playerWidth=(innerWidth-gap)/2;
    const players=[0,1].map(i=>({x:left+20+i*(playerWidth+gap),y:top+(compact?46:52),width:playerWidth,height:compact?64:74})) as [HudRect,HudRect];
    const turn={x:left+20,y:top+(compact?114:128),width:innerWidth,height:24};
    const count=options.actionCount??1,showPower=options.showPower??true,showShot=options.showShot??showPower;
    const sideWidth=width<360?68:76,buttonGap=width<360?8:12,controlMargin=width<360?20:24,controlWidth=width-left-right-controlMargin*2;
    const buttonY=height-bottom-52;
    const fineButton={x:left+controlMargin,y:buttonY,width:sideWidth,height:48};
    const spinButton={x:width-right-controlMargin-sideWidth,y:buttonY,width:sideWidth,height:48};
    const shoot={x:fineButton.x+sideWidth+buttonGap,y:buttonY,width:controlWidth-2*sideWidth-2*buttonGap,height:48};
    const power={x:left+controlMargin,y:buttonY-63,width:controlWidth,height:showPower?48:0};
    const fine={x:left+controlMargin,y:power.y-52,width:controlWidth,height:options.showFine?44:0};
    const actionsHeight=count===3?160:count===2&&!showPower?60:count>0?48:0;
    const decisionHeight=options.showDecision===false?0:!showPower&&count===1?48:40;
    const bottomAnchor=showShot?power.y-(options.showFine?52:0):buttonY+48;
    const actions={x:left+controlMargin,y:count===2&&!showPower?height-bottom-80:bottomAnchor-actionsHeight-(showShot&&actionsHeight?8:0),width:controlWidth,height:actionsHeight};
    const decision={x:left+controlMargin,y:count===1&&!showPower?height-bottom-115:count===2&&!showPower?actions.y-44.5:actions.y-(decisionHeight?decisionHeight+8:0),width:controlWidth,height:decisionHeight};
    const dock={x:left+20,y:decision.y,width:innerWidth,height:height-bottom-4-decision.y};
    const tableTop=turn.y+turn.height+(compact?10:12);
    const playArea={x:left+20,y:tableTop,width:innerWidth,height:Math.max(1,Math.min(476,dock.y-tableTop-(count===2&&!showPower?4:8)))};
    return {width,height,scale,status,reset,players,turn,playArea,dock,decision,actions,power,shoot,fineButton,fine,spinButton};
}
