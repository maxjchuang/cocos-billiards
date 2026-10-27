const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.dirname(process.env.BILLIARDS_TEST_MODULE),ai=require(path.join(dir,'BilliardsAI.js')),practice=require(path.join(dir,'BilliardsPractice.js')),rules=require(process.env.BILLIARDS_RULES_MODULE),p=require(process.env.BILLIARDS_TEST_MODULE),shot=require(process.env.BILLIARDS_SHOT_MODULE),{fixture,evaluate}=require('../scripts/measure-ai.cjs');
const modules={ai,p,rules,shot};
function run(f,d='standard',seed=19){const planner=new ai.AIPlanner(f.balls,f.ref,d,seed);while(!planner.done)planner.advance(160);return {planner,decision:planner.decision()};}
test('practice choices persist independently of gameplay settings and validate corrupt stored values',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},s=new practice.PracticeStore(storage);assert.deepEqual(s.value,{mode:'ai',difficulty:'standard'});s.set({mode:'local',difficulty:'hard'});assert.deepEqual(new practice.PracticeStore(storage).value,s.value);
 data.set(practice.PRACTICE_KEY,JSON.stringify({version:1,mode:'online',difficulty:'god'}));assert.deepEqual(new practice.PracticeStore(storage).value,{mode:'ai',difficulty:'standard'});
 const fail=new practice.PracticeStore({getItem(){throw Error('denied')},setItem(){throw Error('full')}});fail.set({mode:'ai',difficulty:'easy'});assert.equal(fail.value.difficulty,'easy');assert.equal(fail.persistent,false);
});
test('AI legal targets respect assigned groups, open table and the separate black-eight phase',()=>{
 const f=fixture(rules,'open');assert.deepEqual(ai.legalAITargets(f.balls,f.ref).map(b=>b.id).sort((a,b)=>a-b),[1,9]);f.ref.groups=['stripe','solid'];assert.deepEqual(ai.legalAITargets(f.balls,f.ref).map(b=>b.id),[1]);f.balls.find(b=>b.id===1).pocketed=true;assert.deepEqual(ai.legalAITargets(f.balls,f.ref).map(b=>b.id),[8]);
});
test('AI trial referee copies preserve head restrictions and never share frozen-cushion/contact state',()=>{
 const f=fixture(rules,'simple');f.ref.requireHeadShot=true;f.ref.select('solid');assert.ok(f.ref.beginShot(f.balls));const clone=f.ref.cloneForSimulation();assert.equal(clone.requireHeadShot,true);clone.groups[0]='solid';clone.shot.breakRails.add(1);clone.shot.potted.push(9);clone.shot.frozen.get(1).add('left');assert.notEqual(clone.groups[0],f.ref.groups[0]);assert.equal(f.ref.shot.breakRails.size,0);assert.equal(f.ref.shot.potted.length,0);assert.equal(f.ref.shot.frozen.get(1).size,0);
});
test('three difficulties differ in bounded search, positional evaluation and final execution precision',()=>{
 const e=ai.AI_LEVELS.easy,s=ai.AI_LEVELS.standard,h=ai.AI_LEVELS.hard;assert.ok(e.trials<s.trials&&s.trials<h.trials);assert.ok(e.angleError>s.angleError&&s.angleError>h.angleError);assert.ok(e.positionWeight<s.positionWeight&&s.positionWeight<h.positionWeight);assert.equal(e.tips,false);assert.equal(h.banks,true);
});
for(const difficulty of ['easy','standard','hard'])test(`AI ${difficulty} completes a legal direct shot using the unchanged physics and referee`,()=>{
 const f=fixture(rules,'simple'),before=JSON.stringify({balls:f.balls,groups:f.ref.groups,phase:f.ref.phase}),{planner,decision}=run(f,difficulty,19),result=evaluate(modules,f.balls,f.ref,decision);
 assert.ok(decision&&Object.isFrozen(decision)&&Object.isFrozen(decision.direction));assert.ok(decision.power>=.4&&decision.power<=4);assert.ok(planner.reports.length<=ai.AI_LEVELS[difficulty].trials);assert.equal(result.settled,true);assert.equal(result.legal,true);assert.equal(JSON.stringify({balls:f.balls,groups:f.ref.groups,phase:f.ref.phase}),before);assert.equal(f.ref.shot,null);
});
test('standard AI chooses a group on an open table and only targets eight when its group is cleared',()=>{
 for(const name of ['open','black']){const f=fixture(rules,name),{decision}=run(f,'standard'),result=evaluate(modules,f.balls,f.ref,decision);assert.ok(result.legal);if(name==='open')assert.ok(decision.group==='solid'||decision.group==='stripe');else{assert.equal(decision.target,8);assert.equal(result.winner,1);}}
});
test('AI full-table and head-line placement uses legal points without touching live state',()=>{
 for(const head of [false,true])for(const difficulty of ['easy','standard','hard']){const f=fixture(rules,'simple');f.ref.phase='placing';f.ref.hand=head?'head':'any';f.balls[0].pocketed=true;const before=JSON.stringify(f.balls),spot=ai.chooseAIPlacement(f.balls,f.ref,difficulty);assert.ok(spot);assert.ok(rules.validCuePosition(f.balls,spot.x,spot.z,head));assert.equal(JSON.stringify(f.balls),before);assert.ok(f.ref.placeCue(f.balls,spot.x,spot.z));assert.ok(f.ref.confirmPlacement(f.balls));}
});
test('planner replay is deterministic, and stale work cannot revive a cancelled or replaced turn',()=>{
 const f=fixture(rules,'simple'),a=run(f,'easy',97),b=run(f,'easy',97);assert.deepEqual(a.decision,b.decision);
 const turn=new ai.AITurn();turn.begin(f.balls,f.ref,'easy',1);turn.work(1);const old=turn.planner,generation=turn.generation;turn.pause();assert.equal(turn.planner,null);assert.ok(turn.generation>generation);while(!old.done)old.advance(160);assert.equal(turn.locked,null);
 turn.begin(f.balls,f.ref,'standard',1);while(!turn.locked)turn.work(160);const locked=turn.locked;turn.pause();assert.equal(turn.locked,locked);assert.equal(locked.difficulty,'standard');turn.cancel();assert.equal(turn.locked,null);assert.equal(turn.planner,null);
});
test('search deadline returns the current best immutable command without requiring remaining trials',()=>{
 const f=fixture(rules,'simple'),turn=new ai.AITurn();turn.begin(f.balls,f.ref,'hard',1);while(turn.planner.reports.length<1)turn.work(80);turn.clock(ai.AI_LEVELS.hard.deadlineMs);assert.ok(turn.locked);assert.ok(turn.locked.trials<ai.AI_LEVELS.hard.trials);const d=turn.locked;turn.work(1000);assert.equal(turn.locked,d);
});

