import { validTablePlacement } from './BilliardsTableGeometry';
import { clearSpin } from './BilliardsSpin';
import { BallState, createRack, CushionSide, FOOT_SPOT, HEAD_LINE, isMoving, PhysicsEvent, TABLE } from './BilliardsPhysics';

// Digital, same-device implementation of CBSA Chinese Pool (January 2017), chapter III.
export type Group = 'solid' | 'stripe';
export type Player = 0 | 1;
export type Phase = 'ready' | 'shooting' | 'placing' | 'choice' | 'over';
export type BreakChoice = 'accept' | 'self' | 'opponent';
export const groupOf = (id: number): Group | null => id >= 1 && id <= 7 ? 'solid' : id >= 9 && id <= 15 ? 'stripe' : null;
export const groupName = (group: Group | null): string => group === 'solid' ? '全色' : group === 'stripe' ? '半色' : '未分组';
export const remaining = (balls: readonly BallState[], group: Group): number[] =>
    balls.filter(ball => !ball.pocketed && groupOf(ball.id) === group).map(ball => ball.id);

interface Shot {
    player: Player;
    break: boolean;
    group: Group | null;
    remainingBefore: number;
    first: number | null;
    railsAfterContact: boolean;
    breakRails: Set<number>;
    potted: number[];
    headRestricted: boolean;
    crossedHeadLine: boolean;
    headTarget: boolean;
    frozen: Map<number, Set<CushionSide>>;
}

export class Referee {
    current: Player = 0;
    groups: [Group | null, Group | null] = [null, null];
    selected: Group | null = null;
    phase: Phase = 'placing';
    isBreak = true;
    hand: 'head' | 'any' | null = 'head';
    winner: Player | null = null;
    message = 'P1 开球：在开球线后摆放白球，点“确认摆球”';
    foulCount: [number, number] = [0, 0];
    shot: Shot | null = null;
    breakChoice: 'illegal' | 'eight-foul' | null = null;
    private warnedBreaker: Player | null = null;
    private originalBreaker: Player = 0;
    private requireHeadShot = false;

    select(group: Group): void {
        if (this.phase === 'ready' && !this.isBreak && !this.groups[this.current]) this.selected = group;
    }

    beginShot(balls: readonly BallState[]): boolean {
        if (this.phase !== 'ready' || isMoving(balls) || this.winner !== null) return false;
        const group = this.groups[this.current];
        if (!this.isBreak && !group && !this.selected) {
            this.message = '开放球局：先点“进攻全色”或“进攻半色”';
            return false;
        }
        this.shot = {
            player: this.current, break: this.isBreak, group: group ?? this.selected,
            remainingBefore: group ? remaining(balls, group).length : 7,
            first: null, railsAfterContact: false, breakRails: new Set(), potted: [],
            headRestricted: this.requireHeadShot && !this.isBreak, crossedHeadLine: false, headTarget: false,
            frozen: new Map(balls.filter(ball => !ball.pocketed).map(ball => [ball.id, new Set<CushionSide>(
                (['left', 'right', 'top', 'bottom'] as CushionSide[]).filter(side => touchesSide(ball, side)))])),
        };
        this.phase = 'shooting';
        this.hand = null;
        this.message = `P${this.current + 1} 击球中…`;
        return true;
    }

    // Called after every fixed substep, not once per render frame.
    trackCue(balls: readonly BallState[]): void {
        if (this.shot && this.shot.first === null && (balls.find(ball => ball.id === 0)?.z ?? HEAD_LINE) <= HEAD_LINE) this.shot.crossedHeadLine = true;
        if (this.shot) for (const ball of balls) {
            const frozen = this.shot.frozen.get(ball.id);
            if (frozen) for (const side of frozen) if (!touchesSide(ball, side)) frozen.delete(side);
        }
    }

