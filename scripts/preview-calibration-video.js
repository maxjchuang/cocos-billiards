// Development-only recording of the actual Cocos canvas. No simulated terminal frames.
// Load preview-core.js first. Fresh rounds advance the normal session once, then
// replay that same recipe to start capture without skipping a generated seed.
async function previewCalibrationVideo(index,recipe){
 const m=await System.import('cc'),g=m.director.getScene().getChildByName('Billiards').getComponent('BilliardsGame'),canvas=document.getElementById('GameCanvas');
 if(typeof MediaRecorder==='undefined'||!canvas.captureStream)throw Error('Canvas recording unavailable');
 if(!recipe){g.reset();await new Promise(r=>m.director.once(m.Director.EVENT_AFTER_DRAW,r));recipe={...g.rackConfig};}
 const stream=canvas.captureStream(30),mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t)),chunks=[];
 const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1000000}),done=new Promise((resolve,reject)=>{recorder.onstop=resolve;recorder.onerror=reject;});
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 const frames=[],record=()=>frames.push(performance.now());m.director.on(m.Director.EVENT_AFTER_DRAW,record);recorder.start(100);
 let result;
 try{result=await previewCoreBreak(recipe);await new Promise(r=>setTimeout(r,400));}
 finally{recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());m.director.off(m.Director.EVENT_AFTER_DRAW,record);}
 const blob=new Blob(chunks,{type:mime});window.__calibrationVideos??=[];window.__calibrationVideos[index]=blob;
 const intervals=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
 return {...result,video:{index,mime,bytes:blob.size,width:canvas.width,height:canvas.height,frames:frames.length,averageFps:1000*(frames.length-1)/(frames.at(-1)-frames[0]),p95FrameMs:intervals[Math.floor(intervals.length*.95)],maxFrameMs:Math.max(...intervals)},errors:window.__rackErrors??[]};
}
