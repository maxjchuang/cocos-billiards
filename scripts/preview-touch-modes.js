// Development regression. Uses synthetic DOM touches on the actual Creator canvas.
// Starts controlled local matches and restores a fresh local match when complete.
async function previewTouchModes() {
    const engine=await System.import('cc');
    const game=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    if(!game?.tableView||game.booting)throw Error('Wait for the table resource.');
    const checks=[],canvas=document.getElementById('GameCanvas'),fingers=new Map();
    const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const frame=()=>wait(80);
    const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
    const hud=(x,y)=>({x:x*game.hudPixelRatio,y:(game.hudLayout.height-y)*game.hudPixelRatio});
    const point=node=>game.hudCamera.worldToScreen(node.worldPosition);
    const table=(x,z)=>game.camera.worldToScreen(new engine.Vec3(x,.028575,z));
    const send=async(type,id,p)=>{
        const rect=canvas.getBoundingClientRect();
        const touch=new Touch({identifier:id,target:canvas,clientX:rect.left+p.x/canvas.width*rect.width,clientY:rect.bottom-p.y/canvas.height*rect.height});
        if(type==='touchstart'||type==='touchmove')fingers.set(id,touch);else fingers.delete(id);
        canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:[...fingers.values()],targetTouches:[...fingers.values()],changedTouches:[touch]}));
        await new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
    };
    const movePair=async(aId,a,bId,b)=>{
        const rect=canvas.getBoundingClientRect();
        const touches=[[aId,a],[bId,b]].map(([id,p])=>new Touch({identifier:id,target:canvas,clientX:rect.left+p.x/canvas.width*rect.width,clientY:rect.bottom-p.y/canvas.height*rect.height}));
        for(const touch of touches)fingers.set(touch.identifier,touch);
        canvas.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[...fingers.values()],targetTouches:[...fingers.values()],changedTouches:touches}));
        await new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
    };
    const tap=async node=>{const p=point(node);await send('touchstart',1,p);await send('touchend',1,p);await frame();};
    const mode=async name=>{await tap(game.modeButtons[['free','top','aim'].indexOf(name)].node.parent);await wait(350);check('mode '+name+' via DOM',game.interactionMode===name);};
    const ready=async()=>{fingers.clear();game.draftMode='local';game.startMatch();await frame();await tap(game.actions[1].node.parent);check('DOM placement confirmation',game.referee.phase==='ready');};
    const same=(a,b)=>Math.abs(a.x-b.x)<1e-6&&Math.abs(a.z-b.z)<1e-6;
    const drag=async(id,a,b)=>{await send('touchstart',id,a);await send('touchmove',id,b);await send('touchend',id,b);};
    const oldMotion=game.settings.value.reducedMotion;
    try {
        game.settings.set('reducedMotion',false);
        await ready();check('placement starts top',game.interactionMode==='top'&&game.cameraRig.top);
        check('top is orthographic',game.camera.projection===engine.Camera.ProjectionType.ORTHO);
        const longA=table(0,-1),longB=table(0,1);check('table long edge is horizontal',Math.abs(longA.x-longB.x)>Math.abs(longA.y-longB.y)*10);
        const before=JSON.stringify(game.balls),cue=game.balls[0];
        for(const [index,target] of [[.2,-.35],[-.25,-.55],[.15,.1]].entries()){
            const p=table(...target);await send('touchstart',11,p);
            const hit=game.tablePoint(p.x,p.y),dx=hit.x-cue.x,dz=hit.z-cue.z,length=Math.hypot(dx,dz);
            check('top points on press '+index,same(game.direction,{x:dx/length,z:dz/length}));
            const other=table(target[0]-.1,target[1]+.1);await send('touchmove',11,other);
            const next=game.tablePoint(other.x,other.y),len=Math.hypot(next.x-cue.x,next.z-cue.z);
            check('top follows drag '+index,same(game.direction,{x:(next.x-cue.x)/len,z:(next.z-cue.z)/len}));
            const final={...game.direction};await send('touchend',11,other);check('top retains direction '+index,same(game.direction,final));
        }
        check('top never shoots',JSON.stringify(game.balls)===before&&!game.shotSequence.active);
        const direction={...game.direction};
        await send('touchstart',21,hud(380,170));await send('touchstart',22,hud(480,170));
        check('second finger restores top direction',same(game.direction,direction));
        const targetBefore={...game.cameraRig.topTarget};
        await movePair(21,hud(400,180),22,hud(500,180));
        check('parallel touch pans anchor',!same(game.cameraRig.topTarget,targetBefore));
        await send('touchend',22,hud(500,180));await send('touchmove',21,hud(420,180));await send('touchend',21,hud(420,180));
        check('pair leaves direction intact',same(game.direction,direction)&&!game.observationBlocked);
        await tap(game.viewButton.node.parent);check('center restores top anchor',same(game.cameraRig.topTarget,{x:0,z:0}));
        await mode('free');const free=JSON.stringify(game.cameraRig.freePose);let aim={...game.direction};
        const tapPoint=table(.25,-.3);
        await send('touchstart',30,tapPoint);check('free press waits for release',same(game.direction,aim));
        await send('touchend',30,tapPoint);
        const tapHit=game.tablePoint(tapPoint.x,tapPoint.y),tapDx=tapHit.x-game.balls[0].x,tapDz=tapHit.z-game.balls[0].z,tapLength=Math.hypot(tapDx,tapDz);
        check('free tap aims at table point',same(game.direction,{x:tapDx/tapLength,z:tapDz/tapLength}));
        check('free tap preserves camera and never shoots',JSON.stringify(game.cameraRig.freePose)===free&&!game.shotSequence.active);
        const forward=engine.Vec3.transformQuat(new engine.Vec3(),new engine.Vec3(0,0,1),game.aim.worldRotation),forwardLength=Math.hypot(forward.x,forward.z);
        check('free cue is visible and points at the target',game.aim.activeInHierarchy&&same(game.direction,{x:forward.x/forwardLength,z:forward.z/forwardLength}));
        aim={...game.direction};
        await drag(31,hud(420,150),hud(455,170));await frame();
        check('single finger orbits in free',JSON.stringify(game.cameraRig.freePose)!==free&&same(game.direction,aim));
        const anchor={...game.cameraRig.freePose.target};
        await send('touchstart',32,hud(380,170));await send('touchstart',33,hud(480,170));
        await movePair(32,hud(398,178),33,hud(498,178));
        await send('touchend',33,hud(498,178));await send('touchend',32,hud(398,178));await frame();
        check('free anchor pans',!same(game.cameraRig.freePose.target,anchor));
        const distance=game.cameraRig.freePose.distance;
        await send('touchstart',34,hud(380,170));await send('touchstart',35,hud(480,170));
        await movePair(34,hud(350,170),35,hud(510,170));
        await send('touchend',35,hud(510,170));await send('touchend',34,hud(350,170));await frame();
        check('pinch changes distance',Math.abs(game.cameraRig.freePose.distance-distance)>.001);
        const freeSaved=JSON.stringify(game.cameraRig.freePose);
        await mode('aim');const fixed={...game.direction};
        await drag(41,hud(420,140),hud(420,140));check('aim tap does not turn',same(game.direction,fixed));
        await drag(42,hud(420,140),hud(455,140));check('aim drag turns without firing',!same(game.direction,fixed)&&!game.shotSequence.active);
        check('player shot button hidden',!game.shotButton.node.activeInHierarchy);
        const powerStart=hud(420,130),loaded=hud(420,226);
        await send('touchstart',43,powerStart);await send('touchmove',43,loaded);await frame();
        check('pull loads maximum without shooting',Math.abs(game.power-4)<1e-6&&!game.shotSequence.active);
        check('power feedback visible',game.powerControl.activeInHierarchy);
        await send('touchmove',43,hud(420,132));await send('touchend',43,hud(420,132));
        check('return zero cancels',game.power===0&&!game.shotSequence.active);
        await send('touchstart',44,powerStart);await send('touchmove',44,loaded);await send('touchcancel',44,loaded);
        check('system cancellation clears pull',game.power===0&&!game.shotSequence.active);
        await send('touchstart',45,powerStart);await send('touchmove',45,loaded);await send('touchstart',46,hud(530,180));
        await send('touchend',45,loaded);await send('touchend',46,hud(530,180));
        check('second finger cancels pull',game.power===0&&!game.shotSequence.active);
        await send('touchstart',47,hud(550,game.hudLayout.height-30));await send('touchmove',47,hud(550,game.hudLayout.height-10));
        check('bottom start waits for space',game.pullGesture.waitingForSpace&&game.power===0);
        await send('touchmove',47,hud(550,130));await send('touchmove',47,hud(550,226));
        check('bottom rebase reaches full power',!game.pullGesture.waitingForSpace&&Math.abs(game.power-4)<1e-6);
        await send('touchcancel',47,hud(550,226));
        await tap(game.fineButton.node.parent);check('fine strip opens',game.fineAim.active);
        const strip=point(game.fineControl),angle={...game.direction};
        for(let n=0;n<3;n++)await drag(48,strip,{x:strip.x+150*game.hudPixelRatio,y:strip.y});
        check('fine supports repeated relative drags',Math.abs(game.fineAim.degrees)>5&&!same(game.direction,angle));
        await tap(game.fineButton.node.parent);await tap(game.spinButton.node.parent);check('tip panel opens',game.tip.active);
        game.tip.select(.3,-.4);await tap(game.spinPanel.done.node.parent);check('tip confirmation persists',game.tip.value.x===.3&&game.tip.value.y===-.4);
        await send('touchstart',49,powerStart);await send('touchmove',49,loaded);
        const origin=JSON.stringify(game.balls);await send('touchend',49,loaded);
        check('release starts forward sequence',game.shotSequence.active&&!game.shotSequence.committed&&game.shotSequence.contactMs===160);
        check('balls still before contact',JSON.stringify(game.balls)===origin);
        game.pauseGame();check('precontact pause cancels',!game.shotSequence.active&&game.referee.phase==='ready');
        game.modalAction('resume');await frame();
        let contacts=0,poseAtContact=null;const original=game.referee.beginShot;
        game.referee.beginShot=function(...args){contacts++;poseAtContact={elapsed:game.shotSequence.elapsedMs,contact:game.shotSequence.contactMs};return original.apply(this,args);};
        try{
            await send('touchstart',50,powerStart);await send('touchmove',50,loaded);await send('touchend',50,loaded);
            await wait(450);
            check('unique real contact',contacts===1&&poseAtContact.elapsed===poseAtContact.contact&&game.shotSequence.committed);
            check('physical balls move after contact',JSON.stringify(game.balls)!==origin);
        }finally{game.referee.beginShot=original;}
        await mode('top');check('motion can be observed top',game.referee.phase==='shooting'&&game.cameraRig.top);
        await mode('free');check('free camera memory retained',JSON.stringify(game.cameraRig.freePose)===freeSaved);
        game.hideGame();check('background clears touch ownership',!game.pullGesture.active&&game.activeTouch===null&&game.observationTouches.size===0);
        game.showGame();game.modalAction('resume');
        const rects=[...game.modeButtons.map(label=>label.node.parent),game.fineButton.node.parent,game.spinButton.node.parent];
        check('controls meet 44px touch size',rects.every(node=>{const t=node.getComponent(engine.UITransform);return t.width>=44&&t.height>=44;}));
        return {engine:engine.VERSION,viewport:[innerWidth,innerHeight,devicePixelRatio],driver:'synthetic DOM TouchEvent',passed:checks.length,total:checks.length,checks};
    }catch(error){return {error:String(error),state:{direction:game.direction,phase:game.referee.phase,pending:game.pendingAction,active:game.activeTouch,blocked:game.observationBlocked,touches:[...game.observationTouches],mode:game.interactionMode,dragging:game.dragging,paused:game.paused,transition:game.cameraRig.transitioning,intent:game.observationIntent,pair:game.observationPair},checks,passed:checks.filter(c=>c.pass).length,total:checks.length};}
    finally{for(const [id,touch] of [...fingers])await send('touchcancel',id,{x:(touch.clientX-canvas.getBoundingClientRect().left)/canvas.getBoundingClientRect().width*canvas.width,y:(canvas.getBoundingClientRect().bottom-touch.clientY)/canvas.getBoundingClientRect().height*canvas.height});game.settings.set('reducedMotion',oldMotion);fingers.clear();game.draftMode='local';game.startMatch();}
}

