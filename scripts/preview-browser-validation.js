// Development-only Web Mobile validation. Synthetic DOM touch exercises browser input routing,
// not physical touchscreen hardware. Resets the game; do not use during an ongoing match.
async function previewUiResolutionProbe() {
    const engine = await System.import('cc');
    await new Promise(resolve => engine.director.once(engine.Director.EVENT_AFTER_DRAW, resolve));
    const game = engine.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    if (!game) throw new Error('Load Main first.');
    const dpr = engine.screen.devicePixelRatio, size = engine.screen.windowSize;
    const design = engine.view.getDesignResolutionSize();
    const labels = game.status.node.parent.getComponentsInChildren(engine.Label)
        .filter(label => label.enabledInHierarchy && label.string && label.spriteFrame);
    // 3.8.7's system-font assembler exposes its actual raster sampling scale here.
    const samples = labels.map(label => ({name:label.node.name, fontSize:label.fontSize,
        rasterScale:label.textStyle.fontScale, textureWidth:label.spriteFrame.texture.width}));
    const results = [
        {name:'Design resolution matches HUD logical pixels', passed:Math.abs(design.width-size.width/dpr)<.01 && Math.abs(design.height-size.height/dpr)<.01},
        {name:'UI sampling matches render DPR on both axes', passed:Math.abs(engine.view.getScaleX()-dpr)<.001 && Math.abs(engine.view.getScaleY()-dpr)<.001},
        {name:'Visible system-font textures use render DPR', passed:samples.length>0 && samples.every(label=>Math.abs(label.rasterScale-dpr)<.001)},
    ];
    if (results.some(result=>!result.passed)) throw new Error(JSON.stringify({results,samples}));
    return {browserDpr:devicePixelRatio, renderDpr:dpr, design, results, samples};
}

