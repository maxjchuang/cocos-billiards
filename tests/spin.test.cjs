const {test}=require('node:test');
const assert=require('node:assert/strict');
const {TipSelection,tipOffset,tipLabel}=require(process.env.BILLIARDS_SPIN_MODULE);
const {step,strike,TABLE,FIXED_STEP,isMoving,createRack}=require(process.env.BILLIARDS_TEST_MODULE);
const {Referee,respotBall}=require(process.env.BILLIARDS_RULES_MODULE);
const ball=(id,x,z)=>({id,x,z,vx:0,vz:0});
const energy=b=>.5*(b.vx**2+b.vz**2)+.2*TABLE.radius**2*((b.wx??0)**2+(b.wy??0)**2+(b.wz??0)**2);

test('tip draft confirms independently, cancel restores the last value, recenter needs confirmation',()=>{
    const tip=new TipSelection();tip.open();tip.select(.3,-.4);
    assert.deepEqual(tip.value,{x:0,y:0});tip.confirm();assert.deepEqual(tip.value,{x:.3,y:-.4});
    tip.open();tip.recenter();assert.deepEqual(tip.value,{x:.3,y:-.4});tip.cancel();assert.deepEqual(tip.draft,{x:.3,y:-.4});
    tip.open();tip.recenter();tip.confirm();assert.deepEqual(tip.value,{x:0,y:0});
    tip.open();tip.select(.4,.5);tip.confirm();tip.reset();assert.deepEqual(tip.value,{x:0,y:0});assert.equal(tip.active,false);
});
test('tip maps to a circle, snaps near centre and ignores invalid coordinates',()=>{
    const tip=new TipSelection();tip.open();tip.select(4,3);assert.deepEqual(tip.draft,{x:.8,y:.6});
    tip.select(NaN,1);assert.deepEqual(tip.draft,{x:.8,y:.6});tip.select(.04,.04);assert.deepEqual(tip.draft,{x:0,y:0});
    assert.equal(tipOffset(Infinity,0),null);assert.ok(tipLabel({x:.08,y:.08}).includes('右塞 8%'));
});
test('strike maps cue-relative top and right to angular axes regardless of table direction',()=>{
    const a=[ball(0,0,0)],b=[ball(0,0,0)];
    strike(a,0,-1,2,{x:.3,y:.4});strike(b,1,0,2,{x:.3,y:.4});
    assert.ok(a[0].wx<0&&a[0].wy>0);assert.ok(b[0].wz<0&&b[0].wy>0);
    assert.ok(Math.abs(energy(a[0])-2)<1e-9);assert.ok(Math.abs(energy(b[0])-2)<1e-9);
    assert.equal(a[0].vx,0);assert.equal(b[0].vz,0);
});
function impact(tipY,distance=.22,speed=2.8) {
    const balls=[ball(0,0,.8),ball(1,0,.8-distance)];strike(balls,0,-1,speed,{x:0,y:tipY});
    let first=-1,after=0;
    for(let i=0;i<240*5;i++){
        step(balls,FIXED_STEP,{respawnCue:false,onEvent:e=>{if(e.type==='contact'&&first<0)first=i;}});
        if(first>=0&&i>=first+108){after=balls[0].vz;break;}
    }
    assert.ok(first>=0,'shot must reach the object');return after;
}
test('top follows and bottom draws after a near head-on collision',()=>{
    assert.ok(impact(.8)<-.2);assert.ok(impact(-.8)>.2);
});
test('draw weakens with distance rather than adding an unconditional backwards impulse',()=>{
    const near=impact(-.8,.18),far=impact(-.8,.65);
    assert.ok(near>far+.05,`${near} should exceed ${far}`);
});
test('opposite english produces opposite tangential departures at a cushion',()=>{
    const reflect=x=>{
        const balls=[ball(0,TABLE.halfWidth-TABLE.radius-.02,.35)];strike(balls,1,0,2,{x,y:0});
        let hit=false;
        for(let i=0;i<30&&!hit;i++)step(balls,FIXED_STEP,{respawnCue:false,onEvent:e=>{if(e.type==='cushion')hit=true;}});
        assert.ok(hit);assert.ok(balls[0].vx<0);return balls[0].vz;
    };
    const left=reflect(-.8),right=reflect(.8),centre=reflect(0);
    assert.ok(left*right<0);assert.ok(Math.abs(left+right)<1e-8);assert.ok(Math.abs(centre)<1e-9);
});
test('cloth and cushion impulses dissipate energy and extreme diagonal tips remain finite',()=>{
    for(const [x,y] of [[0,0],[0,1],[0,-1],[1,0],[-1,0],[.6,-.8]]) {
        const balls=[ball(0,0,.3)];strike(balls,1,.3,4,{x,y});let previous=energy(balls[0]);
        for(let i=0;i<240*30;i++) {
            step(balls,FIXED_STEP,{respawnCue:false});const b=balls[0],e=energy(b);
            assert.ok(e<=previous+1e-8,`${e} > ${previous}`);previous=e;
            assert.ok([b.x,b.z,b.vx,b.vz,b.wx??0,b.wy??0,b.wz??0].every(Number.isFinite));
        }
        assert.equal(isMoving(balls),false);
    }
});
test('rotation that can restart translation prevents premature settlement; pure side spin can stop',()=>{
    const b=ball(0,0,.3);b.wx=20;b.wz=0;assert.equal(isMoving([b]),true);
    step([b],FIXED_STEP,{respawnCue:false});assert.ok(b.vz>0);
    Object.assign(b,{vx:0,vz:0,wx:0,wz:0,wy:50});step([b],FIXED_STEP,{respawnCue:false});
    assert.equal(isMoving([b]),false);assert.equal(b.wy,0);
});
test('placement, respotting and pocketing clear all rotation',()=>{
    const balls=createRack(),ref=new Referee();Object.assign(balls[0],{wx:10,wy:20,wz:30});
    assert.ok(ref.placeCue(balls,.2,.9));assert.equal(balls[0].wx,0);assert.equal(balls[0].wy,0);assert.equal(balls[0].wz,0);
    Object.assign(balls[8],{pocketed:true,wx:10,wy:20,wz:30});respotBall(balls,8);assert.equal(balls[8].wy,0);
    const p=ball(1,TABLE.halfWidth,0);Object.assign(p,{wx:10,wy:20,wz:30});step([p],FIXED_STEP,{respawnCue:false});
    assert.equal(p.pocketed,true);assert.equal(p.wx+p.wy+p.wz,0);
});
