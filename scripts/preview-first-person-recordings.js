// Browser-only canvas recording; editor offscreen WebViews may produce empty streams.
async function previewFirstPersonRecordings(){
 const m=await System.import('cc'),canvas=document.getElementById('GameCanvas'),oldRate=m.game.frameRate,clips=[];
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 async function record(name,run){
  const chunks=[],stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};const ended=new Promise(r=>recorder.onstop=r);recorder.start(100);const detail=await run();recorder.stop();await ended;stream.getTracks().forEach(t=>t.stop());
  const blob=new Blob(chunks,{type:'video/webm'});if(!blob.size)throw Error('Empty canvas recording '+name);const base64=await new Promise(r=>{const reader=new FileReader();reader.onload=()=>r(reader.result.split(',')[1]);reader.readAsDataURL(blob)});clips.push({name,bytes:blob.size,base64,...detail});
 }
 try{
  for(const rail of [false,true])for(const near of [false,true]){
   await firstPersonContactScene({rail,near,height:.15,gapM:.02,guides:false});const g=m.director.getScene().getComponentInChildren('BilliardsGame'),hash=JSON.stringify({direction:g.direction,power:g.power,tip:g.tip.value,balls:g.balls});
   await record((rail?'rail':'open')+'-'+(near?'near':'far')+'-height.webm',async()=>{for(let i=0;i<=60;i++){g.eyeHeight=.15+.1*(1-Math.cos(i/60*Math.PI*2))/2;await wait(50)}return {unchanged:hash===JSON.stringify({direction:g.direction,power:g.power,tip:g.tip.value,balls:g.balls}),scope:'Actual exported Cocos canvas; observation height changes only'};});
  }
  for(const fps of [60,10]){
   const g=await fpSetup(__fpFixtures.shots[3],'first-person');g.settings.set('aimGuide',false);m.game.frameRate=fps;
   const initial=JSON.stringify(g.balls),frames=[],sample=()=>frames.push({elapsedMs:g.shotSequence.elapsedMs,moved:JSON.stringify(g.balls)!==initial,pose:g.cameraRig.pose});m.director.on(m.Director.EVENT_AFTER_DRAW,sample);
   await record('contact-'+fps+'fps.webm',async()=>{g.shoot();await wait(3000);m.director.off(m.Director.EVENT_AFTER_DRAW,sample);return {fps,frames,passed:frames.find(f=>f.moved)?.elapsedMs===220&&frames.filter(f=>f.elapsedMs<220).every(f=>!f.moved),scope:'Actual frame-loop recording, direct command trigger; touch independently validated'};});
  }
  return clips;
 }finally{m.game.frameRate=oldRate;}
}
