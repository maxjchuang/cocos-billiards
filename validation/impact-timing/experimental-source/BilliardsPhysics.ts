import { RackConfig, RACK_BODY_ORDER, rackNumbers, ballMasses, rackPositionOffsets } from './BilliardsRack';
import { TABLE_GEOMETRY, CUSHION_SEGMENTS, nearestOnSegment, pocketAt, validTablePlacement } from './BilliardsTableGeometry';
export { POCKETS, POCKET_MODEL, CUSHION_SEGMENTS } from './BilliardsTableGeometry';
export type { CushionSide } from './BilliardsTableGeometry';
import { CushionSide } from './BilliardsTableGeometry';
import { clearSpin, clothStep, spinCushion, strikeWithSpin, TipOffset } from './BilliardsSpin';
/** Pure table-plane simulation. No Cocos dependency; one unit represents one metre. */
export interface BallState {
    id: number;
    /** Simulation identity is independent of the displayed ball number. */
    readonly bodyId?: number;
    /** Relative mass; legacy/unspecified states use one. */
    readonly mass?: number;
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
    /** Development diagnostics for pathological contact cascades. */
    onContactBudgetExhausted?: () => void;
}
export const HEAD_LINE = 0.635;
export const FOOT_SPOT = -0.635;
export const FIXED_STEP = 1 / 240;

