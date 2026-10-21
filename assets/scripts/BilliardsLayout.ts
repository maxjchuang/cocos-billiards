/** UI-space rectangles, measured from the top-left of the full HUD camera. */
export interface HudRect { x: number; y: number; width: number; height: number; }
export interface HudLayout {
    width: number; height: number; scale: number;
    status: HudRect; reset: HudRect; players: [HudRect, HudRect];
    playArea: HudRect; dock: HudRect; decision: HudRect; actions: HudRect; power: HudRect;
}

/** Reserve header and control space first; the 3D camera fits only inside what remains. */
export function computeHudLayout(width: number, height: number): HudLayout {
    const scale = Math.max(0.6, Math.min(1, height / width / 1.7));
    const margin = 32 * scale, gap = 12 * scale, pad = 16 * scale;
    const innerWidth = width - margin * 2;
    const status = { x: margin, y: margin, width: innerWidth - 152 * scale, height: 76 * scale };
    const reset = { x: width - margin - 140 * scale, y: margin, width: 140 * scale, height: 76 * scale };
    const playerWidth = (innerWidth - gap) / 2;
    const players: [HudRect, HudRect] = [0, 1].map(index => ({
        x: margin + index * (playerWidth + gap), y: margin + 88 * scale,
        width: playerWidth, height: 76 * scale,
    })) as [HudRect, HudRect];
    const dock = { x: margin, y: height - margin - 320 * scale, width: innerWidth, height: 320 * scale };
    const decision = { x: dock.x + pad, y: dock.y + pad, width: dock.width - pad * 2, height: 72 * scale };
    const actions = { x: decision.x, y: decision.y + decision.height + gap, width: decision.width, height: 104 * scale };
    const power = { x: decision.x, y: actions.y + actions.height + gap, width: decision.width, height: 88 * scale };
    const top = players[0].y + players[0].height + pad;
    const playArea = { x: margin, y: top, width: innerWidth, height: dock.y - pad - top };
    return { width, height, scale, status, reset, players, playArea, dock, decision, actions, power };
}
