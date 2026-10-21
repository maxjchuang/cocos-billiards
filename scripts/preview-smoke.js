// Developer-only: enable mobile touch emulation. Later cases arrange small tables,
// then use real DOM touch events, the Cocos frame loop and actual physics.
async function previewSmoke() {
    const game = cc.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    if (!game || !navigator.maxTouchPoints) throw new Error('Load Main and enable mobile touch emulation first.');
    const results = [], originalPower = game.power;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const frame = async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); await wait(50); };
    const check = (name, passed) => {
        results.push({ name, passed: !!passed });
        if (!passed) throw new Error(name);
    };
    const canvas = document.getElementById('GameCanvas');
    const tap = async point => {
        const rect = canvas.getBoundingClientRect();
        const finger = new Touch({ identifier: 76, target: canvas,
            clientX: rect.left + point.x / canvas.width * rect.width,
            clientY: rect.bottom - point.y / canvas.height * rect.height });
        canvas.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [finger], changedTouches: [finger] }));
        canvas.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [finger] }));
        await frame();
    };
    const table = (x,z) => tap(game.camera.worldToScreen(new cc.Vec3(x,0.028575,z)));
    const action = index => tap(game.hudCamera.worldToScreen(game.actions[index].node.worldPosition));
    const power = async fraction => {
        const origin=game.powerControl.worldPosition;
        await tap(game.hudCamera.worldToScreen(new cc.Vec3(origin.x-game.powerHalfWidth+fraction*game.powerHalfWidth*2,origin.y,origin.z)));
    };
    const settle = async () => {
        for(let i=0;i<240 && game.referee.phase==='shooting';i++) await wait(50);
        check('Physics shot settles before timeout',game.referee.phase!=='shooting');
        await frame();
    };
    const sideShot = id => {
        game.balls.forEach(b=>{b.vx=0;b.vz=0;b.pocketed= ![0,8,id].includes(b.id);});
        Object.assign(game.balls[0],{x:0.35,z:0,pocketed:false});
        Object.assign(game.balls[8],{x:0,z:-0.635});
        Object.assign(game.balls[id],{x:0.52,z:0,pocketed:false});
        game.syncVisuals();
    };
    try {
        game.reset(); await frame();
        check('Profiler is hidden by default', !cc.profiler.isShowingStats());
        const tableViewport = game.camera.rect;
        const uiBounds = node => {
            const transform = node.components.find(component => component.contentSize);
            const size = transform.contentSize;
            const corners = [-1,1].flatMap(x => [-1,1].map(y => game.hudCamera.worldToScreen(
                transform.convertToWorldSpaceAR(new cc.Vec3(x*size.width/2,y*size.height/2,0)))));
            return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),
                bottom:Math.min(...corners.map(p=>p.y)),top:Math.max(...corners.map(p=>p.y))};
        };
        const viewport = {left:tableViewport.x*canvas.width,right:(tableViewport.x+tableViewport.width)*canvas.width,
            bottom:tableViewport.y*canvas.height,top:(tableViewport.y+tableViewport.height)*canvas.height};
        const separated = rect => rect.right<=viewport.left+1 || rect.left>=viewport.right-1 ||
            rect.top<=viewport.bottom+1 || rect.bottom>=viewport.top-1;
        check('Projected HUD stays outside the table viewport',[
            game.status.node, game.resetLabel.node, ...game.playerCards.map(card=>card.node), game.dock,
        ].every(node=>separated(uiBounds(node))));
        check('Table fits its reserved camera viewport',[-0.735,0.735].every(x=>[-1.37,1.37].every(z=>{
            const p=game.camera.worldToScreen(new cc.Vec3(x,0,z));
            return p.x>=viewport.left && p.x<=viewport.right && p.y>=viewport.bottom && p.y<=viewport.top;
        })));
        check('16 balls, 15 number labels and generated textures',game.ballNodes.filter(n=>n.active).length===16 && game.numberNodes.filter(n=>n.active).length===15 && game.textures.length===16);
        check('Opening placement has no cue stick',game.referee.phase==='placing' && game.referee.hand==='head' && !game.aim.active);
        await table(0.25,0.9);
        check('Touch placement does not shoot',Math.abs(game.balls[0].x-0.25)<0.001 && game.referee.phase==='placing' && game.balls[0].vx===0);
        await table(0,0);
        check('Head-line placement restriction',Math.abs(game.balls[0].z-0.9)<0.001);
        await action(1);
        check('Touch confirmation unlocks cue',game.referee.phase==='ready' && game.aim.active);
        await power(0.1);
        check('Touch power does not shoot',game.power===0.4 && game.referee.phase==='ready');
        await table(0.5,0.9); await settle();
        check('Dry miss offers break choices to P2',game.referee.phase==='choice' && game.referee.current===1 && game.referee.foulCount[0]===1);
        await action(2);
        check('Accepting foul grants free ball',game.referee.phase==='placing' && game.referee.hand==='any' && !game.ballNodes[0].active);
        await table(0.2,0.1); await action(1);
        check('Touch free-ball confirmation',game.referee.phase==='ready' && !game.balls[0].pocketed);
        await action(1);
        check('Touch group selection',game.referee.selected==='stripe');
        sideShot(9); await frame(); await power(0.3); await table(0.6,0); await settle();
        check('Physical stripe pot assigns groups and keeps turn',game.balls[9].pocketed && game.referee.groups[1]==='stripe' && game.referee.groups[0]==='solid' && game.referee.current===1);
        sideShot(8); Object.assign(game.balls[10],{x:-0.3,z:0.5,pocketed:false});
        await frame(); await table(0.6,0); await settle();
        check('Physical early 8 loses',game.referee.phase==='over' && game.referee.winner===0);
        const before={...game.balls[0]}; await table(-0.3,0);
        check('Finished game rejects shots',game.balls[0].vx===before.vx && game.balls[0].vz===before.vz);
        await action(1);
        check('Touch next-game button',game.referee.phase==='placing' && game.referee.winner===null && game.balls.every(b=>!b.pocketed));
        game.referee.phase='ready'; game.referee.hand=null; game.referee.isBreak=false;
        game.referee.groups=['solid','stripe']; sideShot(8); await frame(); await power(0.3);
        await table(0.6,0); await settle();
        check('Physical legal 8 wins',game.referee.winner===0 && game.referee.phase==='over' && game.referee.message.includes('合法'));
        await tap(game.hudCamera.worldToScreen(game.resetLabel.node.worldPosition));
        check('Touch restart clears referee',game.referee.foulCount.every(n=>n===0) && game.referee.groups.every(g=>g===null));
        return {engine:cc.ENGINE_VERSION,results};
    } finally {
        game.power=originalPower; game.reset();
    }
}
