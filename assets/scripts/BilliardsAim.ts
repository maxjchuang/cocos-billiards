import { traceTable } from './BilliardsTableGeometry';
import { BallState, TABLE } from './BilliardsPhysics';
export interface AimContact { x: number; z: number; distance: number; target: number | null; }
/** Swept circle against balls and centre-accessible cushions; no post-contact prediction. */
export function predictContact(cue: BallState, dx: number, dz: number, balls: readonly BallState[]): AimContact | null {
    const length = Math.hypot(dx, dz);
    if (cue.pocketed || !Number.isFinite(length) || length < 1e-6) return null;
    dx /= length; dz /= length;
    let nearest = traceTable(cue,dx,dz)?.distance ?? Infinity;
    let target: number | null = null;
    for (const ball of balls) {
        if (ball.id === cue.id || ball.pocketed) continue;
        const ox = cue.x-ball.x, oz = cue.z-ball.z;
        const along = ox*dx+oz*dz, c = ox*ox+oz*oz-(TABLE.radius*2)**2;
        const discriminant = along*along-c;
        if (discriminant < 0 || along >= 0) continue;
        const distance = Math.max(0, -along-Math.sqrt(discriminant));
        if (distance < nearest) { nearest=distance; target=ball.id; }
    }
    return Number.isFinite(nearest) && nearest >= 0
        ? { x:cue.x+dx*nearest, z:cue.z+dz*nearest, distance:nearest, target } : null;
}

export class FineAim {
    active = false;
    degrees = 0;
    private base = 0;
    open(dx: number, dz: number): void { this.base=Math.atan2(dx,dz);this.degrees=0;this.active=true; }
    set(degrees: number): { x: number; z: number } {
        if (Number.isFinite(degrees)) this.degrees=Math.max(-5,Math.min(5,degrees));
        const angle=this.base+this.degrees*Math.PI/180;
        return { x:Math.sin(angle), z:Math.cos(angle) };
    }
    nudge(sign: number): { x: number; z: number } { return this.set(Math.round((this.degrees+sign*0.1)*10)/10); }
    close(): void { this.active=false; }
}
