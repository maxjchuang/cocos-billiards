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