test('AI referee copies cannot consume the live rack factory on a simulated re-rack',()=>{
 let calls=0;const ref=new rules.Referee(()=>{calls++;return p.createRack();});Object.assign(ref,{phase:'choice',breakChoice:'illegal',current:1});const copy=ref.cloneForSimulation(),balls=p.createRack();copy.chooseBreak(balls,'self');assert.equal(calls,0);assert.equal(ref.phase,'choice');assert.equal(copy.phase,'placing');
});

const {naturalFixtures}=require('../scripts/ai-natural-fixtures.cjs');
const natural=name=>naturalFixtures(rules).find(f=>f.name===name);
for(const difficulty of ['easy','standard','hard'])test(`natural ${difficulty} does not kick around an available direct defense`,()=>{
 const f=natural('draw'),{planner,decision}=run(f,difficulty,19),result=evaluate(modules,f.balls,f.ref,decision);
 assert.equal(decision.route,'direct');assert.equal(decision.reason,'direct-priority');assert.ok(result.legal);
 if(difficulty!=='hard')assert.ok(planner.reports.every(r=>r.preContactCushions===0));
});
test('a blocked centre ray still admits a visible thin direct contact',()=>{
 const f=natural('partly-blocked'),candidates=ai.generateAICandidates(f.balls,f.ref,'standard');assert.ok(candidates.some(c=>c.route==='direct'));
 const {decision}=run(f,'standard',19);assert.equal(decision.route,'direct');assert.ok(evaluate(modules,f.balls,f.ref,decision).legal);
});
for(const difficulty of ['easy','standard','hard'])test(`natural ${difficulty} retains a referee-evaluated kick escape when fully blocked`,()=>{
 const f=natural('fully-blocked'),candidates=ai.generateAICandidates(f.balls,f.ref,difficulty);assert.ok(candidates.length);assert.ok(candidates.every(c=>c.route==='kick'));
 const {planner,decision}=run(f,difficulty,19);assert.equal(decision.route,'kick');assert.equal(decision.reason,'no-safe-direct-contact');assert.ok(planner.reports.some(r=>r.complete&&!r.foul&&r.preContactCushions>0));assert.ok(evaluate(modules,f.balls,f.ref,decision).settled);
});
test('challenge risk work is deterministic, bounded and may be cancelled without publishing a stale shot',()=>{
 const f=natural('simple'),a=run(f,'hard',19),b=run(f,'hard',19);assert.deepEqual(a.planner.riskReports,b.planner.riskReports);assert.ok(a.planner.riskReports.length>0&&a.planner.riskReports.length<=8);assert.deepEqual(a.decision,b.decision);assert.equal(a.decision.route,'direct');
 const turn=new ai.AITurn();turn.begin(f.balls,f.ref,'hard',19);while(turn.planner.reports.length<1)turn.work(80);turn.clock(ai.AI_LEVELS.hard.deadlineMs);assert.equal(turn.locked.route,'direct');assert.notEqual(turn.locked.reason,'robust-kick-advantage');turn.cancel();assert.equal(turn.locked,null);
});
test('challenge rejects a nominal kick pot when execution-error stress exposes its risk',()=>{
 const f=natural('rail-contact'),{planner,decision}=run(f,'hard',19);
 const attacking=planner.reports.find(r=>r.preContactCushions>0&&!r.foul&&r.targetPotted);
 assert.ok(attacking,'fixture contains a real nominal kick pot');const probes=planner.riskReports.filter(r=>r.index===attacking.index);assert.equal(probes.length,4);assert.ok(probes.some(r=>r.foul||!r.targetPotted||r.preContactCushions!==1));assert.equal(decision.route,'direct');assert.equal(decision.reason,'direct-priority');
});
test('beginner spends its escape budget on a gap narrower than its execution error',()=>{
 const f=natural('partly-blocked'),candidates=ai.generateAICandidates(f.balls,f.ref,'easy'),direct=candidates.filter(c=>c.route==='direct');assert.ok(direct.length>0&&direct.length<=2);assert.ok(direct.every(c=>c.contactStable===false));assert.ok(candidates.some(c=>c.route==='kick'));
 const {planner,decision}=run(f,'easy',19);assert.equal(decision.route,'kick');assert.equal(decision.reason,'no-safe-direct-contact');assert.ok(planner.reports.some(r=>r.preContactCushions>0));assert.ok(planner.reports.length<=ai.AI_LEVELS.easy.trials);
});
