// Developer-only Creator 3.8.7 check. Injected engine events do not certify device/DOM touch.
async function previewSpinSmoke(engineOverride) {
    const engine=engineOverride||await System.import('cc');
    const game=engine.director.getScene()?.getChildByName('Billiards')?.getComponent('BilliardsGame');
    if(!game||!game.tip||typeof engine.input._dispatchEventTouch!=='function')throw new Error('Load the spin build in Creator 3.8.7.');
    const results=[],measurements={};const originalPower=game.power;
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    const frame=async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));await wait(60);};
    const check=(name,passed)=>{results.push({name,passed:!!passed});if(!passed)throw new Error(name);};
    const event=(point,type,id=94)=>{
        const t=new engine.Touch(point.x,point.y,id),e=new engine.EventTouch([t],false,type,[t]);
        e.touch=t;e.simulate=true;engine.input._dispatchEventTouch(e);
    };
    const tapPoint=async p=>{event(p,engine.Input.EventType.TOUCH_START);event(p,engine.Input.EventType.TOUCH_END);await frame();};
    const tap=n=>tapPoint(game.hudCamera.worldToScreen(n.worldPosition));
    const choose=(x,y)=>{
        const p=game.spinPanel.surface.getComponent(engine.UITransform).convertToWorldSpaceAR(
            new engine.Vec3(x*game.spinPanel.selectionRadius,y*game.spinPanel.selectionRadius,0));
        return tapPoint(game.hudCamera.worldToScreen(p));
    };
    const near=(a,b)=>Math.abs(a-b)<1e-5;
    const ready=async()=>{game.reset();await frame();await tap(game.actions[1].node.parent);check('Touch confirmation reaches ready',game.referee.phase==='ready');};
    const settle=async()=>{for(let i=0;i<1500&&(game.referee.phase==='shooting'||game.shotSequence.active);i++)await wait(10);
        check('Spin shot settles within timeout',game.referee.phase!=='shooting'&&!game.shotSequence.active);};
    const contact=async()=>{for(let i=0;i<200&&!game.shotSequence.committed;i++)await wait(5);check('Spin shot commits at contact',game.shotSequence.committed);};
    try {
        await ready();
        check('Three touch-sized buttons fit without overlap',game.hudLayout.fineButton.x+game.hudLayout.fineButton.width<=game.hudLayout.shoot.x&&
            game.hudLayout.shoot.x+game.hudLayout.shoot.width<=game.hudLayout.spinButton.x&&game.hudLayout.spinButton.width>=44);
        await tap(game.spinButton.node.parent);check('Tip panel opens without shooting',game.tip.active&&game.referee.phase==='ready');
        await choose(.3,-.4);check('Draft does not apply until done',near(game.tip.draft.x,.3)&&near(game.tip.draft.y,-.4)&&game.tip.value.x===0);
        const blocked=game.spinPanel.panel.getComponent(engine.UITransform).convertToWorldSpaceAR(new engine.Vec3(-130,0,0));
        await tapPoint(game.hudCamera.worldToScreen(blocked));
        check('Overlay blocks table placement and aiming',game.referee.phase==='ready'&&game.direction.x===0&&game.balls[0].x===0);
        await tap(game.spinPanel.done.node.parent);
        check('Done applies tip without shooting',!game.tip.active&&near(game.tip.value.x,.3)&&near(game.tip.value.y,-.4)&&game.referee.phase==='ready');
        check('Confirmed tip is visible beside power',game.powerLabel.string.includes('低杆')&&game.powerLabel.string.includes('右塞'));
        await tap(game.spinButton.node.parent);await choose(-.5,.5);await tap(game.spinPanel.cancel.node.parent);
        check('Cancel restores previous confirmed tip',near(game.tip.value.x,.3)&&near(game.tip.value.y,-.4));
        await tap(game.spinButton.node.parent);await tap(game.spinPanel.center.node.parent);
        check('Recenter changes only draft',game.tip.draft.x===0&&near(game.tip.value.x,.3));
        await tap(game.spinPanel.cancel.node.parent);await tap(game.spinButton.node.parent);await choose(.95,.95);
        check('Diagonal selection is bounded by a circle',near(Math.hypot(game.tip.draft.x,game.tip.draft.y),1));
        await tap(game.spinPanel.center.node.parent);await tap(game.spinPanel.done.node.parent);
        check('Confirmed recenter restores centre tip',game.tip.value.x===0&&game.tip.value.y===0);
        await tap(game.spinButton.node.parent);await choose(.3,-.4);await tap(game.spinPanel.done.node.parent);
        game.direction={x:1,z:0};game.power=.8;await frame();await tap(game.shotButton.node);
        const snapshot=game.shotSequence.snapshot;
        check('Shot reserves confirmed tip',near(snapshot.tipOffset.x,.3)&&near(snapshot.tipOffset.y,-.4));
        await tap(game.spinButton.node.parent);check('Preparing shot blocks tip editing',!game.tip.active);
        await contact();check('Tip drives actual angular velocity',game.balls[0].wy>0&&game.balls[0].wz>0);
        await settle();check('Tip recenters after referee settlement',game.tip.value.x===0&&game.tip.value.y===0);
        const shotCase=async(tip,cushion=false)=>{
            await ready();game.referee.isBreak=false;game.referee.hand=null;game.referee.groups=['solid','stripe'];
            game.balls.forEach(b=>Object.assign(b,{pocketed:![0,1].includes(b.id),vx:0,vz:0,wx:0,wy:0,wz:0}));
            Object.assign(game.balls[0],{x:cushion ? .586425 : 0,z:cushion ? .35 : .8});
            Object.assign(game.balls[1],{x:cushion?-.3:0,z:cushion?-.5:.58});
            game.direction=cushion?{x:1,z:0}:{x:0,z:-1};game.power=cushion?2:2.8;
            await frame();await tap(game.spinButton.node.parent);await choose(tip.x,tip.y);await tap(game.spinPanel.done.node.parent);
            let observed=false;const ref=game.referee,original=ref.observe;
            ref.observe=function(e,balls){original.call(this,e,balls);if(cushion?e.type==='cushion'&&e.id===0:e.type==='contact'&&(e.a===0||e.b===0))observed=true;};
            await tap(game.shotButton.node);
            for(let i=0;i<400&&!observed;i++)await wait(5);check(cushion?'Spin reaches cushion':'Spin reaches object ball',observed);
            if(!cushion)await wait(450);
            return game.balls[0].vz;
        };
        measurements.followVz=await shotCase({x:0,y:.8});check('High tip follows after head-on contact',measurements.followVz<-.2);
        measurements.drawVz=await shotCase({x:0,y:-.8});check('Low tip draws after head-on contact',measurements.drawVz>.2);
        measurements.leftVz=await shotCase({x:-.8,y:0},true);
        measurements.rightVz=await shotCase({x:.8,y:0},true);
        check('Opposite english gives opposite cushion departure',measurements.leftVz*measurements.rightVz<0);
        return {engine:'3.8.7',inputMode:'Creator internal touch dispatcher',results,measurements};
    } catch(error){error.results=results;throw error;}
    finally{game.power=originalPower;game.reset();}
}
