// Controlled UI fixtures in Creator. Synthetic DOM touch is separate from hardware testing.
async function previewUiFixes() {
    const engine=await System.import('cc'),game=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const checks=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
    const canvas=document.getElementById('GameCanvas');
    const tap=async node=>{
        const p=game.hudCamera.worldToScreen(node.worldPosition),rect=canvas.getBoundingClientRect();
        const touch=new Touch({identifier:87,target:canvas,clientX:rect.left+p.x/canvas.width*rect.width,clientY:rect.bottom-p.y/canvas.height*rect.height});
        for(const type of ['touchstart','touchend']){
            canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchstart'?[touch]:[],targetTouches:type==='touchstart'?[touch]:[],changedTouches:[touch]}));
            await new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
        }
        await wait(100);
    };
    const oldGuide=game.settings.value.aimGuide;
    try {
        game.draftMode='local';game.startMatch();game.referee.confirmPlacement(game.balls);game.setInteractionMode('aim',true);await wait(350);
        check('mode labels',game.modeButtons.map(label=>label.string).join('|')==='自由观察|俯视观察|瞄准击球');
        check('mode text centered with full width',game.modeButtons.every(label=>label.node.position.x===0&&label.node.getComponent(engine.UITransform).width===64));
        check('mode backgrounds have no icon paths',game.modeButtons.every(label=>label.node.parent.getComponent(engine.Graphics).impl.pathLength===1));
        game.settings.set('aimGuide',true);game.power=0;game.drawAimGuide();await wait(80);
        const view=game.trajectoryView;
        check('zero power direction guide visible',view.node.activeInHierarchy&&view.nodes[0].active&&view.meshes[0]?.readAttribute(0,'a_position').length>0);
        check('zero power shows contact and hides target prediction',view.ghost.active&&!view.nodes[1].active);
        const mesh=view.meshes[0];game.drawAimGuide();game.drawAimGuide();
        check('stationary guide reuses mesh',view.meshes[0]===mesh);
        const cue=game.balls[0],near={x:cue.x,z:cue.z,distance:0,target:null};
        view.renderContact(cue,near);view.renderContact(cue,near);check('zero length contact cannot resurrect old line',!view.nodes[0].active);
        game.drawAimGuide();game.settings.set('aimGuide',false);game.drawAimGuide();check('guide setting respected',!view.node.active);
        game.settings.set('aimGuide',true);const ratio=game.hudPixelRatio;
        game.begin(420*ratio,(game.hudLayout.height-130)*ratio);game.move(450*ratio,(game.hudLayout.height-130)*ratio);game.release(450*ratio,(game.hudLayout.height-130)*ratio);await wait(100);
        check('angle drag retains zero power guide',game.power===0&&view.node.activeInHierarchy&&view.nodes[0].active);
        game.begin(420*ratio,(game.hudLayout.height-130)*ratio);game.move(420*ratio,(game.hudLayout.height-200)*ratio);await wait(1200);
        check('positive pull predicts trajectories',game.power>0&&game.aimPrediction&&game.aimPrediction.status!=='invalid'&&view.node.activeInHierarchy);
        game.cancelDrag();await wait(100);check('cancel pull restores direction guide',game.power===0&&view.node.activeInHierarchy&&view.nodes[0].active&&!view.nodes[1].active);
        const boxes=[];
        for(const reason of ['合法击入8号球，获得本局胜利。','对手提前击入8号球并犯规，判负。本局由玩家一获胜。'.repeat(3)]){
            game.referee.phase='over';game.referee.winner=0;game.referee.message=reason;
            game.players[0].nickname='这是一位昵称很长的台球玩家用于布局验证';
            game.pauseGame(false);game.panelMode='result';await wait(250);
            const panels=game.panels,controls=[panels.title.node,panels.section.node,panels.body.node,...panels.buttons.slice(0,2).map(label=>label.node.parent)];
            const rects=controls.map(node=>({name:node.name,rect:node.getComponent(engine.UITransform).getBoundingBoxToWorld()}));
            const overlap=(a,b)=>a.x<b.x+b.width-.1&&b.x<a.x+a.width-.1&&a.y<b.y+b.height-.1&&b.y<a.y+a.height-.1;
            check('result visual regions do not overlap '+boxes.length,rects.every((a,i)=>rects.slice(i+1).every(b=>!overlap(a.rect,b.rect))));
            const card=panels.card.getComponent(engine.UITransform).getBoundingBoxToWorld();
            check('result regions fit card '+boxes.length,rects.every(({rect:r})=>r.x>=card.x&&r.y>=card.y&&r.x+r.width<=card.x+card.width&&r.y+r.height<=card.y+card.height));
            check('winner nickname and identity available '+boxes.length,panels.section.node.activeInHierarchy&&!!panels.section.string&&panels.identityTarget.activeInHierarchy&&!panels.badge.node.active);
            boxes.push(rects);
        }
        await tap(game.panels.identityTarget);check('winner identity action works',game.panelMode==='identity');
        game.modalAction('close-identity');await wait(100);
        await tap(game.panels.buttons[1].node.parent);check('view table action works',game.panelMode==='view');
        await tap(game.panels.buttons[0].node.parent);check('return result action works',game.panelMode==='result');
        await tap(game.panels.buttons[0].node.parent);check('new round action works',game.referee.phase==='placing'&&!game.panelMode);
        return {viewport:[innerWidth,innerHeight,devicePixelRatio],driver:'synthetic DOM touch plus controlled render fixtures',passed:checks.length,total:checks.length,checks,boxes};
    }catch(error){return {error:String(error),passed:checks.filter(c=>c.pass).length,total:checks.length,checks};}
    finally{game.settings.set('aimGuide',oldGuide);game.draftMode='local';game.startMatch();}
}
