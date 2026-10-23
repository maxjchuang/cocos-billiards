import { TABLE_GEOMETRY, CUSHION_SEGMENTS, nearestOnSegment, pocketAt, validTablePlacement } from './BilliardsTableGeometry';
export { POCKETS, POCKET_MODEL, CUSHION_SEGMENTS } from './BilliardsTableGeometry';
export type { CushionSide } from './BilliardsTableGeometry';
import { CushionSide } from './BilliardsTableGeometry';
import { clearSpin, clothStep, spinCushion, strikeWithSpin, TipOffset } from './BilliardsSpin';
/** Pure table-plane simulation. No Cocos dependency; one unit represents one metre. */
export interface BallState {
    id: number;
    pocketed?: boolean;
    x: number;
    z: number;
    vx: number;
    vz: number;
    /** Angular velocity in radians/second; omitted legacy fields mean zero. */
    wx?: number; wy?: number; wz?: number;
}

export const TABLE = {
    ...TABLE_GEOMETRY,
    maxStrikeSpeed: 8,
    maxSubstepTravel: TABLE_GEOMETRY.radius * 0.6,
    deceleration: 0.32,
    ballRestitution: 0.96,
    cushionRestitution: 0.82,
    stopSpeed: 0.005,
};
export type PhysicsEvent =
    | { type: 'contact'; a: number; b: number }
    | { type: 'cushion'; id: number; side?: CushionSide }
    | { type: 'pocket'; id: number; pocket: number };
export interface StepOptions {
    onEvent?: (event: PhysicsEvent) => void;
    respawnCue?: boolean;
}
export const HEAD_LINE = 0.635;
export const FOOT_SPOT = -0.635;
export const FIXED_STEP = 1 / 240;

export function createRack(): BallState[] {
    const balls: BallState[] = [{ id: 0, x: 0, z: 0.65, vx: 0, vz: 0 }];
    const spacing = TABLE.radius * 2 + 0.00001;
    // Eight in the centre (third row), opposite groups in the two rear corners.
    const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 6, 13, 7, 14, 15];
    for (let row = 0, id = 1; row < 5; row++) {
        for (let col = 0; col <= row; col++, id++) {
            balls.push({ id: order[id - 1], x: (col - row / 2) * spacing,
                z: FOOT_SPOT - row * spacing * Math.sqrt(3) / 2, vx: 0, vz: 0 });
        }
    }
    return balls.sort((a, b) => a.id - b.id);
}

export function isMoving(balls: readonly BallState[]): boolean {
    return balls.some(ball => !ball.pocketed && (Math.hypot(ball.vx, ball.vz) > TABLE.stopSpeed || Math.hypot(ball.wx??0,ball.wz??0)*TABLE.radius > TABLE.stopSpeed));
}

export function strike(balls: BallState[], dx: number, dz: number, speed: number, tip: TipOffset = {x:0,y:0}): boolean {
    const length = Math.hypot(dx, dz);
    if (isMoving(balls) || length < 1e-6 || !Number.isFinite(length) || !Number.isFinite(speed) || ![tip.x,tip.y].every(Number.isFinite) || Math.hypot(tip.x,tip.y)>1+1e-9) return false;
    const cue = balls.find(ball => ball.id === 0);
    if (!cue || cue.pocketed) return false;
    const value = Math.max(0, Math.min(speed, TABLE.maxStrikeSpeed));
    if (value === 0) return false;
    strikeWithSpin(cue,dx/length,dz/length,value,tip,TABLE.radius);
    return true;
}

/** Keep high-power spatial sampling at least as fine as the former 4m/s fixed step.
 * The game still advances at 240Hz; faster motion gets extra internal collision substeps.
 * This remains a discrete solver, not continuous collision detection for arbitrary grazing hits.
 */
export function step(balls: BallState[], dt: number, options: StepOptions = {}): void {
    if (!Number.isFinite(dt) || dt < 0) return;
    let fastest=0;
    for(const ball of balls)if(!ball.pocketed)fastest=Math.max(fastest,Math.hypot(ball.vx,ball.vz));
    if(!Number.isFinite(fastest))return;
    const substeps=Math.max(1,Math.ceil(fastest*dt/TABLE.maxSubstepTravel));
    for(let i=0;i<substeps;i++)stepOnce(balls,dt/substeps,options);
}

