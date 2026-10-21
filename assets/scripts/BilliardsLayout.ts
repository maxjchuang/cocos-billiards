/** UI-space rectangles, measured from the top-left of the full HUD camera. */
export interface HudRect { x: number; y: number; width: number; height: number; }
export interface SafeInsets { top: number; right: number; bottom: number; left: number; }
export interface HudLayout {
    width: number; height: number; scale: number;
    status: HudRect; reset: HudRect; players: [HudRect, HudRect]; turn: HudRect;
    playArea: HudRect; dock: HudRect; decision: HudRect; actions: HudRect; power: HudRect; shoot: HudRect; fineButton: HudRect; fine: HudRect; spinButton: HudRect;
}
export interface HudOptions { insets?: Partial<SafeInsets>; showPower?: boolean; actionCount?: number; showShot?: boolean; showFine?: boolean; }

/** Reserve touch-sized controls first; shrink decorative spacing on short portrait screens. */
export function computeHudLayout(width: number, height: number, options: HudOptions = {}): HudLayout {
    const scale = Math.min(1, width / 320, height / 568);
    const s = scale, gap = 8*s, margin = 20*s;
    const inset = options.insets ?? {};
    const left = Math.max(0, inset.left ?? 0), right = Math.max(0, inset.right ?? 0);
    const top = Math.max(0, inset.top ?? 0), bottom = Math.max(0, inset.bottom ?? 0);
    const innerWidth = width - left - right - margin*2;
    const reset = { x: left + margin, y: top + gap, width: 44*s, height: 44*s };
    // Keep the upper right free for the host menu. No fake host capsule is drawn.
    const status = { x: reset.x + 56*s, y: reset.y, width: Math.max(44*s, innerWidth - 152*s), height: 44*s };
    const playerWidth = (innerWidth - gap) / 2;
    const players: [HudRect, HudRect] = [0, 1].map(index => ({
        x: left + margin + index * (playerWidth + gap), y: reset.y + 52*s,
        width: playerWidth, height: 74*s,
    })) as [HudRect, HudRect];
    const turn = { x: left+margin, y: players[0].y + players[0].height + 4*s, width: innerWidth, height: 24*s };
    const count = options.actionCount ?? 1;
    const showPower = options.showPower ?? true;
    const actionHeight = count === 3 ? 172*s : count > 0 ? 48*s : 0;
    const powerHeight = showPower ? 64*s : 0;
    const decisionHeight = (count === 3 ? 48 : 40)*s;
    const extraHeight = (options.showShot ? 56*s : 0)+(options.showFine ? 52*s : 0);
    const dockHeight = extraHeight + decisionHeight + actionHeight + powerHeight + (count > 0 ? gap : 0) + (showPower ? gap : 0) + gap*2;
    const dock = { x: left+margin, y: height-bottom-gap-dockHeight, width: innerWidth, height: dockHeight };
    const decision = { x: dock.x, y: dock.y+gap, width: innerWidth, height: decisionHeight };
    const actions = { x: dock.x, y: decision.y+decisionHeight+(count>0?gap:0), width: innerWidth, height: actionHeight };
    const fine = { x: dock.x, y: actions.y+actionHeight+gap, width: innerWidth, height: options.showFine?44*s:0 };
    const power = { x: dock.x, y: actions.y+actionHeight+(showPower?gap:0)+(options.showFine?52*s:0), width: innerWidth, height: powerHeight };
    const fineButton = { x:dock.x, y:power.y+power.height+gap, width:76*s, height:48*s };
    const sideWidth=(width<360?68:76)*s,buttonGap=(width<360?8:12)*s;
    fineButton.width=sideWidth;
    const spinButton={x:dock.x+innerWidth-sideWidth,y:fineButton.y,width:sideWidth,height:48*s};
    const shoot = { x:dock.x+sideWidth+buttonGap, y:fineButton.y, width:innerWidth-2*sideWidth-2*buttonGap, height:48*s };
    const tableTop = turn.y+turn.height+gap;
    const playArea = { x: left+margin, y: tableTop, width: innerWidth, height: dock.y-gap-tableTop };
    return { width, height, scale, status, reset, players, turn, playArea, dock, decision, actions, power, shoot, fineButton, fine, spinButton };
}
