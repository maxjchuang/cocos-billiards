// Inspect actual card Graphics and labels, including compact and expanded caller sizes.
async function previewPlayerCards() {
    const engine=await System.import('cc'),game=engine.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame');
    const checks=[],cases=[],wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(name,pass)=>{checks.push({name,pass:!!pass});if(!pass)throw Error(name);};
    const solid=[1,2,3,4,5,6,7],stripe=[9,10,11,12,13,14,15];
    try {
        game.draftMode='local';game.startMatch();game.referee.confirmPlacement(game.balls);
        game.referee.isBreak=false;game.referee.groups=['solid','stripe'];game.referee.selected='solid';await wait(100);
        for(const card of game.playerCards){
            const numbers=card.numbers;
            check(card.node.name+' compact ball labels hidden',numbers.every(label=>!label.node.active));
        }
        const card=game.playerCards[0],transform=card.node.getComponent(engine.UITransform),art=card.node.getComponent(engine.Graphics);
        for(const width of [134.5,148,171])for(const height of [44,56,64,74])for(const group of ['solid','stripe'])for(const level of ['','标准']){
            transform.setContentSize(width,height);
            const profile={id:'fixture',nickname:'凌晨三点还在练球的长昵称玩家',avatar:level?'fox':'forest'};
            card.render(profile,0,group,[],true,width,height,1,level);
            const emptyPaths=art.impl.pathLength;
            for(const count of [1,7]){
                const ids=(group==='solid'?solid:stripe).slice(0,count),name=[width,height,group,level||'local',count].join('/');
                card.render(profile,0,group,ids,true,width,height,1,level);
                const visible=card.numbers.filter(label=>label.node.active);
                check(name+' number row visibility',visible.length===(height>=64?count:0));
                check(name+' group count retained',card.groupLabel.string.includes('剩'+count));
                if(height<64){
                    check(name+' hidden balls leave no drawing',art.impl.pathLength===emptyPaths);
                    check(name+' target fallback hidden',!card.fallbackLabel.node.active);
                }else{
                    const radius=width<150?8:9,groupBottom=card.groupLabel.node.position.y-card.groupLabel.node.getComponent(engine.UITransform).height/2;
                    check(name+' ball row stays below group text',visible.every(label=>label.node.position.y+radius<groupBottom));
                    check(name+' balls stay within card',visible.every(label=>Math.abs(label.node.position.x)+radius<=width/2&&Math.abs(label.node.position.y)+radius<=height/2));
                }
                cases.push({width,height,group,level,count,visibleNumbers:visible.length,graphicsPaths:art.impl.pathLength});
            }
        }
        game.startMatch();game.referee.confirmPlacement(game.balls);game.referee.isBreak=false;game.referee.groups=['solid','stripe'];game.referee.selected='solid';await wait(100);
        const canvas=document.getElementById('GameCanvas'),rect=canvas.getBoundingClientRect(),point=game.hudCamera.worldToScreen(game.playerCards[0].node.worldPosition);
        const touch=new Touch({identifier:77,target:canvas,clientX:rect.left+point.x/canvas.width*rect.width,clientY:rect.bottom-point.y/canvas.height*rect.height});
        for(const type of ['touchstart','touchend']){
            canvas.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchstart'?[touch]:[],targetTouches:type==='touchstart'?[touch]:[],changedTouches:[touch]}));
            await new Promise(resolve=>engine.director.once(engine.Director.EVENT_AFTER_DRAW,resolve));
        }
        await wait(120);
        check('compact card opens identity through DOM touch',game.panelMode==='identity');
        check('identity exposes all seven remaining numbers',game.panels.targetLabels.filter(label=>label.node.active).length===7);
        return {viewport:[innerWidth,innerHeight,devicePixelRatio],driver:'actual Cocos card renderer and DOM identity tap',passed:checks.length,total:checks.length,checks,cases};
    }catch(error){return {error:String(error),passed:checks.filter(check=>check.pass).length,total:checks.length,checks,cases};}
    finally{game.draftMode='local';game.startMatch();}
}
