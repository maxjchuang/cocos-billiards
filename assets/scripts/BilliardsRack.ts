/** Seeded initial conditions only. No randomness is sampled during physics or shooting. */
export const RACK_VERSION = 'hertz-reference-v6' as const;
export const RACK_STORAGE_KEY = 'eight-club.racks.v6';
export const TARGET_MASS_VARIATION = 0.005;
export const RACK_POSITION_TOLERANCE_M = 0.00025;
export const MAX_RACK_POSITION_TOLERANCE_M = 0.0005;
// Stable simulation identities for spatial rack slots; independent of the visible ball numbers.
// This priority preserves the original calibration when every mass is one.
export const RACK_BODY_ORDER = [1,9,2,10,8,3,11,4,12,5,6,13,7,14,15] as const;
export interface RackConfig {
    version: typeof RACK_VERSION;
    rackSeed: number;
    ballSetSeed: number;
    massVariation: number;
    positionToleranceM: number;
}
const validSeed=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=0xffffffff;
export function rackConfig(rackSeed:number,ballSetSeed:number,massVariation=TARGET_MASS_VARIATION,positionToleranceM=RACK_POSITION_TOLERANCE_M):Readonly<RackConfig> {
    if(!validSeed(rackSeed)||!validSeed(ballSetSeed)||!Number.isFinite(massVariation)||massVariation<0||massVariation>.005||!Number.isFinite(positionToleranceM)||positionToleranceM<0||positionToleranceM>MAX_RACK_POSITION_TOLERANCE_M)throw new RangeError('Invalid rack configuration');
    return Object.freeze({version:RACK_VERSION,rackSeed,ballSetSeed,massVariation,positionToleranceM});
}
export function restoreRackConfig(value:unknown):Readonly<RackConfig> {
    const v=value as Partial<RackConfig>|null;
    if(!v||v.version!==RACK_VERSION)throw new RangeError('Unsupported rack version');
    if(typeof v.massVariation!=='number'||typeof v.positionToleranceM!=='number')throw new RangeError('Invalid mass variation');
    return rackConfig(v.rackSeed!,v.ballSetSeed!,v.massVariation,v.positionToleranceM);
}
function random(seed:number):()=>number {
    let state=seed>>>0;
    return ()=>{
        state=(state+0x6d2b79f5)|0;let x=state;
        x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);
        return ((x^(x>>>14))>>>0)/4294967296;
    };
}
function shuffle<T>(values:T[],next:()=>number):T[] {
    for(let i=values.length-1;i>0;i--){const j=Math.floor(next()*(i+1));[values[i],values[j]]=[values[j],values[i]];}
    return values;
}
export function rackNumbers(config:RackConfig):number[] {
    const c=restoreRackConfig(config),next=random(c.rackSeed),solids=shuffle([1,2,3,4,5,6,7],next),stripes=shuffle([9,10,11,12,13,14,15],next);
    const rear=[solids.pop()!,stripes.pop()!];if(next()<.5)rear.reverse();
    const remaining=shuffle(solids.concat(stripes),next),order:number[]=[];
    for(let i=0;i<15;i++)order.push(i===4?8:i===10?rear[0]:i===14?rear[1]:remaining.pop()!);
    return order;
}
/** Relative masses, mean target mass one; cue is exactly one. Fixed by ball identity. */
export function ballMasses(config:RackConfig):number[] {
    const c=restoreRackConfig(config),next=random(c.ballSetSeed),raw=Array.from({length:15},()=>next()*2-1);
    const mean=raw.reduce((a,b)=>a+b,0)/15,span=Math.max(1e-12,...raw.map(x=>Math.abs(x-mean)));
    return [1,...raw.map(x=>1+c.massVariation*(x-mean)/span)];
}
/** Tight rows with seeded sub-millimetre misalignment. Apex remains on the foot spot.
 * Within each row the spacing stays fixed. The next row is lowered enough that
 * its nearest parent distance is exactly the original spacing, never overlapping.
 * Four increments <= tolerance/5 imply a centre offset below tolerance.
 */
export function rackPositionOffsets(config:RackConfig,diameter:number):{x:number;z:number}[]{
    const c=restoreRackConfig(config),out=Array.from({length:15},()=>({x:0,z:0}));
    if(!Number.isFinite(diameter)||diameter<=0)throw new RangeError('Invalid ball diameter');
    if(!c.positionToleranceM)return out;
    const next=random(c.rackSeed^0x723ab189),spacing=diameter+.00001;
    let shift=0,depth=0,slot=1;
    for(let row=1;row<5;row++){
        const delta=(next()*2-1)*c.positionToleranceM/5;
        shift+=delta;
        depth+=Math.sqrt(spacing*spacing-(spacing/2-Math.abs(delta))**2)-spacing*Math.sqrt(3)/2;
        for(let col=0;col<=row;col++,slot++)out[slot]={x:shift,z:-depth};
    }
    return out;
}
interface RackStorage {getItem(key:string):string|null;setItem(key:string,value:string):void;}
/** Local bounded seed journal. Unavailable storage never prevents a new rack. */
export class RackSession {
    readonly ballSetSeed:number;
    persistent:boolean;
    private sequence:number;
    private records:Readonly<RackConfig>[]=[];
    get history():readonly Readonly<RackConfig>[]{return this.records.slice();}
    constructor(private storage?:RackStorage,entropy:()=>number=Math.random){
        this.persistent=!!storage;
        let saved:{ballSetSeed:number;sequence:number;history:Readonly<RackConfig>[]} | null=null;
        try{
            const text=storage?.getItem(RACK_STORAGE_KEY);
            if(text){const v=JSON.parse(text);if(v.version!==RACK_VERSION||!validSeed(v.ballSetSeed)||!validSeed(v.sequence)||!Array.isArray(v.history))throw Error('Invalid rack journal');
                saved={ballSetSeed:v.ballSetSeed,sequence:v.sequence,history:v.history.slice(-32).map(restoreRackConfig)};}
        }catch{this.persistent=false;}
        this.ballSetSeed=saved?.ballSetSeed??Math.floor(entropy()*4294967296)>>>0;
        this.sequence=saved?.sequence??Math.floor(entropy()*4294967296)>>>0;
        this.records=saved?.history??[];
    }
    next(profile?:Pick<RackConfig,'ballSetSeed'|'massVariation'|'positionToleranceM'>):Readonly<RackConfig>{
        this.sequence=(this.sequence+0x9e3779b9)>>>0;
        const config=rackConfig(this.sequence,profile?.ballSetSeed??this.ballSetSeed,profile?.massVariation??TARGET_MASS_VARIATION,profile?.positionToleranceM??RACK_POSITION_TOLERANCE_M);this.records.push(config);if(this.records.length>32)this.records.shift();
        try{if(this.storage){this.storage.setItem(RACK_STORAGE_KEY,JSON.stringify({version:RACK_VERSION,ballSetSeed:this.ballSetSeed,sequence:this.sequence,history:this.records}));this.persistent=true;}}
        catch{this.persistent=false;}
        return config;
    }
}
