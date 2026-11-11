// Controlled AI status fixtures and result-centering checks in the actual Creator renderer.
async function previewAiStatus() {
    const engine=await System.import('cc'),game=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const checks=[],states=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
    const context=document.createElement('canvas').getContext('2d');
    const oldPractice={...game.practice.value};
    const beginAi=async phase=>{
        game.draftMode='ai';game.startMatch();game.referee.confirmPlacement(game.balls);game.referee.current=1;
        game.referee.phase=phase;game.aiTurn.locked=null;
        game.aiPhaseStamp=[game.gameId,game.referee.current,game.referee.phase,game.referee.hand,game.referee.breakChoice].join('|');
        game.aiActionAt=Infinity;await wait(100);
    };
    const inspect=name=>{
        const label=game.aiWaiting,transform=label.node.getComponent(engine.UITransform),box=game.aiActivity.getComponent(engine.UITransform).getBoundingBoxToWorld();
        context.font=label.fontSize+'px '+label.fontFamily;const textWidth=context.measureText(label.string).width;
        check(name+' status visible in dedicated bar',game.aiActivity.activeInHierarchy&&!game.turnLabel.node.active);
        check(name+' text fits without wrapping',textWidth<=transform.width-2&&!label.enableWrapText&&transform.height>=label.lineHeight);
        check(name+' bar stays inside viewport',box.x>=-game.hudLayout.width/2&&box.x+box.width<=game.hudLayout.width/2&&box.y>=-game.hudLayout.height/2&&box.y+box.height<=game.hudLayout.height/2);
        states.push({name,text:label.string,textWidth,allocatedWidth:transform.width,bar:box});
    };
    try {
        for(const difficulty of ['easy','standard','hard']){
            game.draftDifficulty=difficulty;await beginAi('ready');
            check(difficulty+' thinking copy',game.aiWaiting.string==='AI 正在思考');inspect(difficulty);
        }
        await beginAi('placing');check('placing copy',game.aiWaiting.string==='AI 正在摆放母球');inspect('placing');
        await beginAi('choice');check('break decision copy',game.aiWaiting.string==='AI 正在处理开球结果');inspect('break choice');
        await beginAi('ready');game.aiTurn.locked={difficulty:'standard'};await wait(80);
        check('aiming copy',game.aiWaiting.string==='AI 正在瞄准');inspect('aiming');
        game.power=2;game.shoot(true);await new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
        check('stroke copy',game.aiWaiting.string==='AI 正在击球');inspect('stroke');
        await wait(280);check('moving copy',game.aiWaiting.string==='球运动中');inspect('moving');
        game.pauseGame();await wait(60);check('pause hides status',!game.aiActivity.activeInHierarchy);
        game.draftMode='local';game.startMatch();await wait(80);check('human turn clears AI status',!game.aiActivity.activeInHierarchy&&game.turnLabel.node.active);
        const boxes=[];
        for(const nickname of ['玩家一','林间听风','这是一位昵称很长的玩家用于验证居中布局']){
            game.players[0].nickname=nickname;game.referee.phase='over';game.referee.winner=0;
            game.referee.message='已清空全色球，合法击入8号球，获得本局胜利。';
            game.pauseGame(false);game.panelMode='result';await wait(250);
            const panel=game.panels;
            check(nickname+' winner name centered',panel.section.node.position.x===0&&panel.section.horizontalAlign===engine.Label.HorizontalAlign.CENTER);
            const art=panel.card.getComponent(engine.Graphics).impl,avatar=art.paths[1];
            const xs=avatar.points.map(point=>point.x);
            check(nickname+' avatar centered',Math.abs((Math.min(...xs)+Math.max(...xs))/2)<.01);
            const nodes=[panel.title.node,panel.section.node,panel.body.node,...panel.buttons.slice(0,2).map(label=>label.node.parent)];
            const rects=nodes.map(node=>({name:node.name,rect:node.getComponent(engine.UITransform).getBoundingBoxToWorld()}));
            const overlap=(a,b)=>a.x<b.x+b.width-.1&&b.x<a.x+a.width-.1&&a.y<b.y+b.height-.1&&b.y<a.y+a.height-.1;
            check(nickname+' result regions separated',rects.every((a,i)=>rects.slice(i+1).every(b=>!overlap(a.rect,b.rect))));
            boxes.push(rects);
        }
        return {viewport:[innerWidth,innerHeight,devicePixelRatio],driver:'controlled AI render fixtures',passed:checks.length,total:checks.length,checks,states,boxes};
    }catch(error){return {error:String(error),passed:checks.filter(check=>check.pass).length,total:checks.length,checks,states};}
    finally{game.practice.set(oldPractice);game.draftMode=oldPractice.mode;game.draftDifficulty=oldPractice.difficulty;game.startMatch();}
}
