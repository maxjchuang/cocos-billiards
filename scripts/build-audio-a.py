"""Offline Scheme A edit: NumPy/SciPy + ffmpeg, never used by the game runtime."""
from pathlib import Path
import subprocess,hashlib,json,wave,uuid
import numpy as np
from scipy import signal
ROOT=Path(__file__).resolve().parents[1];SOURCE=ROOT/'docs/design/audio/source';OUT=ROOT/'assets/resources/audio';SR=44100

def read(name):
 data=subprocess.check_output(['ffmpeg','-v','error','-i',str(SOURCE/name),'-ar',str(SR),'-ac','1','-f','f32le','-']);return np.frombuffer(data,dtype='<f4').astype(float)
def filt(x,lo=80,hi=10000):return signal.sosfilt(signal.butter(2,[lo,hi],btype='bandpass',fs=SR,output='sos'),x)
def fade(x,start=.0004,end=.015):
 x=x.copy();a=min(len(x),int(start*SR));b=min(len(x),int(end*SR));x[:a]*=np.linspace(0,1,a);x[-b:]*=np.linspace(1,0,b);return x
def trim(x,length):
 idx=np.flatnonzero(np.abs(x)>np.max(np.abs(x))*.035);start=max(0,int(idx[0] if len(idx) else 0)-int(.0015*SR));return fade(x[start:start+int(length*SR)])
def norm(x):return x/(np.max(np.abs(x))+1e-12)*.78
def rate(x,r):return signal.resample_poly(x,1000,int(r*1000))
def mix(items,dur):
 x=np.zeros(int(dur*SR))
 for t,y,g in items:
  p=int(t*SR);n=min(len(y),len(x)-p);x[p:p+n]+=y[:n]*g
 return fade(x)
meta={'version':'A-club-v1','sampleRate':SR,'sourceStatus':'Public compressed previews for the recorded material; no claim of lossless original masters. Cushion and pocket are designed Foley, not measured table recordings.','files':[]}
def save(name,x):
 x=norm(x);p=OUT/(name+'.wav')
 with wave.open(str(p),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((np.clip(x,-.999,.999)*32767).astype('<i2').tobytes())
 mp=p.with_suffix('.wav.meta')
 if not mp.exists():mp.write_text(json.dumps({'ver':'1.0.0','importer':'audio-clip','imported':True,'uuid':str(uuid.uuid4()),'files':['.json','.wav'],'subMetas':{},'userData':{'downloadMode':0}},indent=2)+'\n')
 meta['files'].append({'file':name+'.wav','duration':len(x)/SR,'peak':float(np.max(np.abs(x))),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
hit=norm(trim(filt(read('ball-hit.mp3'),130,11500),.115));wood=[norm(trim(filt(read(f'impactWood_light_{i:03}.ogg'),110,8000),.17)) for i in range(3)];soft=[norm(trim(filt(read(f'impactSoft_medium_{i:03}.ogg'),65,2600),.17)) for i in range(3)]
pool=read('pool.mp3');blocks=np.array([np.max(np.abs(pool[i:i+220])) for i in range(0,len(pool),220)]);peaks,_=signal.find_peaks(blocks,height=max(.02,float(blocks.max())*.18),distance=45);first=int(peaks[0]*220);cue=norm(trim(filt(pool[max(0,first-500):first+7000],180,9000),.115))
for i in range(3):
 save('strike' if i==0 else f'strike-{i}',mix([(0,rate(cue,[.98,1,1.015][i]),.64),(0,rate(wood[i],1.3),.2),(.001,rate(soft[i],1.15),[.15,.12,.09][i])],.23))
 save('cushion' if i==0 else f'cushion-{i}',mix([(0,rate(soft[i],1.12),.62),(.001,filt(rate(wood[i],.86),110,2100),.22)],.29))
 save('pocket' if i==0 else f'pocket-{i}',mix([(0,rate(soft[i],1.18),.21),(.033,rate(wood[(i+1)%3],.72),.32),(.125,rate(hit,.8),.12),(.22,rate(hit,.72),.065)],.52))
for i,r in enumerate([1,.975,1.025,.99]):save('collision' if i==0 else f'collision-{i}',fade(rate(hit,r)))
save('applause',fade(norm(filt(read('applause.mp3'),170,10000))[:int(1.8*SR)],.07,.32))
(ROOT/'docs/design/audio/asset-manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n');print('baked',len(meta['files']),'Scheme A clips')