    observe(event: PhysicsEvent, balls: readonly BallState[]): void {
        const shot = this.shot;
        if (!shot || this.phase !== 'shooting') return;
        if (event.type === 'contact' && shot.first === null && (event.a === 0 || event.b === 0)) {
            shot.first = event.a === 0 ? event.b : event.a;
            shot.headTarget = (balls.find(ball => ball.id === shot.first)?.z ?? 0) > HEAD_LINE;
        }
        if (event.type === 'cushion') {
            // A frozen ball must depart and return; pushing it against its original rail is insufficient.
            if (event.side && shot.frozen.get(event.id)?.has(event.side)) return;
            if (shot.first !== null) shot.railsAfterContact = true;
            if (event.id !== 0) shot.breakRails.add(event.id);
        }
        if (event.type === 'pocket') shot.potted.push(event.id);
    }

    finishShot(balls: BallState[]): void {
        const shot = this.shot;
        if (!shot || this.phase !== 'shooting' || isMoving(balls)) return;
        this.shot = null;
        const other = (1 - shot.player) as Player;
        const potted = shot.potted.filter(id => id !== 0);
        const scratch = shot.potted.includes(0);
        const fouls: string[] = [];
        if (scratch) fouls.push('白球落袋');
        if (shot.first === null) fouls.push('未碰目标球');
        if (!shot.break && shot.first !== null) {
            const legal = this.groups[shot.player] && shot.remainingBefore === 0
                ? shot.first === 8 : this.groups[shot.player] ? groupOf(shot.first) === shot.group : shot.first !== 8;
            if (!legal) fouls.push('首碰非法目标球');
            if (!potted.length && !shot.railsAfterContact) fouls.push('碰球后无进球且未碰库');
            if (shot.headRestricted && shot.headTarget && !shot.crossedHeadLine) fouls.push('线后自由球未越线先击线后球');
        }
        const shortBreak = shot.break && !potted.length && shot.breakRails.size < 4;
        if (shortBreak) fouls.push('开球不足四颗目标球碰库');
        this.isBreak = false;
        this.requireHeadShot = false;
        this.selected = null;
        if (fouls.length) this.foulCount[shot.player]++;
        if (!shot.break && potted.includes(8)) {
            const early = !this.groups[shot.player] || shot.remainingBefore > 0;
            this.winner = early || fouls.length ? other : shot.player;
            this.phase = 'over';
            this.message = `P${this.winner + 1} 获胜！${early ? '对手提前打进8号球（含同杆清组进8）' : fouls.length ? `对手进8同时犯规：${fouls.join('、')}` : '合法打进8号球'}`;
            return;
        }
        if (shot.break && potted.includes(8)) respotEight(balls);
        if (shortBreak && this.warnedBreaker === shot.player) {
            this.winner = other; this.phase = 'over';
            this.message = `P${other + 1} 获胜！对手被要求重开后再次开球不足四球碰库`;
            return;
        }
        if (fouls.length) {
            this.current = other;
            this.message = `P${shot.player + 1} 犯规：${fouls.join('、')}`;
            if (shortBreak || (shot.break && potted.includes(8))) {
                this.breakChoice = shortBreak ? 'illegal' : 'eight-foul';
                this.originalBreaker = shot.player;
                this.phase = 'choice';
                return;
            }
            this.awardHand(shot.break ? 'head' : 'any', balls);
            return;
        }
        this.phase = 'ready';
        if (shot.break) {
            this.current = potted.length ? shot.player : other;
            this.message = `合法开球${potted.includes(8) ? '，8号已重置' : ''}；开放球局，先选进攻球组`;
            return;
        }
        // Cross-group combinations cannot establish a group (7.2).
        if (!this.groups[shot.player] && groupOf(shot.first ?? 0) === shot.group &&
            potted.some(id => groupOf(id) === shot.group)) {
            this.groups[shot.player] = shot.group;
            this.groups[other] = shot.group === 'solid' ? 'stripe' : 'solid';
        }
        const ownPot = this.groups[shot.player] && potted.some(id => groupOf(id) === this.groups[shot.player]);
        this.current = ownPot ? shot.player : other;
        this.message = `${ownPot ? '合法进球，继续击球' : '本杆结束，交换击球权'}${this.groups[0] ? '' : '；球局仍开放'}`;
    }