async function previewBrowserValidation() {
    const engine=await System.import('cc'),game=engine.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    if(!game||!navigator.maxTouchPoints)throw new Error('Load Main with browser touch emulation.');
    const canvas=document.getElementById('GameCanvas'),fingers=new Map(),results=[];
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const frame=async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await wait(40);};
    const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw new Error(name);};
    const point=node=>game.hudCamera.worldToScreen(node.worldPosition);
    const table=(x,z)=>game.camera.worldToScreen(new engine.Vec3(x,.028575,z));
    const touch=(id,p)=>{
        const r=canvas.getBoundingClientRect();return new Touch({identifier:id,target:canvas,
            clientX:r.left+p.x/canvas.width*r.width,clientY:r.bottom-p.y/canvas.height*r.height});
    };
    const send=(type,id,p)=>{
        const t=touch(id,p);
        if(type==='touchstart'||type==='touchmove')fingers.set(id,t);else fingers.delete(id);
        canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:[...fingers.values()],targetTouches:[...fingers.values()],changedTouches:[t]}));
    };
    const tap=async node=>{const p=point(node);send('touchstart',101,p);send('touchend',101,p);await frame();};
    const ready=async()=>{game.reset();await frame();await tap(game.actions[1].node.parent);check('Placement confirmation works through DOM touch',game.referee.phase==='ready');};
    const oldPower=game.power;
    try {
        await ready();
        const first=table(.2,.8),other=table(-.2,.3);
        send('touchstart',101,first);const owner=game.activeTouch;send('touchstart',202,other);send('touchcancel',202,other);
        check('Cancelling second finger preserves the owner',game.activeTouch===owner&&game.dragging);
        send('touchmove',101,table(.4,.7));send('touchend',101,table(.4,.7));await frame();
        check('Multi-touch aim release never shoots',game.referee.phase==='ready'&&!game.shotSequence.active&&game.activeTouch===null);
        const direction={...game.direction},powerPoint=point(game.powerControl);
        send('touchstart',101,powerPoint);send('touchmove',101,table(-.4,.2));send('touchend',101,table(-.4,.2));await frame();
        check('Power gesture never turns into table aim',game.direction.x===direction.x&&game.direction.z===direction.z&&game.referee.phase==='ready');
        send('touchstart',101,powerPoint);send('touchcancel',101,powerPoint);await frame();
        check('Cancelled power gesture releases ownership',!game.adjustingPower&&game.activeTouch===null&&!game.shotSequence.active);
        const shot=point(game.shotButton.node);
        send('touchstart',101,shot);send('touchend',101,table(0,0));await frame();
        check('Releasing outside the shoot button cancels the click',!game.shotSequence.active&&game.referee.phase==='ready');
        send('touchstart',101,shot);send('touchcancel',101,shot);await frame();
        check('Cancelled shoot touch never starts a shot',!game.shotSequence.active&&game.pendingAction===null);
        await tap(game.spinButton.node.parent);
        const surface=game.spinPanel.surface.getComponent(engine.UITransform),r=game.spinPanel.selectionRadius;
        const surfacePoint=(x,y)=>game.hudCamera.worldToScreen(surface.convertToWorldSpaceAR(new engine.Vec3(x*r,y*r,0)));
        send('touchstart',101,surfacePoint(0,0));send('touchmove',101,surfacePoint(1.7,1.7));send('touchend',101,surfacePoint(1.7,1.7));await frame();
        check('Tip drag stays within the radial selection boundary',Math.abs(Math.hypot(game.tip.draft.x,game.tip.draft.y)-1)<1e-6);
        check('Tip drag does not apply or shoot',game.tip.value.x===0&&game.referee.phase==='ready'&&!game.shotSequence.active);
        const backdrop={x:canvas.width/2,y:canvas.height-5};send('touchstart',101,backdrop);send('touchend',101,backdrop);await frame();
        check('Backdrop closes the draft without passing touch through',!game.tip.active&&!game.paused&&game.tip.value.x===0);
        await tap(game.fineButton.node.parent);const plus=point(game.finePlus.node.parent);
        for(let i=0;i<70;i++){send('touchstart',101,plus);send('touchend',101,plus);}await frame();
        check('Repeated fine nudges stop at +5 degrees',Math.abs(game.fineAim.degrees-5)<1e-8);
        const minus=point(game.fineMinus.node.parent);
        for(let i=0;i<120;i++){send('touchstart',101,minus);send('touchend',101,minus);}await frame();
        check('Repeated fine nudges stop at -5 degrees',Math.abs(game.fineAim.degrees+5)<1e-8);
        await tap(game.fineButton.node.parent);await tap(game.resetLabel.node);
        const old={...game.balls[0]},angle={...game.direction};
        const behind=[table(-.5,-1),table(.5,-1),table(-.5,1),table(.5,1)].find(p=>![game.resumeButton.node.parent,game.restartButton.node.parent].some(n=>game.hitUi(n,p.x,p.y)));
        if(!behind)throw new Error('No unobstructed table point for the pause fixture.');
        send('touchstart',101,behind);send('touchmove',101,behind);send('touchend',101,behind);await frame();
        check('Pause blocks table input and movement',game.paused&&game.balls[0].x===old.x&&game.balls[0].z===old.z&&game.direction.x===angle.x&&game.direction.z===angle.z);
        await tap(game.restartButton.node.parent);check('Restart requires a separate confirmation',game.confirmingRestart);
        await tap(game.resumeButton.node.parent);check('Cancelling restart preserves the current rack',!game.paused&&game.balls[0].x===old.x&&game.balls[0].z===old.z);
        const bounds=node=>{
            const t=node.getComponent(engine.UITransform),s=t.contentSize;
            const ps=[-1,1].flatMap(x=>[-1,1].map(y=>game.hudCamera.worldToScreen(t.convertToWorldSpaceAR(new engine.Vec3(x*s.width/2,y*s.height/2,0)))));
            return {left:Math.min(...ps.map(p=>p.x)),right:Math.max(...ps.map(p=>p.x)),bottom:Math.min(...ps.map(p=>p.y)),top:Math.max(...ps.map(p=>p.y))};
        };
        const nodes=[game.fineButton.node.parent,game.shotButton.node,game.spinButton.node.parent,game.powerControl];
        check('Projected controls stay inside the browser canvas',nodes.every(n=>{const b=bounds(n);return b.left>=-1&&b.bottom>=-1&&b.right<=canvas.width+1&&b.top<=canvas.height+1;}));
        const dpr=engine.screen.devicePixelRatio;
        check('Main buttons retain 44 logical pixel touch targets',nodes.slice(0,3).every(n=>{const b=bounds(n);return(b.right-b.left)/dpr>=43.9&&(b.top-b.bottom)/dpr>=43.9;}));
        return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},inputMode:'Synthetic DOM touch',results};
    }catch(error){error.results=results;throw error;}
    finally {
        for(const [id,t] of fingers){canvas.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,touches:[],changedTouches:[t]}));fingers.delete(id);}
        game.power=oldPower;game.reset();
    }
}

// Tests lifecycle handlers with explicit Cocos events. This is not an OS/tab visibility test.
async function previewBrowserLifecycleEvents() {
    const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const c=document.getElementById('GameCanvas'),wait=ms=>new Promise(r=>setTimeout(r,ms)),checks={};
    const tap=n=>{const p=g.hudCamera.worldToScreen(n.worldPosition),r=c.getBoundingClientRect(),t=new Touch({identifier:610,target:c,
        clientX:r.left+p.x/c.width*r.width,clientY:r.bottom-p.y/c.height*r.height});
        for(const type of ['touchstart','touchend'])c.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));};
    try {
        g.reset();await wait(100);tap(g.actions[1].node.parent);await wait(100);g.power=1.2;g.direction={x:1,z:0};
        const before={x:g.balls[0].x,z:g.balls[0].z};tap(g.shotButton.node);
        checks.preparingBeforeHide=g.shotSequence.active&&!g.shotSequence.committed;
        m.game.emit(m.Game.EVENT_HIDE);await wait(350);
        checks.hideCancelsPreparation=g.backgrounded&&g.paused&&!g.shotSequence.active&&g.referee.phase==='ready';
        checks.noMotionWhileHidden=g.balls[0].x===before.x&&g.balls[0].z===before.z;
        m.game.emit(m.Game.EVENT_SHOW);await wait(60);checks.showRequiresExplicitResume=!g.backgrounded&&g.paused;
        tap(g.resumeButton.node.parent);await wait(300);checks.noGhostShotAfterResume=!g.paused&&g.referee.phase==='ready'&&g.balls[0].vx===0;
        tap(g.shotButton.node);for(let i=0;i<100&&!g.shotSequence.committed;i++)await wait(5);
        const shot=g.referee.shot;m.game.emit(m.Game.EVENT_HIDE);const p={x:g.balls[0].x,z:g.balls[0].z};await wait(350);
        checks.committedShotFreezes=!!shot&&g.paused&&g.referee.shot===shot&&g.balls[0].x===p.x&&g.balls[0].z===p.z;
        m.game.emit(m.Game.EVENT_SHOW);await wait(60);tap(g.resumeButton.node.parent);await wait(60);
        checks.resumesSameShot=!!shot&&g.referee.shot===shot&&!g.paused&&Math.hypot(g.balls[0].x-p.x,g.balls[0].z-p.z)>0;
        return {mode:'Simulated Cocos hide/show events with DOM resume controls',checks,passed:Object.values(checks).every(Boolean)};
    }finally {m.game.emit(m.Game.EVENT_SHOW);g.reset();}
}

