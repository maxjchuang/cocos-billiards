const {test}=require('node:test');
const assert=require('node:assert/strict');
const {computeHudLayout}=require(process.env.BILLIARDS_LAYOUT_MODULE);
const overlap=(a,b)=>a.x<b.x+b.width-0.001 && b.x<a.x+a.width-0.001 && a.y<b.y+b.height-0.001 && b.y<a.y+a.height-0.001;

for(const [width,height] of [[320,568],[360,640],[393,852],[430,932],[736,842],[768,1024],[852,393]]) {
    test(`header, table and controls never overlap at ${width}x${height}`,()=>{
        // Any consistent UI-space scale should have identical separation guarantees.
        const factor=960/width;
        const ui=computeHudLayout(width*factor,height*factor);
        const independent=[ui.status,ui.reset,...ui.players,ui.playArea,ui.dock];
        for(const rect of independent) {
            assert.ok(rect.width>0&&rect.height>0);
            assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=ui.width+0.001&&rect.y+rect.height<=ui.height+0.001);
        }
        for(let i=0;i<independent.length;i++) for(let j=i+1;j<independent.length;j++)
            assert.equal(overlap(independent[i],independent[j]),false,`regions ${i} and ${j} overlap`);
        const controls=[ui.decision,ui.actions,ui.power];
        for(const rect of controls) {
            assert.ok(rect.x>=ui.dock.x&&rect.y>=ui.dock.y);
            assert.ok(rect.x+rect.width<=ui.dock.x+ui.dock.width+0.001);
            assert.ok(rect.y+rect.height<=ui.dock.y+ui.dock.height+0.001);
        }
        for(let i=0;i<controls.length;i++) for(let j=i+1;j<controls.length;j++) assert.equal(overlap(controls[i],controls[j]),false);
    });
}

for (const [width,height,top,bottom] of [[320,568,0,0],[393,852,59,34],[430,932,59,34]]) {
    for (const [phase, actionCount, showPower] of [['placing',1,false],['ready',0,true],['open',2,true],['choice',3,false]]) {
        test(`${phase} respects safe area and minimum touch sizes at ${width}x${height}`,()=>{
            const ui=computeHudLayout(width,height,{insets:{top,bottom},actionCount,showPower});
            for(const rect of [ui.status,ui.reset,...ui.players,ui.turn,ui.playArea,ui.dock]) {
                assert.ok(rect.y>=top);
                assert.ok(rect.y+rect.height<=height-bottom);
                assert.ok(rect.height>0);
            }
            assert.ok(ui.reset.height>=44);
            assert.ok(ui.playArea.y>=ui.turn.y+ui.turn.height);
            assert.ok(ui.playArea.y+ui.playArea.height<=ui.dock.y);
            if(actionCount) assert.ok(ui.actions.height>=48);
            if(showPower) assert.ok(ui.power.height>=44);
            else assert.equal(ui.power.height,0);
        });
    }
}

for(const [width,height,top,bottom] of [[320,568,0,0],[393,852,59,34],[430,932,59,34]]) {
    test(`shot and fine aim retain minimum touch bounds at ${width}x${height}`,()=>{
        for(const showFine of [false,true]) {
            const ui=computeHudLayout(width,height,{insets:{top,bottom},showShot:true,showFine,actionCount:2,showPower:true});
            assert.ok(ui.playArea.height>0);
            assert.ok(ui.fineButton.width>=44&&ui.fineButton.height>=44);
            assert.ok(ui.shoot.width>=44&&ui.shoot.height>=44);
            assert.ok(ui.spinButton.width>=44&&ui.spinButton.height>=44);
            const controls=[ui.decision,ui.actions,ui.power,ui.shoot,ui.fineButton,ui.spinButton];
            if(showFine)controls.push(ui.fine);
            for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++)assert.equal(overlap(controls[i],controls[j]),false);
            for(const r of controls)assert.ok(r.y>=ui.dock.y&&r.y+r.height<=height-bottom);
        }
    });
}