    chooseBreak(balls: BallState[], choice: BreakChoice): void {
        if (this.phase !== 'choice') return;
        if (choice === 'accept') {
            this.awardHand(this.breakChoice === 'illegal' ? 'any' : 'head', balls);
        } else if (this.breakChoice === 'eight-foul') {
            if (balls.find(ball => ball.id === 0)?.pocketed) return;
            this.phase = 'ready'; this.hand = null;
            this.message = '接受台面；开放球局，先选择进攻球组';
        } else {
            const breaker = choice === 'self' ? this.current : this.originalBreaker;
            if (choice === 'opponent') this.warnedBreaker = breaker;
            this.current = breaker;
            balls.splice(0, balls.length, ...createRack());
            this.isBreak = true; this.groups = [null, null]; this.selected = null;
            this.awardHand('head', balls);
            this.message = choice === 'opponent' ? '原开球方重开：再次不足四球碰库将判负' : `P${breaker + 1} 重新开球`;
        }
        this.breakChoice = null;
    }

    private awardHand(area: 'head' | 'any', balls: BallState[]): void {
        this.hand = area; this.phase = 'placing'; this.requireHeadShot = area === 'head';
        const cue = balls.find(ball => ball.id === 0)!;
        cue.pocketed = true; cue.vx = 0; cue.vz = 0; clearSpin(cue);
        // No automatic respawn: player must choose and confirm a legal spot.
    }

    placeCue(balls: BallState[], x: number, z: number): boolean {
        if (this.phase !== 'placing' || !validCuePosition(balls, x, z, this.hand === 'head')) return false;
        const cue = balls.find(ball => ball.id === 0)!;
        cue.x = x; cue.z = z; cue.vx = 0; cue.vz = 0; cue.pocketed = false; clearSpin(cue);
        return true;
    }

    confirmPlacement(balls: BallState[]): boolean {
        const cue = balls.find(ball => ball.id === 0)!;
        if (this.phase !== 'placing' || cue.pocketed ||
            !validCuePosition(balls, cue.x, cue.z, this.hand === 'head')) return false;
        // A head-only free ball may require relocating the nearest legal target (5.3).
        if (!this.isBreak && this.hand === 'head') {
            const group = this.groups[this.current];
            const targets = balls.filter(b => !b.pocketed && b.id !== 0 &&
                (group ? remaining(balls, group).length ? groupOf(b.id) === group : b.id === 8 : b.id !== 8));
            if (targets.length && targets.every(b => b.z > HEAD_LINE)) {
                targets.sort((a, b) => a.z - b.z || a.id - b.id);
                respotBall(balls, targets[0].id);
            }
        }
        this.phase = 'ready'; this.hand = null;
        this.message = this.isBreak ? `P${this.current + 1} 开球` : '白球摆放完成；选择目标后瞄准击球';
        return true;
    }
}

export function validCuePosition(balls: readonly BallState[], x: number, z: number, headOnly = false): boolean {
    return validTablePlacement({x,z}) && (!headOnly || z > HEAD_LINE) &&
        balls.every(b => b.id === 0 || b.pocketed || Math.hypot(x - b.x, z - b.z) >= TABLE.radius * 2 + 0.00001);
}

export function respotBall(balls: BallState[], id: number): void {
    const ball = balls.find(b => b.id === id)!;
    const diameter = TABLE.radius * 2 + 0.00001;
    const clear = (z: number): boolean => balls.every(b => b.id === id || b.pocketed || Math.hypot(b.x, z - b.z) >= diameter);
    const limit = TABLE.halfLength - TABLE.radius;
    let z = FOOT_SPOT;
    while (z >= -limit && !clear(z)) z -= 0.001;
    if (z < -limit) {
        z = FOOT_SPOT;
        while (z <= limit && !clear(z)) z += 0.001;
    }
    if (z > limit) throw new Error('No legal centre-line spot for respotted ball');
    Object.assign(ball, { x: 0, z, vx: 0, vz: 0, pocketed: false });
    clearSpin(ball);
}
export const respotEight = (balls: BallState[]): void => respotBall(balls, 8);

function touchesSide(ball: BallState, side: CushionSide): boolean {
    const maxX = TABLE.halfWidth - TABLE.radius, maxZ = TABLE.halfLength - TABLE.radius;
    return side === 'left' ? ball.x <= -maxX + 0.00001 : side === 'right' ? ball.x >= maxX - 0.00001
        : side === 'top' ? ball.z <= -maxZ + 0.00001 : ball.z >= maxZ - 0.00001;
}
