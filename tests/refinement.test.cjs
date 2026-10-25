const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {surfacePixels,visibleFractions}=require(path.join(path.dirname(process.env.BILLIARDS_TEST_MODULE),'BilliardsAppearance.js'));
const {computeHudLayout}=require(process.env.BILLIARDS_LAYOUT_MODULE);
test('surface shading is deterministic and opaque, with bounded contrast instead of geometry changes',()=>{
 for(const kind of ['felt','wood','rail','pocket']){const a=surfacePixels(kind,32),b=surfacePixels(kind,32);assert.deepEqual(a,b);assert.equal(a.length,4096);for(let i=3;i<a.length;i+=4)assert.equal(a[i],255);assert.ok(new Set(a).size>10);}
});
test('trajectory occlusion preserves both ends while excluding overlapping ball silhouettes',()=>{
 assert.deepEqual(visibleFractions({x:0,y:0},{x:10,y:0},[{x:4,y:0,r:2},{x:6,y:0,r:2}]),[[0,.2],[.8,1]]);
 assert.deepEqual(visibleFractions({x:0,y:0},{x:10,y:0},[{x:5,y:5,r:1}]),[[0,1]]);
 assert.deepEqual(visibleFractions({x:0,y:0},{x:1,y:0},[{x:0,y:0,r:2}]),[]);
 assert.deepEqual(visibleFractions({x:1,y:1},{x:1,y:1},[]),[]);
});
test('refined layout retains space for seven targets and separates legend, table, fine aim and power',()=>{
 for(const [width,height] of [[320,568],[393,852],[430,932]])for(const fine of [false,true]){
  const a=computeHudLayout(width,height,{insets:{top:47,bottom:34},showPower:true,showShot:true,showFine:fine,actionCount:0,showDecision:false});
  assert.ok(a.players[0].height>=64);assert.ok(a.players[0].width>=134);
  assert.ok(a.turn.y>=a.players[0].y+a.players[0].height);assert.ok(a.playArea.y>=a.turn.y+a.turn.height);
  assert.ok(a.playArea.y+a.playArea.height<= (fine?a.fine.y:a.power.y)-8);assert.ok(a.power.y+a.power.height<=a.shoot.y-8);
 }
});
