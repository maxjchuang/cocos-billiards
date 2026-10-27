const {fixture}=require('./measure-ai.cjs');
function naturalFixtures(rules){
 const cases=['simple','cut','long','blocked','black','open','draw'].map(name=>({name,...fixture(rules,name)}));
 const make=(name,layout)=>{const ref=new rules.Referee();Object.assign(ref,{phase:'ready',isBreak:false,hand:null,current:1,groups:['stripe','solid']});return {name,ref,balls:layout.map(([id,x,z])=>({id,x,z,vx:0,vz:0,wx:0,wy:0,wz:0}))};};
 cases.push(make('fully-blocked',[[0,0,.7],[1,0,-.5],[9,0,.25],[8,.4,-.9]]));
 cases.push(make('partly-blocked',[[0,0,.7],[1,0,-.5],[9,.04,.1],[8,.4,-.9]]));
 cases.push(make('direct-defense',[[0,0,.8],[1,0,0],[9,.15,.32],[10,-.15,.32],[11,.15,-.32],[12,-.15,-.32],[13,.35,0],[14,-.35,0],[8,0,-.9]]));
 cases.push(make('rail-contact',[[0,.55,-.3],[1,.55,.5],[9,-.3,-.4],[8,.3,-.9]]));
 return cases;
}
module.exports={naturalFixtures};