function stepOnce(balls: BallState[], dt: number, options: StepOptions): void {
    for (const ball of balls) {
        if (ball.pocketed) continue;
        ball.x += ball.vx * dt;
        ball.z += ball.vz * dt;
        clothStep(ball,TABLE.radius,dt,TABLE.deceleration,TABLE.stopSpeed);
    }
    const diameter = TABLE.radius * 2;
    // A few iterations relax the closely packed rack; this is a prototype, not a sport simulator.
    for (let iteration = 0; iteration < 3; iteration++) {
        for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i], b = balls[j];
            if (a.pocketed || b.pocketed) continue;
            const dx = b.x - a.x, dz = b.z - a.z;
            const distance = Math.hypot(dx, dz);
            if (distance >= diameter) continue;
            const nx = distance > 1e-8 ? dx / distance : 1;
            const nz = distance > 1e-8 ? dz / distance : 0;
            const correction = (diameter - distance) / 2;
            a.x -= nx * correction; a.z -= nz * correction;
            b.x += nx * correction; b.z += nz * correction;
            const relative = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
            if (relative >= 0) continue;
            options.onEvent?.({ type: 'contact', a: a.id, b: b.id });
            const impulse = -(1 + TABLE.ballRestitution) * relative / 2;
            a.vx -= impulse * nx; a.vz -= impulse * nz;
            b.vx += impulse * nx; b.vz += impulse * nz;
        }
        for (const ball of balls) {
            if (ball.pocketed) continue;
            for (const segment of CUSHION_SEGMENTS) {
                const q=nearestOnSegment(ball,segment.a,segment.b);
                const dx=ball.x-q.x,dz=ball.z-q.z,distance=Math.hypot(dx,dz);
                if (distance>=TABLE.radius) continue;
                const nx=distance>1e-9?dx/distance:segment.inward.x,nz=distance>1e-9?dz/distance:segment.inward.z;
                ball.x+=nx*(TABLE.radius-distance);ball.z+=nz*(TABLE.radius-distance);
                if (ball.vx*nx+ball.vz*nz<0) {
                    options.onEvent?.({type:'cushion',id:ball.id,side:segment.side});
                    spinCushion(ball,-nx,-nz,TABLE.radius,TABLE.cushionRestitution);
                }
            }
        }
        capturePockets(balls, options.onEvent);
    }
    // Pure vertical spin cannot restart plane motion; truncate it once the whole table rests.
    if (!isMoving(balls)) balls.forEach(clearSpin);
    if (options.respawnCue !== false) respawnCue(balls);
}

function capturePockets(balls: BallState[], onEvent?: (event: PhysicsEvent) => void): void {
    for (const ball of balls) {
        if (ball.pocketed) continue;
        const pocket = pocketAt(ball);
        if (pocket !== -1) {
            onEvent?.({ type: 'pocket', id: ball.id, pocket });
            ball.pocketed = true;
            ball.vx = 0;
            ball.vz = 0;
            clearSpin(ball);
        }
    }
}

/** Wait for rest, then search the head spot and a deterministic grid for clear space. */
export function respawnCue(balls: BallState[]): boolean {
    const cue = balls.find(ball => ball.id === 0);
    if (!cue?.pocketed || isMoving(balls)) return false;
    const candidates = [{ x: 0, z: 0.65 }];
    const spacing = TABLE.radius * 2 + 0.002;
    for (let z = TABLE.halfLength - spacing; z >= -TABLE.halfLength + spacing; z -= spacing) {
        for (let x = -TABLE.halfWidth + spacing; x <= TABLE.halfWidth - spacing; x += spacing) {
            candidates.push({ x, z });
        }
    }
    const spot = candidates.find(point =>
        validTablePlacement(point) &&
        balls.every(ball => ball === cue || ball.pocketed ||
            Math.hypot(point.x - ball.x, point.z - ball.z) >= spacing));
    if (!spot) return false;
    cue.x = spot.x; cue.z = spot.z;
    cue.vx = 0; cue.vz = 0; clearSpin(cue);
    cue.pocketed = false;
    return true;
}