export function createRack(config?:Readonly<RackConfig>): BallState[] {
    const masses=config?ballMasses(config):Array.from({length:16},()=>1);
    const balls: BallState[] = [{ id: 0, bodyId:0, mass:1, x: 0, z: 0.65, vx: 0, vz: 0 }];
    const spacing = TABLE.radius * 2 + 0.00001;
    const offsets=config?rackPositionOffsets(config,TABLE.radius*2):Array.from({length:15},()=>({x:0,z:0}));
    // Eight in the centre (third row), opposite groups in the two rear corners.
    const order = config?rackNumbers(config):Array.from(RACK_BODY_ORDER);
    for (let row = 0, id = 1; row < 5; row++) {
        for (let col = 0; col <= row; col++, id++) {
            balls.push({ id: order[id - 1], bodyId:RACK_BODY_ORDER[id-1],mass:masses[order[id-1]], x: (col - row / 2) * spacing+offsets[id-1].x,
                z: FOOT_SPOT - row * spacing * Math.sqrt(3) / 2+offsets[id-1].z, vx: 0, vz: 0 });
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
    const ordered=balls.slice().sort((a,b)=>(a.bodyId??a.id)-(b.bodyId??b.id));
    for(let i=0;i<substeps;i++)stepOnce(ordered,dt/substeps,options);
}

function inverseMass(ball:BallState):number {
    const mass=ball.mass??1;
    return Number.isFinite(mass)&&mass>0?1/mass:1;
}

export const CONTACT = {paddingM:0.00025,gapTimeScale:0.0003,normalizedStep:0.01,maxTime:16,quietSteps:20};

/** Local compliant-impact approximation in normalized contact time.
 * Each contact stores/releases its own compression; never rebound the entire rack at once.
 * Normals stay fixed during this short impact solve. This is not a full Hertz/3D model.
 */
function solveBallContacts(balls:BallState[],onEvent?:StepOptions['onEvent'],paddingM=CONTACT.paddingM):void {
    const d=TABLE.radius*2,contacts:{i:number;j:number;nx:number;nz:number;q:number;c:number;sum:number}[]=[];
    let closing=false;
    for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
        const a=balls[i],b=balls[j];if(a.pocketed||b.pocketed)continue;
        const x=b.x-a.x,z=b.z-a.z,len=Math.hypot(x,z);if(len>d+paddingM)continue;
        const nx=len>1e-8?x/len:1,nz=len>1e-8?z/len:0,ia=inverseMass(a),ib=inverseMass(b),v=(a.vx-b.vx)*nx+(a.vz-b.vz)*nz;
        if(v>1e-8&&len<=d+1e-10)closing=true;
        const log=Math.log(TABLE.ballRestitution),zeta=-log/Math.sqrt(Math.PI**2+log**2);
        contacts.push({i,j,nx,nz,q:-Math.max(0,len-d)/CONTACT.gapTimeScale,c:2*zeta*Math.sqrt(1/(ia+ib)),sum:0});
    }
    if(!closing)return;
    if(contacts.length===1){const c=contacts[0],a=balls[c.i],b=balls[c.j],ia=inverseMass(a),ib=inverseMass(b),j=(1+TABLE.ballRestitution)*((a.vx-b.vx)*c.nx+(a.vz-b.vz)*c.nz)/(ia+ib);a.vx-=j*c.nx*ia;a.vz-=j*c.nz*ia;b.vx+=j*c.nx*ib;b.vz+=j*c.nz*ib;onEvent?.({type:'contact',a:a.id,b:b.id});return;}
    const before=balls.map(b=>({vx:b.vx,vz:b.vz})),h=CONTACT.normalizedStep;
    let quiet=0;
    const kick=(scale:number)=>{
        let active=0;const dv=balls.map(()=>({x:0,z:0}));
        for(const c of contacts){const a=balls[c.i],b=balls[c.j],v=(a.vx-b.vx)*c.nx+(a.vz-b.vz)*c.nz,f=c.q>0?Math.max(0,c.q+c.c*v):0,j=f*scale;active+=f>1e-8?1:0;c.sum+=j;dv[c.i].x-=j*c.nx*inverseMass(a);dv[c.i].z-=j*c.nz*inverseMass(a);dv[c.j].x+=j*c.nx*inverseMass(b);dv[c.j].z+=j*c.nz*inverseMass(b);}
        balls.forEach((b,i)=>{b.vx+=dv[i].x;b.vz+=dv[i].z;});return active;
    };
    for(let n=0;n<Math.ceil(CONTACT.maxTime/h);n++){
        kick(h/2);
        for(const c of contacts){const a=balls[c.i],b=balls[c.j];c.q+=((a.vx-b.vx)*c.nx+(a.vz-b.vz)*c.nz)*h;}
        const active=kick(h/2);quiet=active?0:quiet+1;if(n>CONTACT.quietSteps&&quiet>=CONTACT.quietSteps){
            // A tiny rack gap can delay the next impact; quiet force is not necessarily rest.
            let next=Infinity;
            for(const c of contacts){const a=balls[c.i],b=balls[c.j],v=(a.vx-b.vx)*c.nx+(a.vz-b.vz)*c.nz;if(c.q<=0&&v>1e-6)next=Math.min(next,-c.q/v);}
            if(!Number.isFinite(next)||n*h+next>CONTACT.maxTime)break;
            const skip=Math.max(0,Math.floor(next/h)-1);
            if(skip){for(const c of contacts){const a=balls[c.i],b=balls[c.j];c.q+=((a.vx-b.vx)*c.nx+(a.vz-b.vz)*c.nz)*skip*h;}n+=skip;}
            quiet=0;
        }
    }
    let work=0,delta=0;for(let i=0;i<balls.length;i++){const x=balls[i].vx-before[i].vx,z=balls[i].vz-before[i].vz,m=1/inverseMass(balls[i]);work+=m*(before[i].vx*x+before[i].vz*z);delta+=m*(x*x+z*z);}
    const scale=delta?Math.min(1,Math.max(0,-2*work/delta)):0;for(let i=0;i<balls.length;i++){balls[i].vx=before[i].vx+scale*(balls[i].vx-before[i].vx);balls[i].vz=before[i].vz+scale*(balls[i].vz-before[i].vz);}
    for(const c of contacts)if(c.sum>1e-8)onEvent?.({type:'contact',a:balls[c.i].id,b:balls[c.j].id});
}

/** Ball-ball time of impact within each step. Nearby gaps must close in real
 * simulation time, not inside a frozen whole-rack contact solve. Only contacts
 * whose impact times coincide use a simultaneous, actual-touch solve.
 * Cushions/pockets retain their existing spatial substep handling.
 */
function advanceBallContacts(balls:BallState[],dt:number,onEvent?:StepOptions['onEvent'],onBudget?:()=>void):void {
    const diameter=TABLE.radius*2,advance=(time:number)=>{for(const b of balls)if(!b.pocketed){b.x+=b.vx*time;b.z+=b.vz*time;}};
    let remaining=dt;
    for(let event=0;event<256;event++){
        let earliest=Infinity;const hits:{a:BallState;b:BallState;t:number}[]=[];
        for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
            const a=balls[i],b=balls[j];if(a.pocketed||b.pocketed)continue;
            const x=b.x-a.x,z=b.z-a.z,vx=b.vx-a.vx,vz=b.vz-a.vz,v2=vx*vx+vz*vz,dot=x*vx+z*vz;
            if(v2<1e-18||dot>=-1e-12)continue;
            const c=x*x+z*z-diameter*diameter,disc=dot*dot-v2*c;if(disc<0)continue;
            const time=c<=1e-12?0:c/(-dot+Math.sqrt(disc));
            if(time<0||time>remaining+1e-12)continue;
            if(time<earliest-1e-10){earliest=time;hits.length=0;}if(Math.abs(time-earliest)<=1e-10)hits.push({a,b,t:time});
        }
        if(!hits.length){advance(remaining);return;}
        advance(earliest);remaining=Math.max(0,remaining-earliest);
        if(hits.length>1)solveBallContacts(balls,onEvent,1e-9);
        else{const {a,b}=hits[0],x=b.x-a.x,z=b.z-a.z,distance=Math.hypot(x,z),nx=distance>1e-9?x/distance:1,nz=distance>1e-9?z/distance:0,relative=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz,ia=inverseMass(a),ib=inverseMass(b),j=-(1+TABLE.ballRestitution)*relative/(ia+ib);
        a.vx-=j*nx*ia;a.vz-=j*nz*ia;b.vx+=j*nx*ib;b.vz+=j*nz*ib;onEvent?.({type:'contact',a:a.id,b:b.id});}

    }
    onBudget?.();
    advance(remaining);
}

function stepOnce(balls: BallState[], dt: number, options: StepOptions): void {
    advanceBallContacts(balls,dt,options.onEvent,options.onContactBudgetExhausted);
    for(const ball of balls)if(!ball.pocketed)clothStep(ball,TABLE.radius,dt,TABLE.deceleration,TABLE.stopSpeed);
    const diameter=TABLE.radius*2;
    for (let iteration=0;iteration<3;iteration++) {
        for(let i=0;i<balls.length;i++)for(let j=i+1;j<balls.length;j++){
            const a=balls[i],b=balls[j];if(a.pocketed||b.pocketed)continue;
            const dx=b.x-a.x,dz=b.z-a.z,distance=Math.hypot(dx,dz);if(distance>=diameter)continue;
            const nx=distance>1e-8?dx/distance:1,nz=distance>1e-8?dz/distance:0,ia=inverseMass(a),ib=inverseMass(b),d=(diameter-distance)/(ia+ib);
            a.x-=nx*d*ia;a.z-=nz*d*ia;b.x+=nx*d*ib;b.z+=nz*d*ib;
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