// Full round with controlled target positions, genuine DOM controls and physical pocket events.
// It checks the sequence, not a natural-rack playing strategy.
async function previewControlledRound() {
    const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const c=document.getElementById('GameCanvas'),wait=ms=>new Promise(r=>setTimeout(r,ms)),results=[];
    const frame=()=>wait(80),check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw new Error(name);};
    const tapPoint=async p=>{const r=c.getBoundingClientRect(),t=new Touch({identifier:620,target:c,
        clientX:r.left+p.x/c.width*r.width,clientY:r.bottom-p.y/c.height*r.height});
        for(const type of ['touchstart','touchend'])c.dispatchEvent(new TouchEvent(type,{bubbles:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));await frame();};
    const tap=n=>tapPoint(g.hudCamera.worldToScreen(n.worldPosition));
    const table=(x,z)=>tapPoint(g.camera.worldToScreen(new m.Vec3(x,.028575,z)));
    const settle=async()=>{for(let i=0;i<1500&&(g.shotSequence.active||g.referee.phase==='shooting');i++)await wait(10);
        if(g.shotSequence.active||g.referee.phase==='shooting')throw new Error('Round shot timed out.');};
    const originalPower=g.power;
    try {
        g.reset();await frame();await tap(g.actions[1].node.parent);g.power=.4;await frame();await table(.5,.65);await tap(g.shotButton.node);await settle();
        check('Weak break moves decision to the other player',g.referee.phase==='choice'&&g.referee.current===1);
        await tap(g.panelMode==='break'?g.panels.buttons[g.panels.actionIds.indexOf('break:2')].node.parent:g.actions[2].node.parent);check('Break receiver obtains full-table placement',g.referee.phase==='placing'&&g.referee.hand==='any');
        const arrange=id=>{
            for(const b of g.balls){b.vx=b.vz=0;b.wx=b.wy=b.wz=0;
                if(b.id===0){b.x=.35;b.z=0;}else if(b.id===id){b.x=.52;b.z=0;}
                else if(b.id===8){b.x=0;b.z=-.9;}
                else {b.x=b.id<8?-.45:-.2;b.z=-.9+((b.id-1)%8)*.24;}}
            g.syncVisuals();
        };
        arrange(9);await frame();await table(.35,0);await tap(g.actions[1].node.parent);await tap(g.actions[1].node.parent);
        await wait(300);check('Receiver selects stripes without prematurely assigning groups',g.referee.selected==='stripe'&&g.referee.groups[1]===null);
        for(let id=9;id<=15;id++) {
            arrange(id);g.power=1.2;await frame();await table(.6,0);await tap(g.shotButton.node);await settle();
            check(`Physical pot ${id} keeps the stripe player at the table`,g.balls[id].pocketed&&g.referee.current===1&&g.referee.phase==='ready'&&g.referee.groups[1]==='stripe');
        }
        check('All seven stripes are cleared before the black shot',g.balls.filter(b=>b.id>=9&&!b.pocketed).length===0&&!g.balls[8].pocketed);
        arrange(8);await frame();await table(.6,0);await tap(g.shotButton.node);await settle();
        check('Separate legal black shot wins the complete round',g.referee.phase==='over'&&g.referee.winner===1&&g.referee.message.includes('合法'));
        check('Every settled shot is retained in the actual match history',g.history.entries.length===9&&new Set(g.history.entries.map(e=>e.shotId)).size===9&&g.history.entries.at(-1).winner===1);
        await tap(g.panelMode==='result'?g.panels.buttons[0].node.parent:g.actions[1].node.parent);check('Next round clears groups, winner and tip',g.referee.phase==='placing'&&g.referee.winner===null&&g.referee.groups.every(x=>x===null)&&g.tip.value.x===0&&g.tip.value.y===0);
        return {mode:'Controlled target positions; synthetic DOM controls and real physics',results};
    }catch(error){error.results=results;throw error;}
    finally{g.power=originalPower;g.reset();}
}
