const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const dir=path.dirname(process.env.BILLIARDS_TEST_MODULE),a=require(path.join(dir,'BilliardsAudio.js'));
test('Scheme A loudness responds monotonically to local impact strength and rejects nonphysical input',()=>{
 for(const kind of ['strike','collision','cushion']){const gains=[.01,.05,.5,2,8].map(s=>a.soundVolume(kind,s));assert.equal(gains[0],0);assert.ok(gains.every((v,i)=>!i||v>=gains[i-1]));assert.equal(a.soundVolume(kind,NaN),0);assert.equal(a.soundVolume(kind,-1),0);}
 assert.equal(a.AUDIO_CLIP_COUNT,Object.values(a.AUDIO_ASSETS).flat().length);
});
test('dense opening contacts select the strongest pairs, retain pockets, and suppress same-pair micro-chatter',()=>{
 const q=new a.SoundQueue();for(let i=0;i<16;i++)q.add('collision',i/2,'0:'+i);q.add('collision',9,'0:15');q.add('pocket',.2,'4');q.add('cushion',3,'1:left');
 const first=q.drain(100);assert.equal(first.filter(r=>r.kind==='collision').length,3);assert.equal(first[0].kind,'pocket');assert.equal(first.find(r=>r.kind==='collision').speed,9);
 q.add('collision',9,'0:15');assert.equal(q.drain(110).length,0);q.add('collision',9,'0:15');assert.equal(q.drain(140).length,1);q.add('pocket',1,'7');q.clear();assert.equal(q.drain(150).length,0);
});
const Module=require('node:module'),load=Module._load;const made=[];
class Source{volume=1;playing=false;clip=null;stops=0;plays=0;play(){this.plays++;this.playing=true;}stop(){this.stops++;this.playing=false;}}
class Node{isValid=true;addChild(){}addComponent(){const s=new Source();made.push(s);return s;}}
Module._load=function(id,...args){return id==='cc'?{AudioClip:class{},AudioSource:Source,Node,resources:{load(name,type,callback){callback(null,{name,getDuration:()=>.12})}}}:load.call(this,id,...args);};
const {Feedback}=require(path.join(dir,'BilliardsFeedback.js'));Module._load=load;
function feedback(){made.length=0;const settings={sound:true,haptics:false};const f=new Feedback(new Node(),()=>settings);f.unlock();return {f,settings,sources:made.slice()};}
test('overlapping collisions use bounded separate voices, preserve existing tails, and never exceed the mix budget',()=>{
 const {f,sources}=feedback(),before=sources.map(s=>s.stops);for(let i=0;i<12;i++)f.play('collision',8);
 assert.ok(sources.filter(s=>s.playing).length>1);assert.ok(sources.filter(s=>s.playing).length<=5);assert.ok(sources.reduce((n,s)=>n+(s.playing?s.volume:0),0)<=.9000001);assert.deepEqual(sources.map(s=>s.stops),before);assert.ok(new Set(f.events.filter(e=>e.kind==='collision').map(e=>e.variant)).size>1);
});
test('pause and mute cancel pending audio, delayed applause and all independent voices',()=>{
 const {f,settings,sources}=feedback(),clock=Date.now;let now=1000;Date.now=()=>now;
 try{f.celebrate();now+=349;f.flush();assert.equal(f.events.length,0);now++;f.flush();assert.equal(f.events.filter(e=>e.kind==='applause').length,1);f.flush();assert.equal(f.events.length,1);
 f.stop();f.celebrate();f.enqueue('collision',4,'0:1');f.stop();now+=500;f.flush();assert.equal(f.events.length,1);assert.ok(sources.every(s=>!s.playing));
 settings.sound=false;f.enqueue('pocket',1,'1');f.play('strike',4);f.celebrate();f.flush();assert.equal(f.events.length,1);
 }finally{Date.now=clock;}
});
test('all A assets are packed PCM clips with preserved original metadata UUIDs and no clipping',()=>{
 const manifest=JSON.parse(fs.readFileSync('docs/design/audio/asset-manifest.json','utf8'));assert.equal(manifest.files.length,14);
 for(const file of manifest.files){const b=fs.readFileSync('assets/resources/audio/'+file.file);assert.equal(b.toString('ascii',0,4),'RIFF');assert.ok(file.peak<=.781);assert.ok(file.duration>0&&file.duration<=1.8);assert.ok(fs.existsSync('assets/resources/audio/'+file.file+'.meta'));}
 assert.equal(JSON.parse(fs.readFileSync('assets/resources/audio/collision.wav.meta','utf8')).uuid,'7d7732c5-94e4-48cb-974b-a0155ee7319f');
});
test('audio telemetry does not alter the accepted default-break ball trajectories',()=>{
 const p=require(process.env.BILLIARDS_TEST_MODULE),r=require(path.join(dir,'BilliardsRack.js')),{sample}=require('../scripts/measure-break-balance.cjs');const baseline=JSON.parse(fs.readFileSync('validation/calibration/breaks.json','utf8')).cases[0];const actual=sample(p,r,baseline.config.rackSeed,baseline.offset,baseline.config.ballSetSeed,baseline.config.positionToleranceM,baseline.speed);assert.deepEqual(actual.balls,baseline.balls);assert.ok(actual.events.filter(e=>['contact','cushion','pocket'].includes(e.event.type)).every(e=>Number.isFinite(e.event.speed)&&e.event.speed>=0));
});
test('voice reservations remain bounded when the backend reports playing only asynchronously',()=>{
 const {f,sources}=feedback();for(const s of sources)s.play=function(){this.plays++;};
 for(let i=0;i<8;i++)f.play('collision',8);
 const busy=Array.from(f.busyUntil.keys());assert.ok(busy.length>=2&&busy.length<=5);assert.equal(new Set(busy).size,busy.length);assert.ok(busy.every(s=>s.plays===2));assert.ok(busy.reduce((n,s)=>n+s.volume,0)<=.900001);
});
