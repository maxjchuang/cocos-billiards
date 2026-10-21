// Developer-only. Browser: DOM touch with mobile emulation. Creator embedded preview:
// engine touch events (does not certify DOM/device input). Cases use the real frame loop and physics.
async function previewSmoke({inputMode = location.protocol === 'packages:' ? 'engine' : 'dom'} = {}) {
    const game = cc.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    const editorPreview = location.protocol === 'packages:';
    if (!game || (!navigator.maxTouchPoints && inputMode === 'dom' && !editorPreview)) throw new Error('Load Main and enable mobile touch emulation first.');
    const inputEngine = inputMode === 'engine' ? await System.import('cc') : null;
    if (inputMode === 'engine' && (cc.ENGINE_VERSION !== '3.8.7' || typeof inputEngine.input._dispatchEventTouch !== 'function'))
        throw new Error('Creator engine touch driver is pinned to 3.8.7.');
    const results = [], originalPower = game.power;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const frame = async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); await wait(50); };
    const check = (name, passed) => {
        results.push({ name, passed: !!passed });
        if (!passed) throw new Error(name);
    };
    const canvas = document.getElementById('GameCanvas');
    const tap = async (point, inspect) => {
        if (inputMode === 'engine') {
            const finger = new inputEngine.Touch(point.x, point.y, 76);
            for (const type of [inputEngine.Input.EventType.TOUCH_START,inputEngine.Input.EventType.TOUCH_END]) {
                const event = new inputEngine.EventTouch([finger],false,type,[finger]);
                event.touch=finger;event.simulate=true;inputEngine.input._dispatchEventTouch(event);
            }
        } else {
            const rect = canvas.getBoundingClientRect();
            const finger = new Touch({ identifier: 76, target: canvas,
                clientX: rect.left + point.x / canvas.width * rect.width,
                clientY: rect.bottom - point.y / canvas.height * rect.height });
            canvas.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [finger], changedTouches: [finger] }));
            canvas.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [finger] }));
        }
        if (inspect) inspect();
        await frame();
    };
    const table = (x,z) => tap(game.camera.worldToScreen(new cc.Vec3(x,0.028575,z)));
    const action = index => tap(game.hudCamera.worldToScreen(game.actions[index].node.worldPosition));
    const power = async fraction => {
        const origin=game.powerControl.worldPosition;
        await tap(game.hudCamera.worldToScreen(new cc.Vec3(origin.x-game.powerHalfWidth+fraction*game.powerHalfWidth*2,origin.y,origin.z)));
    };
    const shoot = async () => {
        const before={x:game.balls[0].x,z:game.balls[0].z};
        await tap(game.hudCamera.worldToScreen(game.shotButton.node.worldPosition),()=>{
            check('Click starts icon motion without moving table balls',game.shotSequence.active && !game.shotSequence.committed &&
                game.referee.phase==='ready' && game.balls[0].x===before.x && game.balls[0].z===before.z);
        });
        for(let i=0;i<100&&!game.shotSequence.committed;i++) await wait(10);
        check('Contact commits once in the real frame loop',game.shotSequence.committed);
    };
    const settle = async () => {
        for(let i=0;i<300 && (game.referee.phase==='shooting'||game.shotSequence.active);i++) await wait(50);
        check('Physics shot settles before timeout',game.referee.phase!=='shooting'&&!game.shotSequence.active);
        await frame();
    };
    const sideShot = id => {
        game.balls.forEach(b=>{b.vx=0;b.vz=0;b.wx=0;b.wy=0;b.wz=0;b.pocketed= ![0,8,id].includes(b.id);});
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
        check('Table fits its reserved camera viewport',[-0.77,0.77].every(x=>[-1.41,1.41].every(z=>{
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
        const still={x:game.balls[0].x,z:game.balls[0].z};
        await table(0.5,0.9);
        check('Table release retains aim and never shoots',game.referee.phase==='ready'&&game.balls[0].x===still.x&&game.balls[0].z===still.z);
        await tap(game.hudCamera.worldToScreen(game.fineButton.node.parent.worldPosition));
        const angle=game.fineAim.degrees;
        await tap(game.hudCamera.worldToScreen(game.finePlus.node.parent.worldPosition));
        check('Fine button nudges 0.1 degrees without shooting',game.fineAim.active&&game.fineAim.degrees===angle+0.1&&game.referee.phase==='ready');
        await tap(game.hudCamera.worldToScreen(game.fineButton.node.parent.worldPosition));
        await table(0.5,0.9); await shoot(); await settle();
        check('Dry miss offers break choices to P2',game.referee.phase==='choice' && game.referee.current===1 && game.referee.foulCount[0]===1);
        await action(2);
        check('Accepting foul grants free ball',game.referee.phase==='placing' && game.referee.hand==='any' && !game.ballNodes[0].active);
        await table(0.2,0.1); await action(1);
        check('Touch free-ball confirmation',game.referee.phase==='ready' && !game.balls[0].pocketed);
        await action(1);
        check('Touch group selection',game.referee.selected==='stripe');
        sideShot(9); await frame(); await power(0.3); await table(0.6,0); await shoot(); await settle();
        check('Physical stripe pot assigns groups and keeps turn',game.balls[9].pocketed && game.referee.groups[1]==='stripe' && game.referee.groups[0]==='solid' && game.referee.current===1);
        sideShot(8); Object.assign(game.balls[10],{x:-0.3,z:0.5,pocketed:false});
        await frame(); await table(0.6,0); await shoot(); await settle();
        check('Physical early 8 loses',game.referee.phase==='over' && game.referee.winner===0);
        const before={...game.balls[0]}; await table(-0.3,0);
        check('Finished game rejects shots',game.balls[0].vx===before.vx && game.balls[0].vz===before.vz);
        await action(1);
        check('Touch next-game button',game.referee.phase==='placing' && game.referee.winner===null && game.balls.every(b=>!b.pocketed));
        game.referee.phase='ready'; game.referee.hand=null; game.referee.isBreak=false;
        game.referee.groups=['solid','stripe']; sideShot(8); await frame(); await power(0.3);
        await table(0.6,0); await shoot(); await settle();
        check('Physical legal 8 wins',game.referee.winner===0 && game.referee.phase==='over' && game.referee.message.includes('合法'));
        await tap(game.hudCamera.worldToScreen(game.resetLabel.node.worldPosition));
        check('Pause blocks table input',game.paused);
        await tap(game.hudCamera.worldToScreen(game.restartButton.node.parent.worldPosition));
        check('Restart first requires confirmation',game.confirmingRestart);
        await tap(game.hudCamera.worldToScreen(game.restartButton.node.parent.worldPosition));
        check('Touch restart clears referee',game.referee.foulCount.every(n=>n===0) && game.referee.groups.every(g=>g===null));
        return {engine:cc.ENGINE_VERSION,inputMode:inputMode==='engine'?'Creator engine touch events':'Browser DOM touch events',results};
    } catch (error) {
        error.results=results; throw error;
    } finally {
        game.power=originalPower; game.reset();
    }
}

// Render-frame probe: DOM touch in browser, pinned engine dispatcher in Creator.
async function previewContactProbe({inputMode=location.protocol==='packages:'?'engine':'dom'}={}) {
    const engine = await System.import('cc');
    if (inputMode==='engine'&&(cc.ENGINE_VERSION !== '3.8.7' || typeof engine.input._dispatchEventTouch !== 'function'))
        throw new Error('Creator timing probe requires the 3.8.7 touch dispatcher.');
    const game=cc.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    if (!game) throw new Error('Load Main first.');
    const originalPower=game.power,frames=[];
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const frame=()=>new Promise((resolve,reject)=>{
        let count=0;
        const done=()=>{if(++count>=2){clearTimeout(timeout);engine.director.off(engine.Director.EVENT_AFTER_DRAW,done);resolve();}};
        const timeout=setTimeout(()=>{engine.director.off(engine.Director.EVENT_AFTER_DRAW,done);reject(new Error('No rendered frames for timing fixture.'));},3000);
        engine.director.on(engine.Director.EVENT_AFTER_DRAW,done);
    });
    const canvas=document.getElementById('GameCanvas');
    const tap=node=>{
        const p=game.hudCamera.worldToScreen(node.worldPosition);
        for(const type of [engine.Input.EventType.TOUCH_START,engine.Input.EventType.TOUCH_END]) {
            if(inputMode==='engine') {
                const finger=new engine.Touch(p.x,p.y,87),event=new engine.EventTouch([finger],false,type,[finger]);
                event.touch=finger;event.simulate=true;engine.input._dispatchEventTouch(event);
            } else {
                const rect=canvas.getBoundingClientRect(),finger=new Touch({identifier:87,target:canvas,
                    clientX:rect.left+p.x/canvas.width*rect.width,clientY:rect.bottom-p.y/canvas.height*rect.height});
                canvas.dispatchEvent(new TouchEvent(type.replace('-',''),{bubbles:true,touches:type===engine.Input.EventType.TOUCH_END?[]:[finger],changedTouches:[finger]}));
            }
        }
    };
    const ready=async()=>{
        game.reset();game.power=2.4;await frame();tap(game.actions[1].node.parent);await frame();
        if(game.referee.phase!=='ready')throw new Error('Touch confirmation failed: '+JSON.stringify({phase:game.referee.phase,paused:game.paused,backgrounded:game.backgrounded,activeTouch:game.activeTouch}));
        game.direction={x:1,z:0};
    };
    let record=null,startedAt=0;
    try {
        await ready();
        const before={x:game.balls[0].x,z:game.balls[0].z};
        record=()=>frames.push({wallMs:performance.now()-startedAt,ms:game.shotSequence.elapsedMs,active:game.shotSequence.active,
            committed:game.shotSequence.committed,x:game.balls[0].x,z:game.balls[0].z});
        engine.director.on(engine.Director.EVENT_AFTER_DRAW,record);
        startedAt=performance.now();tap(game.shotButton.node);const id=game.shotSequence.snapshot?.shotId;
        tap(game.shotButton.node);const repeatIgnored=game.shotSequence.snapshot?.shotId===id;
        await wait(1100);
        engine.director.off(engine.Director.EVENT_AFTER_DRAW,record);record=null;
        const moved=f=>Math.hypot(f.x-before.x,f.z-before.z)>1e-8;
        const firstMoving=frames.find(moved),contact=frames.filter(f=>f.active&&f.ms===220&&f.committed);
        const timing={frames:frames.length,preContactFrames:frames.filter(f=>f.active&&f.ms<220).length,
            noEarlyMotion:frames.filter(f=>f.active&&f.ms<220).every(f=>!moved(f)),
            requestedFrameRate:engine.game.frameRate,firstMotionMs:firstMoving?.ms,firstMotionWallMs:firstMoving?Math.round(firstMoving.wallMs):null,contactFrames:contact.length,repeatIgnored};
        await ready();tap(game.shotButton.node);await wait(100);tap(game.resetLabel.node);await wait(350);
        const cancelled=game.paused&&!game.shotSequence.active&&game.balls[0].vx===0&&game.balls[0].vz===0;
        tap(game.resumeButton.node.parent);await wait(300);
        const noGhost=!game.paused&&game.referee.phase==='ready'&&game.balls[0].vx===0&&game.balls[0].vz===0;
        tap(game.shotButton.node);
        for(let i=0;i<100&&!game.shotSequence.committed;i++)await wait(10);
        const shot=game.referee.shot;
        tap(game.resetLabel.node);const position={x:game.balls[0].x,z:game.balls[0].z};await wait(250);
        const frozen=game.paused&&game.referee.shot===shot&&game.balls[0].x===position.x&&game.balls[0].z===position.z;
        tap(game.resumeButton.node.parent);
        for(let i=0;i<100&&game.balls[0].x===position.x&&game.balls[0].z===position.z;i++)await wait(10);
        const resumed=!!shot&&game.referee.shot===shot&&!game.paused&&
            Math.hypot(game.balls[0].x-position.x,game.balls[0].z-position.z)>0;
        const checks={noEarlyMotion:timing.noEarlyMotion,observedPreparation:timing.preContactFrames>0,
            contactFrameObserved:timing.contactFrames>0,firstMotionAtContact:timing.firstMotionMs===220,
            repeatIgnored,cancelledBeforeContact:cancelled,noGhostAfterResume:noGhost,
            frozenAfterContact:frozen,resumedWithoutReplay:resumed};
        return {engine:cc.ENGINE_VERSION,inputMode:inputMode==='engine'?'Creator 3.8.7 internal touch dispatcher':'Browser synthetic DOM touch',
            timing,checks,passed:Object.values(checks).every(Boolean)};
    } finally {
        if(record)engine.director.off(engine.Director.EVENT_AFTER_DRAW,record);
        game.power=originalPower;game.reset();
    }
}
