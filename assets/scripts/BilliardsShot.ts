import { BallState, isMoving, strike } from './BilliardsPhysics';
import { Group, Player, Referee } from './BilliardsRules';

export const SHOT_TIMING = { backswing: 140, contact: 220, flightEnd: 480, holdEnd: 640, end: 820 } as const;
export interface ShotRequest {
    gameId: number; player: Player;
    direction: { x: number; z: number }; power: number;
    tipOffset: { x: number; y: number }; selectedGroup: Group | null;
}
export interface ShotSnapshot extends ShotRequest { readonly shotId: number; }

export function mayShoot(balls: readonly BallState[], ref: Referee): boolean {
    const cue=balls.find(ball=>ball.id===0);
    return !!cue && ref.phase === 'ready' && ref.winner === null && !isMoving(balls) &&
        !cue.pocketed &&
        (ref.isBreak || !!ref.groups[ref.current] || !!ref.selected);
}

/** One visible timeline. Crossing contact holds that exact pose for one rendered frame. */
export class ShotSequence {
    snapshot: Readonly<ShotSnapshot> | null = null;
    elapsedMs = 0;
    committed = false;
    private serial = 0;
    get active(): boolean { return this.snapshot !== null; }

    begin(request: ShotRequest): boolean {
        const d = request.direction, tip = request.tipOffset;
        if (this.active || ![d.x, d.z, tip.x, tip.y, request.power, request.gameId].every(Number.isFinite) ||
            Math.hypot(d.x, d.z) < 1e-6 || request.power <= 0 || request.power > 4 ||
            Math.hypot(tip.x, tip.y) > 1) return false;
        this.snapshot = Object.freeze({ ...request, shotId: ++this.serial,
            direction: Object.freeze({ ...d }), tipOffset: Object.freeze({ ...tip }) });
        this.elapsedMs = 0; this.committed = false;
        return true;
    }

    advance(seconds: number, commit: (snapshot: Readonly<ShotSnapshot>) => boolean): boolean {
        if (!this.snapshot || !Number.isFinite(seconds) || seconds < 0) return false;
        const next = this.elapsedMs + seconds * 1000;
        if (!this.committed && next + 1e-7 >= SHOT_TIMING.contact) {
            this.elapsedMs = SHOT_TIMING.contact;
            // Mark before invoking the callback, including if it is re-entered.
            this.committed = true;
            const snapshot = this.snapshot;
            if (!commit(snapshot)) { this.cancel(); return false; }
            return true;
        }
        this.elapsedMs = Math.min(next, SHOT_TIMING.end);
        if (this.elapsedMs >= SHOT_TIMING.end) this.snapshot = null;
        return false;
    }

    cancelBeforeContact(): void { if (!this.committed) this.cancel(); }
    cancel(): void { this.snapshot = null; this.elapsedMs = 0; this.committed = false; }
}

/** Revalidate the reserved parameters; failed commits leave the referee untouched. */
export function commitShot(snapshot: Readonly<ShotSnapshot>, gameId: number, balls: BallState[], ref: Referee): boolean {
    const d = snapshot.direction;
    if (snapshot.gameId !== gameId || snapshot.player !== ref.current || !mayShoot(balls, ref) ||
        snapshot.selectedGroup !== ref.selected || ![d.x, d.z, snapshot.power].every(Number.isFinite) ||
        Math.hypot(d.x, d.z) < 1e-6 || snapshot.power <= 0 || snapshot.power > 4) return false;
    const before = { phase: ref.phase, hand: ref.hand, message: ref.message, shot: ref.shot };
    if (!ref.beginShot(balls)) return false;
    if (strike(balls, d.x, d.z, snapshot.power)) return true;
    Object.assign(ref, before);
    return false;
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const easeOut = (value: number): number => 1 - (1-value)**3;
export function shotPose(ms: number, active: boolean, reducedMotion = false): {
    cueShift: number; ballTravel: number; ballAlpha: number; burst: number; burstAlpha: number;
} {
    if (!active) return { cueShift: 0, ballTravel: 0, ballAlpha: 1, burst: 0, burstAlpha: 0 };
    const t = SHOT_TIMING;
    let shift: number;
    if (ms < t.backswing) shift = -2.2*easeOut(clamp(ms/t.backswing));
    else if (ms < t.contact) shift = -2.2+5.372*clamp((ms-t.backswing)/(t.contact-t.backswing))**3;
    else if (ms < t.holdEnd) shift = 3.172;
    else shift = 3.172*(1-easeOut(clamp((ms-t.holdEnd)/(t.end-t.holdEnd))));
    const burst = clamp((ms-t.contact)/180);
    return {
        cueShift: reducedMotion ? 0 : shift,
        ballTravel: reducedMotion ? 0 : ms < t.contact ? 0 : ms < t.holdEnd ? 20*easeOut(clamp((ms-t.contact)/260)) : 0,
        ballAlpha: ms >= t.flightEnd && ms < t.holdEnd ? 0 : ms >= t.holdEnd ? clamp((ms-t.holdEnd)/180) : 1,
        burst,
        burstAlpha: ms >= t.contact && ms < t.contact+180 ? 1-burst : 0,
    };
}
