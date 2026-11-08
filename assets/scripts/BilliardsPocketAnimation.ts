import { POCKETS, TABLE_GEOMETRY } from './BilliardsTableGeometry';

// Presentation only. The planar solver has already committed the pocket event.
export const POCKET_FALL = { duration: .32, gravity: 6, floor: -.09 };
interface FallingBall {
    x: number;
    z: number;
    pocket: number;
    speed: number;
    elapsed: number;
}

export class PocketAnimation {
    private falling = new Map<number, FallingBall>();

    get active(): boolean { return this.falling.size > 0; }

    start(ball: { id: number; x: number; z: number }, pocket: number, speed = 0): void {
        if (this.falling.has(ball.id) || !POCKETS[pocket]) return;
        this.falling.set(ball.id, { x: ball.x, z: ball.z, pocket, speed, elapsed: 0 });
    }

    advance(dt: number): void {
        for (const [id, ball] of this.falling) {
            ball.elapsed += Math.max(0, dt);
            if (ball.elapsed >= POCKET_FALL.duration) this.falling.delete(id);
        }
    }

    position(id: number): { x: number; y: number; z: number } | undefined {
        const ball = this.falling.get(id);
        if (!ball) return;
        const pocket = POCKETS[ball.pocket];
        // Bounded inward travel avoids carrying a fast ball through the back wall.
        const drift = 1 - Math.exp(-ball.elapsed * (3 + Math.min(ball.speed, 2) * 3));
        return {
            x: ball.x + (pocket.x - ball.x) * drift,
            y: TABLE_GEOMETRY.radius - .5 * POCKET_FALL.gravity * ball.elapsed ** 2,
            z: ball.z + (pocket.z - ball.z) * drift,
        };
    }

    clear(): void { this.falling.clear(); }
}
