const {test}=require('node:test');
const assert=require('node:assert/strict');
const {computeHudLayout,computeHudViewport,placeMagnifier}=require(process.env.BILLIARDS_LAYOUT_MODULE);
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

test('frozen 393 reference matches approved cards, controls and table viewport',()=>{
 const l=computeHudLayout(393,852,{insets:{top:47,bottom:34},actionCount:0,showPower:true,showShot:true,showDecision:false});
 assert.deepEqual(l.players[0],{x:20,y:99,width:171,height:74});assert.deepEqual(l.players[1],{x:202,y:99,width:171,height:74});
 assert.deepEqual(l.shoot,{x:112,y:766,width:169,height:48});assert.equal(l.power.y,703);assert.equal(l.playArea.y,211);assert.equal(l.playArea.height,476);
 const projectedWidth=l.playArea.height*1.54/2.82;assert.ok(Math.abs(projectedWidth-259.9432624113475)<1e-6);
});


test('embedded preview zoom preserves a complete mobile layout and inverse pointer mapping',()=>{
    const v=computeHudViewport(358,780,2);
    assert.equal(v.width,320);assert.ok(Math.abs(v.height-697.2067039106145)<1e-8);
    assert.ok(Math.abs(v.pixelRatio-358/320)<1e-10);
    const ui=computeHudLayout(v.width,v.height,{showPower:true,showShot:true,actionCount:0,showDecision:false});
    for(const r of [ui.shoot,ui.fineButton,ui.spinButton,...ui.players]){
        assert.ok(r.x>=0&&r.width>=44&&r.height>=44&&r.x+r.width<=v.width);
        const physicalX=(r.x+r.width/2)*v.pixelRatio,physicalY=(v.height-r.y-r.height/2)*v.pixelRatio;
        assert.ok(Math.abs(physicalX/v.pixelRatio-r.x-r.width/2)<1e-8);
        assert.ok(Math.abs((780-physicalY)/v.pixelRatio-r.y-r.height/2)<1e-8);
    }
    assert.ok(ui.playArea.height>200);
    for(const [w,h,dpr] of [[786,1704,2],[320,568,1],[860,1864,2]])assert.deepEqual(computeHudViewport(w,h,dpr),{width:w/dpr,height:h/dpr,pixelRatio:dpr});
});


const geometry=require(require('node:path').join(require('node:path').dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsTableGeometry.js'));
const projectedPockets=area=>{
    const scale=Math.min(area.width/1.54,area.height/2.82);
    return geometry.POCKETS.map(p=>{
        const pts=p.outline.map(q=>({x:area.x+area.width/2+q.x*scale,y:area.y+area.height/2+q.z*scale}));
        const x=Math.min(...pts.map(q=>q.x))-12,y=Math.min(...pts.map(q=>q.y))-12;
        return {x,y,width:Math.max(...pts.map(q=>q.x))-x+12,height:Math.max(...pts.map(q=>q.y))-y+12};
    });
};
for(const [w,h] of [[320,568],[393,852],[430,932]])test(`magnifier exposes all six pockets and first contact at ${w}x${h}`,()=>{
    const area=computeHudLayout(w,h,{actionCount:0,showDecision:false}).playArea,pockets=projectedPockets(area);
    const old={x:area.x+8,y:area.y+8,width:132,height:116};assert.ok(pockets.some(p=>overlap(old,p)),'old top corner hides a real pocket');
    for(const pocket of pockets){
        const finger={x:pocket.x+pocket.width/2,y:pocket.y+pocket.height/2};
        const contact={x:area.x+area.width/2-18,y:area.y+area.height*.65-18,width:36,height:36};
        const r=placeMagnifier(area,[...pockets,contact],finger,null);
        assert.ok(r,'an unobstructed placement exists');assert.ok([...pockets,contact].every(p=>!overlap(r,p)));
        assert.ok(!overlap(r,{x:finger.x-24,y:finger.y-24,width:48,height:48}));
        assert.ok(r.x>=area.x&&r.y>=area.y&&r.x+r.width<=area.x+area.width+.001&&r.y+r.height<=area.y+area.height+.001);
    }
});
test('magnifier holds a safe position and relocates when the finger enters it',()=>{
    const area={x:20,y:180,width:353,height:476},pockets=projectedPockets(area),finger={x:250,y:550};
    const first=placeMagnifier(area,pockets,finger,null);assert.ok(first);
    assert.deepEqual(placeMagnifier(area,pockets,{x:251,y:549},first),first);
    const moved=placeMagnifier(area,pockets,{x:first.x+first.width/2,y:first.y+first.height/2},first);
    assert.ok(moved);assert.notDeepEqual(moved,first);assert.ok(pockets.every(p=>!overlap(moved,p)));
});
test('compact magnifier is proportional; insufficient safe space hides it instead of hiding a pocket',()=>{
    const area={x:0,y:0,width:132,height:120},r=placeMagnifier(area,[],null,null);
    assert.ok(r);assert.equal(r.width,112);assert.ok(Math.abs(r.height/r.width-116/132)<1e-10);
    assert.deepEqual(placeMagnifier({x:0,y:0,width:300,height:300},[],null,r),r,'safe compact placement stays stable during the gesture');
    assert.equal(placeMagnifier(area,[{...area}],null,r),null);
    assert.equal(placeMagnifier({x:0,y:0,width:110,height:200},[],null,null),null);
});
test('resizing invalidates old magnifier bounds without placing it outside the new play area',()=>{
    const area={x:20,y:150,width:280,height:285},pockets=projectedPockets(area),r=placeMagnifier(area,pockets,null,{x:310,y:600,width:132,height:116});
    assert.ok(r);assert.ok(r.x+r.width<=300&&r.y+r.height<=435);assert.ok(pockets.every(p=>!overlap(r,p)));
});
