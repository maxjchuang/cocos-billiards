// Controlled table fixtures. Real frame-loop physics/rendering; not hardware touch certification.
async function previewPocketCurves() {
    const engine=await System.import('cc');
    const geometry=Array.from(System.entries()).map(([,value])=>value).find(value=>value.POCKETS&&value.pocketOpeningAt&&value.traceTable);
    if(!geometry)throw Error('Table geometry module unavailable');
    const game=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const checks=[],falls=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
    const until=async test=>{const start=performance.now();while(!test()&&performance.now()-start<2000)await wait(16);return test();};
    const setBall=(pocket,distance,speed,offset)=>{
        game.pocketAnimation.clear();game.shotSequence.cancel();game.referee.phase='ready';game.referee.isBreak=true;
        game.balls.forEach(ball=>Object.assign(ball,{pocketed:true,vx:0,vz:0,wx:0,wy:0,wz:0}));
        const ball=game.balls[1];
        Object.assign(ball,{pocketed:false,x:pocket.lip.x-pocket.normal.x*distance+pocket.tangent.x*offset,
            z:pocket.lip.z-pocket.normal.z*distance+pocket.tangent.z*offset,vx:pocket.normal.x*speed,vz:pocket.normal.z*speed});
        game.accumulator=0;game.syncVisuals();return ball;
    };
    try {
        game.draftMode='local';game.startMatch();await wait(80);game.referee.confirmPlacement(game.balls);game.setInteractionMode('free',true);await wait(80);
        const triangles=game.tableView.renderers.reduce((total,r)=>total+(r.mesh.readIndices(0)?.length??0)/3,0);
        check('new curved-rim asset imported',triangles>56000&&triangles<80000&&game.tableView.renderers.length===12);
        for(const [index,pocket] of geometry.POCKETS.entries()){
            const local=pocket.outline.map(point=>geometry.pocketCoordinates(point,pocket));
            const front=[];
            for(let i=0;i<local.length;i++){
                const a=local[i],b=local[(i+1)%local.length];
                if(a.v<=.018+1e-8&&b.v<=.018+1e-8)front.push(Math.hypot(b.u-a.u,b.v-a.v));
            }
            check('curved front rim '+index,Math.max(...front)<.006&&local.length===64);
            for(const speed of [.3,4])for(const offset of [0,.008]){
                const ball=setBall(pocket,.04,speed,offset);
                check('ball captures '+index+'/'+speed+'/'+offset,await until(()=>ball.pocketed));
                const node=game.ballNodes[1],start=game.pocketAnimation.position(1);
                check('fall begins visible at original scale '+index+'/'+speed+'/'+offset,!!start&&node.active&&Math.abs(node.scale.x-1)<1e-8);
                await wait(80);const lower=game.pocketAnimation.position(1);
                check('fall descends through opening '+index+'/'+speed+'/'+offset,!!lower&&lower.y<start.y&&geometry.pocketOpeningAt(lower)===index);
                check('fall finishes hidden '+index+'/'+speed+'/'+offset,await until(()=>!game.pocketAnimation.active&&!node.active));
                falls.push({pocket:index,speed,offset,start,lower});
            }
            const supported=setBall(pocket,-pocket.dropDepth+.002,0,0);await wait(60);
            check('supported hanging ball stays '+index,!supported.pocketed);
            const unsupported=setBall(pocket,-pocket.dropDepth-.002,0,0);
            check('unsupported resting ball falls '+index,await until(()=>unsupported.pocketed));
        }
        return {engine:engine.VERSION,viewport:[innerWidth,innerHeight,devicePixelRatio],triangles,renderers:game.tableView.renderers.length,passed:checks.length,total:checks.length,checks,falls};
    }catch(error){return {error:String(error),passed:checks.filter(check=>check.pass).length,total:checks.length,checks,falls};}
    finally{game.draftMode='local';game.startMatch();}
}