// Component-entry probe of rendered tip position and variable human contact timing.
async function previewTouchContact() {
    const engine=await System.import('cc'),game=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const results=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    try {
        for(const fraction of [.1,.5,1]){
            game.draftMode='local';game.startMatch();game.referee.confirmPlacement(game.balls);game.setInteractionMode('aim',true);
            await wait(350);
            const samples=[],origin={...game.balls[0]},direction={...game.direction};
            const sample=()=>{
                if(!game.shotSequence.active)return;
                const tip=engine.Vec3.transformMat4(new engine.Vec3(),new engine.Vec3(0,0,.275),game.aim.worldMatrix);
                const expected={x:origin.x-direction.x*.028575,y:.028575,z:origin.z-direction.z*.028575};
                samples.push({ms:game.shotSequence.elapsedMs,contact:game.shotSequence.contactMs,
                    tipError:Math.hypot(tip.x-expected.x,tip.y-expected.y,tip.z-expected.z),
                    visible:game.aim.activeInHierarchy,opacity:game.ballView.cueOpacity,
                    speed:Math.hypot(game.balls[0].vx,game.balls[0].vz)});
            };
            engine.director.on(engine.Director.EVENT_AFTER_DRAW,sample);
            try {
                const y=130,dy=4+92*fraction**(1/1.6),ratio=game.hudPixelRatio;
                game.begin(420*ratio,(game.hudLayout.height-y)*ratio);
                game.move(420*ratio,(game.hudLayout.height-y-dy)*ratio);
                game.release(420*ratio,(game.hudLayout.height-y-dy)*ratio);
                const timing=game.shotSequence.contactMs;
                await wait(500);
                const contact=samples.find(frame=>Math.abs(frame.ms-frame.contact)<1e-6);
                const pass=Math.abs(timing-(100+60*fraction))<1e-5&&!!contact&&contact.visible&&contact.tipError<.00002&&contact.speed>0&&
                    samples.filter(frame=>frame.ms<frame.contact).every(frame=>frame.speed===0)&&samples.some(frame=>frame.opacity>0&&frame.opacity<1);
                results.push({fraction,contactMs:timing,contact,passed:pass,samples});
            }finally{engine.director.off(engine.Director.EVENT_AFTER_DRAW,sample);}
        }
        return {driver:'component touch logic and actual after-draw frames',passed:results.filter(r=>r.passed).length,total:results.length,results};
    }finally{game.draftMode='local';game.startMatch();}
}
