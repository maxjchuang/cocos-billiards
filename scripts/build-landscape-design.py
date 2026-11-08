"""V2.0 review documents and editable vector drawings. Design authoring only.
No game assets, scenes, runtime logic or platform settings are modified.
"""
from pathlib import Path
from contextlib import contextmanager
import html, json, math, shutil, subprocess, sys
sys.dont_write_bytecode = True
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
ROOT=Path(__file__).resolve().parents[1]
D=ROOT/'docs/design'; OUT=D/'landscape'; TMP=ROOT/'tmp/pdfs/landscape'
OUT.mkdir(parents=True,exist_ok=True);TMP.mkdir(parents=True,exist_ok=True)
FONT=next(p for p in [Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf'),Path('/Library/Fonts/Arial Unicode.ttf')] if p.exists())
pdfmetrics.registerFont(TTFont('Club',str(FONT)))
BG='#0E1C19'; SURFACE='#1C3028'; INK='#F4F0E6'; MUTED='#ABBAB0'; GOLD='#D9BD83'; TRACK='#40594B'; PAPER='#F7F5EE'; DARK='#203D30'
COLORS=['#F5F1E6','#D3A32B','#31599A','#B3453D','#73538D','#CF7D35','#427852','#824B3D','#151918']
def mix(a,b,t):
 a=[int(a[i:i+2],16) for i in (1,3,5)];b=[int(b[i:i+2],16) for i in (1,3,5)]
 return '#'+''.join(f'{round(x*(1-t)+y*t):02x}' for x,y in zip(a,b))
class Art:
 def __init__(self,c,w,h):self.c=c;self.w=w;self.h=h;self.svg=[];self.serial=0
 def paint(self,fill,stroke,alpha=1,lw=1,dash=''):
  c=self.c;c.setFillAlpha(alpha);c.setStrokeAlpha(alpha);c.setLineWidth(lw);c.setLineCap(1);c.setLineJoin(1);c.setDash([float(n) for n in dash.split()] if dash else [])
  if fill:c.setFillColor(HexColor(fill))
  if stroke:c.setStrokeColor(HexColor(stroke))
  c.setFillAlpha(alpha);c.setStrokeAlpha(alpha)
 def attrs(self,fill,stroke,alpha,lw,dash=''):
  return f'fill="{fill or "none"}" stroke="{stroke or "none"}" opacity="{alpha}" stroke-width="{lw}" stroke-linecap="round" stroke-linejoin="round"'+(f' stroke-dasharray="{dash}"' if dash else '')
 def rect(self,x,y,w,h,fill=None,r=0,stroke=None,alpha=1,lw=1,dash=''):
  self.c.saveState();self.paint(fill,stroke,alpha,lw,dash);self.c.roundRect(x,self.h-y-h,w,h,r,stroke=bool(stroke),fill=bool(fill));self.c.restoreState()
  self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" {self.attrs(fill,stroke,alpha,lw,dash)}/>')
 def ellipse(self,x,y,rx,ry,fill=None,stroke=None,alpha=1,lw=1):
  self.c.saveState();self.paint(fill,stroke,alpha,lw);self.c.ellipse(x-rx,self.h-y-ry,x+rx,self.h-y+ry,stroke=bool(stroke),fill=bool(fill));self.c.restoreState()
  self.svg.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" {self.attrs(fill,stroke,alpha,lw)}/>')
 def circle(self,x,y,r,fill=None,stroke=None,alpha=1,lw=1):self.ellipse(x,y,r,r,fill,stroke,alpha,lw)
 def poly(self,pts,fill=None,stroke=None,alpha=1,lw=1):
  if len(pts)<3:return
  self.c.saveState();self.paint(fill,stroke,alpha,lw);p=self.c.beginPath();p.moveTo(pts[0][0],self.h-pts[0][1])
  for x,y in pts[1:]:p.lineTo(x,self.h-y)
  p.close();self.c.drawPath(p,stroke=bool(stroke),fill=bool(fill));self.c.restoreState()
  self.svg.append('<polygon points="'+' '.join(f'{x:.3f},{y:.3f}' for x,y in pts)+'" '+self.attrs(fill,stroke,alpha,lw)+'/>')
 def line(self,x,y,xx,yy,color=INK,lw=1.5,dash='',alpha=1):
  self.c.saveState();self.paint(None,color,alpha,lw,dash);self.c.line(x,self.h-y,xx,self.h-yy);self.c.restoreState()
  self.svg.append(f'<line x1="{x}" y1="{y}" x2="{xx}" y2="{yy}" {self.attrs(None,color,alpha,lw,dash)}/>')
 def text(self,x,y,value,size=12,color=INK,anchor='start',latin=False):
  f='Helvetica-Bold' if latin else 'Club';self.c.saveState();self.c.setFillColor(HexColor(color));self.c.setFont(f,size)
  getattr(self.c,{'start':'drawString','middle':'drawCentredString','end':'drawRightString'}[anchor])(x,self.h-y,value);self.c.restoreState()
  self.svg.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" text-anchor="{anchor}" font-family="{ "Arial,sans-serif" if latin else "PingFang SC,Noto Sans CJK SC,Arial,sans-serif"}"'+(' font-weight="600"' if latin else '')+'>'+html.escape(value)+'</text>')
 @contextmanager
 def clip_poly(self,pts):
  self.serial+=1;ident=f'clip-{self.serial}';p=self.c.beginPath();p.moveTo(pts[0][0],self.h-pts[0][1])
  for x,y in pts[1:]:p.lineTo(x,self.h-y)
  p.close();self.c.saveState();self.c.clipPath(p,stroke=0,fill=0)
  self.svg.append(f'<defs><clipPath id="{ident}"><polygon points="'+' '.join(f'{x},{y}' for x,y in pts)+f'"/></clipPath></defs><g clip-path="url(#{ident})">')
  yield
  self.c.restoreState();self.svg.append('</g>')
 @contextmanager
 def screen_clip(self):
  p=self.c.beginPath();p.roundRect(0,0,self.w,self.h,22);self.c.saveState();self.c.clipPath(p,stroke=0,fill=0)
  self.svg.append(f'<defs><clipPath id="screen"><rect width="{self.w}" height="{self.h}" rx="22"/></clipPath></defs><g clip-path="url(#screen)">')
  yield
  self.c.restoreState();self.svg.append('</g>')
 def save(self,p):p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'+''.join(self.svg)+'</svg>')

def icon(a,kind,x,y,color=INK,s=1,feedback=False):
 L=lambda x1,y1,x2,y2:a.line(x+x1*s,y+y1*s,x+x2*s,y+y2*s,color,1.5*s)
 C=lambda xx,yy,r:a.circle(x+xx*s,y+yy*s,r*s,None,color,lw=1.5*s)
 if kind=='pause':L(-4,-7,-4,7);L(4,-7,4,7)
 elif kind=='fine':
  C(0,0,6)
  for p in [(-10,0,-4,0),(4,0,10,0),(0,-10,0,-4),(0,4,0,10)]:L(*p)
 elif kind=='spin':C(0,0,8);C(1.5,-1,2)
 elif kind=='cue':
  L(-9,9,2.03 if feedback else 1,-2.03 if feedback else -1);C(5,-5,4.2)
  if feedback:
   for t in [0,.8,1.6,2.4,3.2,4.0,4.8,5.6]:L(5+7*math.cos(t),-5+7*math.sin(t),5+10*math.cos(t),-5+10*math.sin(t))
 elif kind=='expand':
  for sx,sy in [(-1,-1),(1,-1),(-1,1),(1,1)]:L(sx*3,sy*8,sx*8,sy*8);L(sx*8,sy*8,sx*8,sy*3)
 elif kind=='info':C(0,0,8);L(0,-1,0,5);C(0,-5,.5)
 elif kind=='rotate':
  a.rect(x-7*s,y-12*s,14*s,24*s,None,3*s,color,lw=1.5*s);L(12,-5,17,-5);L(17,-5,17,3);L(17,3,13,0)

def ball2(a,x,y,r,n):
 col=COLORS[n-8 if n>8 else n];a.ellipse(x+.5,y+r*.83,r*.82,r*.22,'#061D13',alpha=.36);a.circle(x,y,r,COLORS[0] if n>8 else col)
 if n>8:
  pts=[]
  for i in range(13):
   yy=-r*.46+i*r*.92/12;xx=math.sqrt(max(0,r*r-yy*yy));pts.append((x+xx,y+yy))
  for i in range(12,-1,-1):
   yy=-r*.46+i*r*.92/12;xx=math.sqrt(max(0,r*r-yy*yy));pts.append((x-xx,y+yy))
  a.poly(pts,col)
 if n:a.circle(x,y,r*.50,'#FCF9F0');a.text(x,y+r*.24,str(n),max(4,r*.72),DARK,'middle',True)
 a.ellipse(x-r*.28,y-r*.40,r*.19,r*.12,'#FFFFFF',alpha=.35)

# Exact current visual proxy is a reference, not a new manufacturer measurement.
js="const fs=require('fs'),ts=require('typescript'),Module=require('module'),m=new Module('designGeometry');m._compile(ts.transpileModule(fs.readFileSync('assets/scripts/BilliardsTableGeometry.ts','utf8'),{compilerOptions:{target:7,module:1}}).outputText,'designGeometry.js');console.log(JSON.stringify({pockets:m.exports.POCKETS,rails:m.exports.CUSHION_PATHS}));"
GEO=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT))
BALLS=[(0,0,.65),(4,.04,-.03),(1,-.32,-.48),(2,.26,-.86),(7,-.43,.06),(8,.18,-.61),(9,-.2,-.95),(10,.41,-.33),(12,-.13,-.47),(14,-.46,-.94),(15,.4,-.94)]
R=.028575

def perspective(a, eye=(0,.23,1.03), target=(0,R,.53), orbit=0, placing=False):
 fwd=tuple(b-c for c,b in zip(eye,target));l=math.sqrt(sum(q*q for q in fwd));fwd=tuple(q/l for q in fwd);up=(0,-fwd[2],fwd[1]);f=a.h/(2*math.tan(math.radians(25)));cy=a.h*.55
 def cam(p):
  x,y,z=p;p=(x*math.cos(orbit)+z*math.sin(orbit),y,-x*math.sin(orbit)+z*math.cos(orbit))
  v=[p[i]-eye[i] for i in range(3)];return (v[0],sum(v[i]*up[i] for i in range(3)),sum(v[i]*fwd[i] for i in range(3)))
 def proj(q):return (a.w*.48+f*q[0]/q[2],cy-f*q[1]/q[2])
 def point(x,z,y=0):return proj(cam((x,y,z)))
 def projection(ps):
  q=[cam(p) for p in ps];out=[]
  for p,n in zip(q,q[1:]+q[:1]):
   if p[2]>=.035:out.append(p)
   if (p[2]>=.035)!=(n[2]>=.035):
    t=(.035-p[2])/(n[2]-p[2]);out.append(tuple(p[i]+t*(n[i]-p[i]) for i in range(3)))
  return [proj(p) for p in out]
 def face(ps,col,alpha=1):
  points=projection(ps)
  if len(points)>2:a.poly(points,col,alpha=alpha)
 face([(-.77,-.01,-1.41),(.77,-.01,-1.41),(.77,-.01,1.41),(-.77,-.01,1.41)],'#614630')
 bed=projection([(-.63,0,-1.27),(.63,0,-1.27),(.63,0,1.27),(-.63,0,1.27)])
 with a.clip_poly(bed):
  top=max(0,min(y for x,y in bed));a.c.setFillAlpha(1);a.c.linearGradient(0,a.h-top,0,0,[HexColor('#214F43'),HexColor('#2D6656')],extend=True)
  a.serial+=1;ident=f'felt-{a.serial}';a.svg.append(f'<defs><linearGradient id="{ident}" gradientUnits="userSpaceOnUse" x1="0" y1="{top}" x2="0" y2="{a.h}"><stop offset="0" stop-color="#214F43"/><stop offset="1" stop-color="#2D6656"/></linearGradient></defs><rect width="{a.w}" height="{a.h}" fill="url(#{ident})"/>')
 for rail in GEO['rails']:
  p=rail['polygon'];face([(q['x'],.038,q['z']) for q in p],'#173E33')
  for q,n in zip(p,p[1:]+p[:1]):face([(q['x'],0,q['z']),(n['x'],0,n['z']),(n['x'],.038,n['z']),(q['x'],.038,q['z'])],'#12372E')
 for pocket in GEO['pockets']:face([(q['x'],.0001,q['z']) for q in pocket['outline']],'#070F0D')
 def route(points,color):
  for p,n in zip(points,points[1:]):
   if cam((p[0],.0005,p[1]))[2]<.04 or cam((n[0],.0005,n[1]))[2]<.04:continue
   x,y=point(*p,.0005);xx,yy=point(*n,.0005);a.line(x,y,xx,yy,color,1.2,'4 4',.85)
 if placing:
  face([(-.63,.0002,.635),(.63,.0002,.635),(.63,.0002,1.27),(-.63,.0002,1.27)],GOLD,.1)
  q=point(-.63,.635);n=point(.63,.635);a.line(*q,*n,GOLD,1,'4 4')
 if not placing:route([(0,.65),(.016,.022),(-.34,-.14)],'#F5F1E6');route([(.04,-.03),(.59,-1.22)],'#E5BD74')
 if not placing:
  x,y=point(-.34,-.14);a.ellipse(x,y,8,4,None,INK,lw=1.2);a.line(x-3,y,x+3,y,INK,1);a.line(x,y-3,x,y+3,INK,1)
 for n,x,z in sorted(BALLS,key=lambda b:cam((b[1],R,b[2]))[2],reverse=True):
  # Ground footprint lies on the cloth; the sphere is never sunk or squashed.
  for j in range(9):
   extent=1.15-j*.08;shadow=[]
   for k in range(48):t=k*math.pi/24;shadow.append(point(x+R*extent*math.cos(t),z+R*extent*math.sin(t),.0001))
   a.poly(shadow,'#061E14',alpha=.025)
  c=cam((x,R,z));distance=math.sqrt(sum(v*v for v in c))
  if c[2]<=R+.035:continue
  norm=tuple(v/distance for v in c);u=(norm[2],0,-norm[0]);ul=math.hypot(u[0],u[2]);u=tuple(v/ul for v in u);v=(norm[1]*u[2],norm[2]*u[0]-norm[0]*u[2],-norm[1]*u[0]);centre=tuple(t*(1-R*R/(distance*distance)) for t in c);rr=R*math.sqrt(1-R*R/(distance*distance));rim=[proj(tuple(centre[k]+rr*(u[k]*math.cos(t)+v[k]*math.sin(t)) for k in range(3))) for t in [i*math.pi/32 for i in range(64)]]
  xs=[p[0] for p in rim];ys=[p[1] for p in rim];sx=(max(xs)+min(xs))/2;sy=(max(ys)+min(ys))/2;rx=(max(xs)-min(xs))/2;ry=(max(ys)-min(ys))/2;col=COLORS[n-8 if n>8 else n]
  with a.clip_poly(rim):
   a.poly(rim,INK if n>8 else col)
   if n>8:a.rect(sx-rx,sy-ry*.46,rx*2,ry*.92,col)
   for i in range(24):a.rect(sx-rx,sy-ry+2*ry*i/24,rx*2,2*ry/24,'#0D2A1C',alpha=.015+.16*(i/23)**1.7)
   if n:a.circle(sx,sy,min(rx,ry)*.48,'#FCF9F0');a.text(sx,sy+min(rx,ry)*.20,str(n),max(4,min(rx,ry)*.65),DARK,'middle',True)
   a.ellipse(sx-rx*.29,sy-ry*.42,rx*.18,ry*.12,'#FFFFFF',alpha=.30)
 # The cue has perspective thickness, its tip remains behind the cue ball.
 if not placing:face([(-.004,R,.709),(.004,R,.709),(.009,R,1.2),(-.009,R,1.2)],'#BC935D')
 if not placing:face([(-.0045,R,.701),(.0045,R,.701),(.0045,R,.714),(-.0045,R,.714)],'#79B8B3')

def overhead_layout(w,h):
 base=layout(w,h);sc=min((w-2*base['safe'][0]-84)/2.82,(h-37)/1.54)
 tw=2.82*sc;th=1.54*sc
 x=(w-tw)/2
 cornerOffset=min(q['x']+.77 for p in GEO['pockets'] if max(abs(q['z']) for q in p['outline'])>1 for q in p['outline'])
 y=max(25,48-cornerOffset*sc)
 fx=w/2-208;bottom=h-base['bottom']-16
 return {'table':(x,y,tw,th),'scale':sc,'pause':(base['safe'][0],8,44,44),'view':(base['safe'][0],64,44,44),
         'immersive':(base['safe'][0],120,44,44),'reposition':(base['safe'][0],176,44,44),'player1':(w*.30-74,8,148,44),'player2':(w*.68-74,8,148,44),
         'fine':(fx,bottom-56,48,56),'shot':(fx+56,bottom-64,64,64),'spin':(fx+128,bottom-56,48,56),'power':base['power']}

def overhead(a,placing=False):
 l=overhead_layout(a.w,a.h);left,top,tw,th=l['table'];sc=l['scale'];cx=left+tw/2;cy=top+th/2
 def p(x,z):return (cx-z*sc,cy+x*sc)
 def poly(points,color):a.poly([p(q['x'],q['z']) for q in points],color)
 x,y=p(-.77,1.41);a.rect(x,y,2.82*sc,1.54*sc,'#644C35',12,stroke='#8A6E4C',lw=1)
 x,y=p(-.63,1.27);a.rect(left+3,top+3,tw-6,th-6,None,10,stroke='#A18A67',alpha=.35,lw=.6);a.rect(x,y,2.54*sc,1.26*sc,'#245A4D',4)
 for rail in GEO['rails']:poly(rail['polygon'],'#173F34')
 for pocket in GEO['pockets']:poly(pocket['outline'],'#07120F')
 if placing:
  q,_=p(0,.635);a.line(q,cy-.63*sc,q,cy+.63*sc,GOLD,1,'5 5');a.text(q-8,cy-.63*sc+20,'开球线后',10,GOLD,'end')
  a.rect(x+6,y+6,max(1,q-x-6),1.26*sc-12,'#D9BD83',3,alpha=.055)
 else:
  a.line(*p(0,1.16),*p(0,.713),'#C2A16B',3);a.line(*p(0,.723),*p(0,.709),'#83B5B2',3)
  ps=[p(0,.65),p(.016,.022),p(-.34,-.14)]
  for q,n in zip(ps,ps[1:]):a.line(*q,*n,INK,1.1,'4 4')
  a.line(*p(.04,-.03),*p(.59,-1.22),'#E5BD74',1.1,'4 4')
 balls=BALLS
 if placing:
  order=[1,10,2,11,8,3,12,4,13,5,6,14,7,15,9];balls=[(0,0,.8)];index=0
  for row in range(5):
   for col in range(row+1):balls.append((order[index],(col-row/2)*2*R,-.635-row*math.sqrt(3)*R));index+=1
 for n,x,z in balls:xx,yy=p(x,z);ball2(a,xx,yy,R*sc,n)
 if placing:
  xx,yy=p(0,.8);a.circle(xx,yy,R*sc+5,None,GOLD,lw=1.2)


def layout(w,h):
 left=44 if w==852 else 16;right=left;bottom=21 if w==852 else 8
 pause=(left+8,8,44,44);view=(left+60,8,68,44);stripx=left+140
 stripw=min(352,w-right-100-52-stripx-8);full=(stripx,8,stripw,44);immersive=(stripx+stripw+8,8,44,44)
 spin=(w-right-56,h-bottom-72,48,56);shot=(spin[0]-72,h-bottom-80,64,64);fine=(shot[0]-56,h-bottom-72,48,56);power=(w-right-52,132 if h>=390 else 116,44,144 if h>=390 else 128)
 return dict(safe=(left,0,w-left-right,h-bottom),pause=pause,view=view,players=full,immersive=immersive,fine=fine,shot=shot,spin=spin,power=power,bottom=bottom,host=(w-right-100,8,92,32))

def button(a,r,title,kind=None,primary=False,selected=False):
 x,y,w,h=r;fill=GOLD if primary else SURFACE;color=BG if primary else INK
 a.rect(x,y,w,h,fill,12,stroke='#E7D2A4' if primary else '#456052',alpha=1 if primary else .88,lw=.8)
 if kind:
  size=13;tw=pdfmetrics.stringWidth(title,'Club',size);gx=x+(w-28-tw)/2
  icon(a,kind,gx+10,y+h/2,color);a.text(gx+28,y+h/2+4,title,size,color)
 else:a.text(x+w/2,y+h/2+4,title,13,color,'middle')
 if selected:a.rect(x,y,w,h,None,12,GOLD,lw=1.2)

def action_button(a,r,title,kind,primary=False,selected=False):
 x,y,w,h=r;color=BG if primary else INK
 a.rect(x,y,w,h,GOLD if primary else SURFACE,16 if primary else 12,
        stroke='#E7D2A4' if primary else GOLD if selected else '#456052',alpha=1 if primary else .78,lw=1 if selected else .7)
 icon(a,kind,x+w/2,y+(23 if primary else 19),color)
 a.text(x+w/2,y+h-10,title,12,color,'middle')

def hud(a,mode='第一人称',minimal=False,placing=False,fine=False):
 l=layout(a.w,a.h)
 for key,kind in [('pause','pause'),('immersive','expand')]:
  x,y,w,h=l[key];a.rect(x,y,w,h,SURFACE,12,alpha=.88);icon(a,kind,x+w/2,y+h/2)
 x,y,w,h=l['view'];a.rect(x,y,w,h,SURFACE,12,alpha=.88);a.text(x+w/2,y+27,mode,11,'#738579' if placing else GOLD,'middle')
 if not minimal:
  x,y,w,h=l['players'];a.rect(x,y,w,h,SURFACE,12,alpha=.88)
  for i,(name,meta) in enumerate([('林间听风','全色 · 剩4'),('AI 陪练','半色 · 剩5')]):
   xx=x+i*w/2;a.circle(xx+18,30,10,'#4F775B' if i==0 else '#8D694C');a.circle(xx+18,30,12,None,GOLD if i==0 else '#496151',lw=1)
   a.text(xx+36,24,name,12);a.text(xx+36,41,'尚未分组' if placing else meta,11,MUTED)
   if i==0:
    with a.clip_poly([(xx+18+10*math.cos(k*math.pi/12),30+10*math.sin(k*math.pi/12)) for k in range(24)]):
     a.circle(xx+21,26,2.5,'#E7D4A3');a.poly([(xx+7,40),(xx+15,26),(xx+26,40)],'#1D4938');a.poly([(xx+15,42),(xx+23,30),(xx+31,42)],'#365F46')
   else:
    a.poly([(xx+12,24),(xx+18,28),(xx+24,24),(xx+23,33),(xx+18,38),(xx+13,33)],'#ECC78F');a.circle(xx+15,30,.7,DARK);a.circle(xx+21,30,.7,DARK);a.circle(xx+18,34,.8,DARK)
    tx=xx+w/2-46;a.rect(tx,12,34,16,'#293E2F',4,'#8D7855',lw=.6);a.text(tx+17,24,'标准',11,GOLD,'middle')
 else:
  x,y,_,_=l['players'];a.rect(x,y,44,44,SURFACE,12,alpha=.55);icon(a,'info',x+22,y+22);a.text(l['safe'][0]+8,80,'你的回合 · 全色',11,GOLD)
 if placing:
  statusx=l['fine'][0]+4;a.text(statusx,84,'开球 · 线后摆球',12,GOLD);a.text(statusx,106,'轻触台面移动母球',11,MUTED)
  button(a,(l['fine'][0],a.h-l['bottom']-64,176,52),'确认摆球',kind='spin',primary=True)
 else:
  if not minimal:
   xx=l['safe'][0]+8 if mode=='第一人称' else l['fine'][0]+4
   a.rect(xx,64,164,26,SURFACE,8,alpha=.72);a.text(xx+12,82,'轮到你 · 全色球',12,GOLD)
   a.circle(xx+8,105,3,None,INK,lw=1);a.text(xx+17,109,'母球',10,MUTED);a.poly([(xx+66,101),(xx+70,105),(xx+66,109),(xx+62,105)],None,GOLD,lw=1);a.text(xx+76,109,'4号目标',10,GOLD)
  x,y,w,h=l['power'];a.rect(x,y,w,h,SURFACE,13,alpha=.48);a.text(x+w/2,y-11,'65%',16,INK,'middle',True);a.line(x+w/2,y+12,x+w/2,y+h-12,TRACK,4);a.line(x+w/2,y+h-12,x+w/2,y+12+(h-24)*.35,GOLD,4);a.circle(x+w/2,y+12+(h-24)*.35,7,GOLD)
  action_button(a,l['fine'],'微调','fine',selected=fine);action_button(a,l['shot'],'出杆','cue',True);action_button(a,l['spin'],'打点','spin')
 if not minimal and mode=='第一人称':a.text(l['safe'][0]+8,a.h-l['bottom']-20,'全轨迹见俯视',11,MUTED)
 # System home indicator is context only, outside the game safe area.
 a.rect((a.w-110)/2,a.h-11,110,3,'#6E8075',2,alpha=.6)
 return l

def overhead_hud(a,placing=False):
 l=overhead_layout(a.w,a.h)
 for key,kind in [('pause','pause'),('immersive','expand')]:
  x,y,w,h=l[key];a.rect(x,y,w,h,BG,12,alpha=.85);icon(a,kind,x+w/2,y+h/2)
 x,y,w,h=l['view'];a.rect(x,y,w,h,BG,12,alpha=.85);a.text(x+w/2,y+27,'俯视',11,MUTED if placing else GOLD,'middle')
 if not placing:
  x,y,w,h=l['reposition'];a.rect(x,y,w,h,BG,12,alpha=.85);a.text(x+w/2,y+27,'换位',11,INK,'middle')
 for i,(key,name,meta) in enumerate([('player1','林间听风','全色 · 剩4'),('player2','AI 陪练','半色 · 剩5 · 标准')]):
  x,y,w,h=l[key];a.rect(x,y,w,h,BG,22,stroke=GOLD if i==0 else '#4A6555',alpha=.94,lw=.8)
  a.circle(x+22,y+22,15,'#4F775B' if i==0 else '#8D694C');a.circle(x+22,y+22,15,None,GOLD if i==0 else '#C9AF84',lw=.8)
  if i==0:
   a.circle(x+26,y+16,3,'#E7D4A3');a.poly([(x+9,y+32),(x+18,y+14),(x+32,y+32)],'#214C39')
  else:
   a.poly([(x+12,y+13),(x+22,y+19),(x+32,y+13),(x+29,y+27),(x+22,y+33),(x+15,y+27)],'#ECC78F');a.circle(x+18,y+23,1,DARK);a.circle(x+26,y+23,1,DARK)
  a.text(x+44,y+18,name,12);a.text(x+44,y+35,'尚未分组' if placing else meta,10,MUTED)
 # Tiny turn indicator replaces the old status card and duplicated trajectory legend.
 a.circle(l['player1'][0]+8,62,2.5,GOLD);a.text(l['player1'][0]+17,66,'线后摆球 · 轻触移动母球' if placing else '你的回合',11,GOLD)
 if placing:
  button(a,(a.w/2+48,a.h-layout(a.w,a.h)['bottom']-68,176,52),'确认摆球','spin',True)
 else:
  x,y,w,h=l['power'];a.rect(x,y,w,h,BG,22,alpha=.78);a.text(x+w/2,y-11,'65%',16,INK,'middle',True)
  a.line(x+w/2,y+12,x+w/2,y+h-12,TRACK,4);a.line(x+w/2,y+h-12,x+w/2,y+12+(h-24)*.35,GOLD,4);a.circle(x+w/2,y+12+(h-24)*.35,7,GOLD)
  action_button(a,l['fine'],'微调','fine');action_button(a,l['shot'],'出杆','cue',True);action_button(a,l['spin'],'打点','spin')
 a.rect((a.w-110)/2,a.h-11,110,3,'#6E8075',2,alpha=.6)
 return l

def spin_overlay(a):
 x=a.w-44-8-280;y=64;w=280;h=a.h-64-29
 a.rect(x,y,w,h,SURFACE,18,stroke='#536655')
 a.text(x+16,y+28,'母球打点',18);a.text(x+w-24,y+28,'取消',12,MUTED,'end');a.text(x+16,y+50,'沿球杆看向母球',11,MUTED)
 cx=x+140;cy=y+130;r=56;ball2(a,cx,cy,r,0);a.circle(cx,cy,39,None,'#718D7B',lw=1);a.line(cx-40,cy,cx+40,cy,'#73917D',.8,'3 4');a.line(cx,cy-40,cx,cy+40,'#73917D',.8,'3 4')
 a.text(cx,cy-r-10,'高杆',10,GOLD,'middle');a.text(cx,cy+r+19,'低杆',10,GOLD,'middle');a.text(cx-r-17,cy+4,'左塞',10,GOLD,'middle');a.text(cx+r+17,cy+4,'右塞',10,GOLD,'middle')
 a.circle(cx,cy,3,None,'#264837',lw=1);a.line(cx,cy,cx+15.6,cy+11.7,'#4F8069',1.2);a.circle(cx+15.6,cy+11.7,5,'#1E4938',GOLD,lw=1.5)
 a.text(cx,y+h-66,'草稿：低杆30% · 右塞40%',12,INK,'middle')
 button(a,(x+16,y+h-56,104,44),'复位中杆');button(a,(x+132,y+h-56,132,44),'完成',primary=True)

def fine_overlay(a):
 x=212;y=a.h-layout(a.w,a.h)['bottom']-60;w=300;h=48;a.rect(x,y,w,h,SURFACE,12,stroke='#52705E',alpha=.94)
 a.text(x+22,y+31,'−',20,INK,'middle');a.text(x+w-22,y+31,'+',20,INK,'middle');a.text(x+w/2,y+17,'+1.2°',11,GOLD,'middle',True)
 a.line(x+52,y+31,x+w-52,y+31,TRACK,2);a.circle(x+w/2+24,y+31,4,GOLD)

def start_overlay(a):
 a.rect(0,0,a.w,a.h,'#03130D',alpha=.42);x=186;y=64;w=480;h=296;a.rect(x,y,w,h,SURFACE,20,stroke='#4E6353')
 a.text(x+24,y+31,'开始一局',20);a.text(x+w-24,y+31,'取消',12,MUTED,'end')
 a.text(x+24,y+58,'选择玩法和难度，开始后先摆放母球。',12,MUTED)
 for i,title in enumerate(['人机练习','双人同屏']):button(a,(x+24+i*220,y+78,212,44),title,selected=i==0)
 for i,title in enumerate(['入门','标准','挑战']):button(a,(x+24+i*146,y+136,138,44),title,selected=i==1)
 a.text(x+24,y+204,'标准：直接进攻与防守优先，必要时解球。',12,MUTED)
 button(a,(x+24,y+h-64,w-48,48),'开始对局',primary=True)

def draw_screen(a,kind):
 with a.screen_clip():
  a.rect(0,0,a.w,a.h,BG)
  if kind=='portrait':
   a.circle(a.w/2,235,32,SURFACE,GOLD,lw=1);a.text(a.w/2,247,'8',32,GOLD,'middle',True);icon(a,'rotate',a.w/2,338,GOLD,1.8)
   a.text(a.w/2,408,'请横屏体验',24,INK,'middle');a.text(a.w/2,445,'当前球局已暂停',14,MUTED,'middle');a.text(a.w/2,471,'横置手机后，点击继续对局',13,MUTED,'middle');a.text(a.w/2,610,'球位、力度与已确认打点保留',12,MUTED,'middle')
  else:
   overhead(a,kind=='place') if kind in ['overhead','place'] else perspective(a)
   overhead_hud(a,kind=='place') if kind in ['overhead','place'] else hud(a,'第一人称',kind=='minimal',False,kind=='fine')
   if kind=='spin':
    # The editor is temporary; the primary controls underneath are not interactive.
    spin_overlay(a)
   if kind=='fine':fine_overlay(a)
   if kind=='start':start_overlay(a)
 a.rect(.5,.5,a.w-1,a.h-1,None,22,'#3C5546',lw=1)

FIGURES=[('L01-first-person','第一人称正常瞄准','aim',852,393),('L02-minimal','第一人称简洁显示','minimal',852,393),('L03-overhead','俯视完整台面','overhead',852,393),('L04-placement','线后摆球','place',852,393),('L05-spin','母球打点草稿','spin',852,393),('L06-fine','微调展开','fine',852,393),('L07-start','局中选择玩法','start',852,393),('L08-portrait-pause','竖屏中断提示','portrait',393,852),('L09-compact','紧凑横屏构图','aim',667,375),('L10-wide','宽横屏构图','aim',932,430)]

def render_figures(names=None):
 for name,title,kind,w,h in FIGURES:
  if names is not None and name not in names:continue
  path=TMP/(name+'.pdf');c=canvas.Canvas(str(path),pagesize=(w,h));c.setTitle(title+' / V2.0 DESIGN ONLY');c.setAuthor('Cocos Billiards');a=Art(c,w,h);draw_screen(a,kind);a.save(OUT/(name+'.svg'));c.showPage();c.save()
  subprocess.run(['pdftoppm','-singlefile','-scale-to',str(max(w,h)*2),'-png',str(path),str(OUT/name)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

# Document composition uses the same vector artwork as the editable SVG files.
sys.path.insert(0,str(Path(__file__).resolve().parent))
from landscape_design_content import PRODUCT,UI_SCREENS,STATE_ROWS
FIG={f[0]:f for f in FIGURES}
def wrap(value,width,size=12,font='Club'):
 rows=[]
 for para in value.split('\n'):
  row=''
  for ch in para:
   if pdfmetrics.stringWidth(row+ch,font,size)>width and row:
    # Hanging closing punctuation avoids isolated punctuation at a new CJK line.
    if ch in '。，；、：！？）】》”’.,%':
     row+=ch;continue
    carry=row[-1:] if row[-1:] in '（【《“‘' else ''
    rows.append(row[:-1] if carry else row);row=carry
   row+=ch
  rows.append(row)
 return rows

def paragraph(a,x,y,title,body,width,size=12,heading=16,leading=20):
 a.text(x,y,title,heading,DARK);y+=28
 for row in wrap(body,width,size):a.text(x,y,row,size,'#395446');y+=leading
 return y+20

def doc_frame(c,w,h,title,subtitle,page,product=False):
 a=Art(c,w,h);a.rect(0,0,w,h,PAPER);a.text(42,32,'EIGHT CLUB / '+('PRODUCT DESIGN' if product else 'UI UX DESIGN'),9,'#6B7D70',latin=True)
 a.rect(w-170,18,126,22,'#ECEBDD',6);a.text(w-107,33,'V2.0 · 评审稿',10,DARK,'middle')
 a.text(42,80,title,24 if product else 29,DARK)
 for i,row in enumerate(wrap(subtitle,w-84,11 if product else 13)):a.text(42,108+i*20,row,11 if product else 13,'#607466')
 a.line(42,h-40,w-42,h-40,'#D8DED1',.7);a.text(42,h-21,'2026.11.03 / 横屏设计 · 未实施',9,'#6B7D70');a.text(w-44,h-21,str(page),10,'#6B7D70','end',True)
 return a

def screen_on(c,name,x,y,width,pageh=900):
 _,_,kind,w,h=FIG[name];scale=width/w;c.saveState();c.translate(x,pageh-y-h*scale);c.scale(scale,scale);a=Art(c,w,h);draw_screen(a,kind);c.restoreState();return h*scale

def columns(a,items,y=706):
 for i,(title,body) in enumerate(items):
  end=paragraph(a,64+i*366,y,title,body,336,12,17,20)
  if end>850:raise ValueError('UI copy overflow: '+title)

def table(a,x,y,width,columns,rows,weights=None,rowh=66,size=12):
 weights=weights or [1]*len(columns);ws=[width*v/sum(weights) for v in weights]
 for i,row in enumerate([columns]+rows):
  yy=y+i*rowh;a.rect(x,yy,width,rowh,'#E6EBDF' if i==0 else '#EDF0E7' if i%2 else '#FBFAF4')
  xx=x
  for j,cell in enumerate(row):
   textrows=wrap(str(cell),ws[j]-24,size)
   if len(textrows)*(size+6)>rowh-14:raise ValueError('Table cell overflow '+str(cell))
   for k,line in enumerate(textrows):a.text(xx+12,yy+22+k*(size+6),line,size,DARK if i==0 else '#405A4B')
   xx+=ws[j]
 return y+(len(rows)+1)*rowh

def build_product():
 c=canvas.Canvas(str(D/'中式八球产品设计方案.pdf'),pagesize=(595.28,841.89));c.setTitle('中式八球 产品 V2.0 横屏评审稿');c.setAuthor('Cocos Billiards')
 for i,(title,lead,items) in enumerate(PRODUCT,1):
  a=doc_frame(c,595.28,841.89,title,lead,i,True);y=157
  for head,body in items:
   y=paragraph(a,44,y,head,body,507,11.2,14.5,19)
   if y>795:raise ValueError('Product page overflow '+str(i))
  c.showPage()
 c.save()

def build_uiux():
 c=canvas.Canvas(str(D/'中式八球UIUX设计方案.pdf'),pagesize=(1200,900));c.setTitle('中式八球 UI UX V2.0 横屏评审稿');c.setAuthor('Cocos Billiards');page=0
 def frame(title,sub):
  nonlocal page
  page+=1;return doc_frame(c,1200,900,title,sub,page)
 a=frame('横屏 · 沉浸式专业球房','横屏替代竖屏游戏布局；第一人称最大化展示。图稿用于评审，不是运行截图。')
 screen_on(c,'L01-first-person',64,156,1072);columns(a,[('100%场景视口','取消固定宽高的操作栏和身份栏，HUD悬浮在边缘；扩大视口时同步优化真实桌面构图。'),('保留操作与判断','稳定身份识别、明确力度百分比、三项线框图标与独立出杆，俯视完整台面始终可达。'),('范围与状态','本轮仅修改产品、UI/UX规范及图稿。当前游戏仍为V1.15.3，V2.0细节等待本轮评审。')]);c.showPage()
 a=frame('布局骨架与安全区','参考852×393逻辑像素，坐标从完整画布左上角计算；真实宿主与系统区域优先。')
 screen_on(c,'L01-first-person',64,156,1072);sc=1072/852
 for key,n in [('pause','1'),('players','2'),('power','3'),('shot','4')]:
  x,y,w,h=layout(852,393)[key];a.rect(64+x*sc,156+y*sc,w*sc,h*sc,None,10,'#CE8B5F',lw=1.4,dash='5 4');a.circle(64+x*sc,156+y*sc,11,GOLD);a.text(64+x*sc,160+y*sc,n,10,DARK,'middle',True)
 columns(a,[('1 / 导航与2 / 身份','暂停44×44，视角68×44；身份窄条352×44含两个176×44点击区，短昵称与球组计数可展开。'),('3 / 力度与4 / 出杆','力度触区44×144；三操作图标在上、文字在下。出杆64×64，微调/打点48×56，间距8，底边对齐。'),('覆盖目标','场景视口100%；常态高遮挡UI目标≤15%，简洁态≤8%。图中虚线标号属于文档注释，不在游戏内绘制。')]);c.showPage()
 for title,name,sub,items in UI_SCREENS:
  a=frame(title,sub);screen_on(c,name,64,156,1072);columns(a,items);c.showPage()
 a=frame('竖屏只承接进入与中断','L08 / 中局旋转示例；不提供竖屏瞄准、力度条或出杆按钮。')
 screen_on(c,'L08-portrait-pause',70,158,258)
 y=190
 for title,body in [('首次进入','标题“请横屏体验”，说明“横置手机开始游戏”。不存在球局时不能写成已经暂停。横置后进入开始面板。'),('对局中旋回竖屏','展示当前已暂停、球局保留的状态。转回横屏后显示明确的“继续对局”，保持原视角和原阶段，不自动开球。'),('平台与权限','进入时请求横屏；被系统或宿主限制时提示用户横置，不拉伸竖屏、不依赖键盘。平台实际旋转能力和真机安全区尚待后续验证。'),('操作恢复','旋转结束旧手势；打点仍是草稿，摆球仍待确认，锁定杆不被改写。人类触球前取消准备后须再次点击出杆。')]:y=paragraph(a,380,y,title,body,750,14,20,24)
 c.showPage()
 a=frame('组件、字体、颜色与图标','保持墨绿、胡桃木与香槟金；拟真材料用于球桌，功能图标统一线框。')
 palette=[('背景',BG),('面板',SURFACE),('台呢','#286556'),('胶边','#163E34'),('胡桃木','#614630'),('主操作',GOLD),('主文字',INK),('次文字',MUTED)]
 for i,(name,color) in enumerate(palette):
  x=64+(i%4)*274;y=162+(i//4)*116;a.rect(x,y,250,48,color,10,stroke='#C7D0C2');a.text(x,y+71,name+'  '+color,13,DARK)
 for i,(kind,title) in enumerate([('fine','微调'),('cue','出杆'),('spin','打点')]):
  x=84+i*174;action_button(a,(x,439 if i==1 else 447,64 if i==1 else 48,64 if i==1 else 56),title,kind,i==1)
 paragraph(a,64,558,'图标与按钮','20×20线框图标，1.5px圆端点，图标在上、12px文字在下；出杆64×64，次操作48×56，间隔8、底边对齐。主操作金底，次操作低强调墨绿底。',510,14,20,24)
 paragraph(a,64,727,'材料与接触','真实球径、球底相切、同一透视投影与贴地阴影。半色球为连续环带，球面数字随球且接受遮挡；不能沉球或放大球号遮盖问题。',510,13,19,22)
 paragraph(a,650,436,'字体层级','面板标题18-24，动作12-14，正文14；草稿读数12、身份12/11、图例10、辅助11-12、力度16。字号按角色固定，不随整张画面同比例缩小。',480,14,20,24)
 paragraph(a,650,605,'对比与状态','文本目标对比≥4.5:1、关键线框/焦点≥3:1，需在真实背景复核。当前行动方同时用文字和描边表达，禁用状态保留形状与可读标题。',480,14,20,24)
 paragraph(a,650,755,'长信息','昵称主条省略、资料展示完整；规则、判罚和署名分页。数值和错误原因不能依赖颜色单独表达。',480,13,19,22);c.showPage()
 a=frame('出杆图标与实际击球同步','使用“斜向连续球杆＋空心球”的完整命名；无需依赖历史方案字母理解。')
 phases=[('待机','点击之前','球杆与空心球待机'),('后收','0-140ms','只播放按钮准备'),('前送','140-220ms','场景母球仍不动'),('触球','220ms','唯一提交实际击球与声音'),('反馈与离场','220-640ms','220-480ms球离场；\n480-640ms只留杆'),('复位','640-820ms','恢复待机图标')]
 for i,(title,time,body) in enumerate(phases):
  x=64+i*180;a.rect(x,175,168,238,'#E9EDDF',12,stroke=GOLD if i==3 else '#D3DBC9',lw=2 if i==3 else .8);a.text(x+84,205,title,17,DARK,'middle');a.text(x+84,230,time,12,'#637761','middle');icon(a,'cue',x+84,285,DARK,2.6,i==3)
  yy=347
  for line in wrap(body,140,12):a.text(x+14,yy,line,12,DARK);yy+=19
  if i==3:a.rect(x+18,378,132,30,GOLD,6);a.text(x+84,399,'同帧 · 仅一次',12,DARK,'middle')
 table(a,64,472,1072,['准备阶段','触球关键帧','运动与恢复'],[['方向、力度、确认打点锁定；允许切换查看视角','按钮触球、母球启动、击球音效同帧；不能点击即运动','不因动画结束追球；暂停后不重播、不多打一杆'],['旋转到竖屏会取消未触球准备，保留参数','跨帧也不能漏交或重复提交；低帧率单独验收','减少动态保留触球同步；不增加裁判/环境/UI提示音']],[1,1,1],116,14)
 a.text(64,832,'验收关注实际关键帧和次数，不把墙钟恰好220ms当作唯一证明。',13,'#607466');c.showPage()
 a=frame('响应式横屏与遮挡保护','667×375 / 852×393 / 932×430；不新增竖屏游戏版式。')
 screen_on(c,'L09-compact',64,173,510);screen_on(c,'L10-wide',626,173,510)
 y=514
 for i,(title,body) in enumerate([('紧凑横屏','身份条按内容减少详情，昵称省略但可展开；触区和字号不按整图缩小。操作组顺序稳定，保留力度读数。'),('关键区域','保护可见母球、杆头、首碰点、当前目标袋口；俯视六袋无遮挡。提供收起辅助与手动换侧，不在按下或连续拖动中自动跳位。'),('安全区与平板','图稿留白是参考，不冒充具体设备的真实安全区。宿主预留优先；平板增加可视场景，控件保持可达，左手方案待单独评审。')]):paragraph(a,64+i*366,y,title,body,336,14,19,24)
 a.text(64,801,'保护边距参考：袋口12px，母球/杆头/首碰20px；最终需在实际投影和触摸过程中复核。',13,'#607466');c.showPage()
 a=frame('状态、权限与恢复','横屏和视角属于显示；裁判、参数、草稿和击球提交各自保留原语义。')
 table(a,64,158,1072,['阶段','展示','可操作范围','恢复要求'],STATE_ROWS,[1.05,1.65,1.6,2],66,12);c.showPage()
 a=frame('可验证的设计与实施标准','A01-A12为后续验收要求；本轮只核查文档和图稿，未实施游戏。')
 checks=[('A01 横屏单一布局','竖屏只提示，横置进入流程；初次进入与中断文案区分。'),('A02 大场景','第一人称视口占画布100%，无固定空侧栏/底栏，避免放大空背景。'),('A03 触摸可达','所有互动目标≥44，参考和紧凑横屏均无重叠；主操作不在按下时跳位。'),('A04 真实接触','球底/阴影/库边关系可信，球径不变，球面号码和环带有深度遮挡。'),('A05 查看权限','除摆球固定俯视外可双向切换；AI、准备、运动和结果不额外禁用。'),('A06 参数保持','切换/旋转/微调展开不改变原球位、方向、力度或确认打点。'),('A07 唯一触球','逻辑220ms触球关键帧与实际球/音效同帧，低帧率和连点不重复。'),('A08 草稿恢复','摆球待确认、打点待完成的状态不被横置/继续按钮代替。'),('A09 轨迹不伪造','白/金虚线、完整/未完成/屏外语义区分，屏边不伪装最终落点。'),('A10 必要功能','AI难度、身份、规则、判罚、设置、重开、结果和署名均保留。'),('A11 遮挡可解除','目标袋口与母球存在无遮挡操作路径，可收起/换侧而不退出第一人称。'),('A12 分环境记录','Node、Creator构建、浏览器、编辑器预览分别记录；未测平台不宣称通过。')]
 for i,(title,body) in enumerate(checks):
  col=i%2;row=i//2;paragraph(a,64+col*548,169+row*102,title,body,504,12,17,20)
 a.text(64,815,'待确认：新用户默认第一人称、简洁模式默认值、操作组尺寸、左手布局是否首版纳入。',13,'#607466');c.showPage()
 a=frame('图稿索引与版本关系','所有画面为可编辑SVG及其PNG渲染。路径相对仓库，不含设备或个人目录。')
 rows=[[name.split('-')[0],title,f'{w}×{h}',name+'.svg'] for name,title,kind,w,h in FIGURES]
 table(a,64,162,1072,['编号','画面','逻辑画幅','编辑源（landscape/）'],rows,[.5,1.55,.8,2.75],46,12)
 y=716;paragraph(a,64,y,'当前与历史','两份主PDF、landscape-product.md、landscape-uiux.md与ui-contract.json为V2.0评审设计。V1.15.3主PDF和原契约保留在archive/v1.15.3；当前运行仍为21abab2，本轮不改代码或配置。',1072,14,20,24)
 c.showPage();c.save();return page

def write_markdown(ui_pages):
 product=['# 中式八球产品设计 V2.0\n\n2026-11-03 · 横屏沉浸式 · 评审稿 · 未实施\n']
 for i,(title,lead,items) in enumerate(PRODUCT,1):
  product.append(f'## P{i:02d} {title}\n\n{lead}\n')
  for h,b in items:product.append(f'### {h}\n\n{b}\n')
 (D/'landscape-product.md').write_text('\n'.join(product))
 ui=['# 中式八球 UI / UX V2.0\n\n2026-11-03 · 横屏沉浸式 · 评审稿 · 未实施\n\n参考画幅852×393，安全区参考left/right44、bottom21、top0；实际服从系统和宿主。场景视口占画布100%，控件悬浮。所有数字是设计规范，不是运行测量结果。\n']
 for title,name,sub,items in UI_SCREENS:
  ui.append(f'## {title}\n\n{sub}\n\n![{title}](landscape/{name}.png)\n')
  for h,b in items:ui.append(f'### {h}\n\n{b}\n')
 ui.extend(['## 竖屏与恢复\n\n竖屏仅提示，不提供玩法；首次进入与中局暂停文案不同。横置不自动继续，旧手势结束，未完成摆球/草稿不自动确认，触球后的运动不重播。\n','## 控件规范\n\n暂停44×44；视角68×44；身份352×44（两个176×44入口）；力度44×144；微调/打点48×56；出杆64×64。三者底边对齐、间距8，图标在上、12px文字在下；图标20×20、1.5px圆端点线框，顺序微调/出杆/打点。字体：标题18-24、操作12-14、正文14、辅助11-12、力度16；草稿读数12、身份12/11、图例10、次级链接12。\n','## 避让\n\n参考袋口12px、母球/杆头/首碰20px。初始落位避让，连续拖动/按下期间主操作不自动跳位；可主动收起辅助和换侧。俯视六袋完整，第一人称允许自然几何遮挡但提供无遮挡观察路径。\n','## 状态表\n\n|阶段|展示|操作|恢复|\n|---|---|---|---|\n'+'\n'.join('|'+ '|'.join(row)+'|' for row in STATE_ROWS)+'\n','## 完整规范\n\n组件、时序、响应、全部验收要求与图稿索引见同目录主UIUX PDF第11-16页；机器可读坐标见ui-contract.json。左右手布局、默认简洁和新用户默认第一人称为本稿建议，等待评审。\n'])
 (D/'landscape-uiux.md').write_text('\n'.join(ui))
 legend='# 横屏 V2.0 图稿\n\n2026-11-03。设计评审图，不是Creator运行截图或实物标定。SVG是编辑源，PNG是同源渲染；文档生成脚本为scripts/build-landscape-design.py。\n\n|编号|名称|画幅|\n|---|---|---|\n'+'\n'.join(f'|{n.split("-")[0]}|[{title}]({n}.svg)|{w}×{h}|' for n,title,kind,w,h in FIGURES)+'\n\n球桌与球的比例沿用现有项目基线；袋口沿用明确近似的视觉代理，不提供新厂家尺寸、不据此改变物理。上方灰色系统区域只作情境示意，不是游戏自绘宿主控件。\n'
 (OUT/'README.md').write_text(legend)


def contract(ui_pages):
 l=layout(852,393);asrect=lambda r:dict(zip(['x','y','width','height'],r));players=l['players'];leaves={k:asrect(v) for k,v in l.items() if k not in ['safe','bottom','players','host']};leaves['player1']=asrect((players[0],players[1],players[2]/2,players[3]));leaves['player2']=asrect((players[0]+players[2]/2,players[1],players[2]/2,players[3]));
 data={'version':'2.0-design-review','date':'2026-11-03','status':'design-only; not implemented or runtime-validated','runtimeBaseline':{'version':'1.15.3','commit':'21abab2','historicalContract':'archive/v1.15.3/ui-contract.json'},'orientation':'landscape-only gameplay; portrait entry/interruption shell','referenceFrame':[852,393],'unit':'logical pixels, origin top-left','referenceSafeInsets':{'left':44,'right':44,'top':0,'bottom':21},'sceneViewport':asrect((0,0,852,393)),'referenceHostRegion':{**asrect(l['host']),'clearanceMin':8,'note':'platform-reserved; not painted as a game control'},'referenceInteractiveBounds':leaves,'firstVisitReadyDefault':{'value':'first-person','status':'proposal in this review; remember explicit later choice'},'viewPolicy':'only cue placement forces overhead; no cue-obstruction denial; shot-origin observation stays fixed during motion','surfaceCoverageTargets':{'normalMaxFraction':.15,'minimalMaxFraction':.08,'note':'visual high-occlusion area, not a fake giant transparent input blocker; real scenes require later validation'},'spinPanel':{'rect':asrect((520,64,280,300)),'cancel':asrect((728,72,64,44)),'reset':asrect((536,308,104,44)),'done':asrect((652,308,132,44)),'draftOnly':True,'face':{'center':[660,194],'diameter':112,'selectionRadius':39,'touchSurface':asrect((584,118,152,152)),'exampleDraft':{'rightFraction':.4,'lowFraction':.3},'outsideSelection':'clamp to selection circle; completion still explicit'}},'fineOverlay':{'rect':asrect((212,312,300,48)),'minus':asrect((214,314,44,44)),'plus':asrect((466,314,44,44)),'sliderTouch':asrect((260,312,204,48)),'rangeDegrees':[-5,5],'tapStepDegrees':.1},'touch':{'minimum':44,'icons':20,'iconStroke':1.5,'shotOrder':['fine','shoot','spin'],'tipButtonRightOfShoot':True},'protectedMargins':{'pocket':12,'cueTipContact':20,'units':'logical px, design target'},'minimalRetains':['turnActor','groupOrAiLevel','power','pause','view','threeActions'],'palette':{'background':BG,'surface':SURFACE,'felt':'#286556','rail':'#163E34','wood':'#614630','gold':GOLD,'ink':INK,'muted':MUTED,'disabled':'#738579','pressed':'#314A3D','cueTrajectory':'#F5F1E6','targetTrajectory':'#E5BD74','loss':'#D99588','foul':'#E0AE73'},'type':{'heading':[18,24],'action':[12,14],'body':14,'secondary':[11,12],'power':16,'identityName':12,'identityMeta':11,'navigation':11,'turn':12,'draftReadout':12,'trajectoryLegend':10,'secondaryLink':12},'shot':{'contactMs':220,'durationMs':820,'segments':[[0,140,'backswing'],[140,220,'forward'],[220,480,'feedback and ball exit'],[480,640,'cue only'],[640,820,'reset']],'uniqueContactSubmission':True},'portraitReturn':'preserve stage, drafts and match; explicit resume; no automatic confirmation or extra stroke','responsiveFrames':[[667,375],[852,393],[932,430]],'ai':'existing natural direct-priority policy, adjustable difficulty; human observation never grants control','notInScope':['runtime game changes','platform export/configuration','real-device certification','online matches','new physical rules'],'reviewItems':['first-ready default perspective','minimal default','control dimensions','left-hand layout release priority'],'figures':[{'id':n.split('-')[0],'title':title,'source':'landscape/'+n+'.svg','render':'landscape/'+n+'.png','frame':[w,h]} for n,title,kind,w,h in FIGURES]}
 oh=overhead_layout(852,393)
 data['overheadLayout']={'tableOuter':asrect(oh['table']),'tableAreaFraction':oh['table'][2]*oh['table'][3]/(852*393),'strategy':'centered full-height table, floating split player chips and controls; no reserved header or side column','interactiveBounds':{k:asrect(v) for k,v in oh.items() if k not in ['table','scale']},'sixPocketsUnobstructed':True,'pocketClearance':12,'hostClearance':8,'illustratedControlSlot':'left to avoid the right-bottom target trajectory','rightSlot':{k:asrect((oh[k][0]+256,*oh[k][1:])) for k in ['fine','shot','spin']},'placementConfirmation':asrect((474,304,176,52)),'occlusionPolicy':'protect cue, first contact and target pocket on scene projection; choose alternate slot before press; manual collapse/reposition available; never move under a held finger'}
 data['actionButtons']={'layout':'icon above label; aligned bottom edges','labelSize':12,'iconSize':20,'stroke':1.5,'gap':8,'secondaryRadius':12,'primaryRadius':16,'secondarySize':[48,56],'primarySize':[64,64],'secondaryFill':SURFACE,'primaryFill':GOLD,'contactMs':220}
 (D/'ui-contract.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
 manifest={'version':'2.0-design-review','date':'2026-11-03','direction':'专业球房 · 横屏沉浸式','status':'direction confirmed; details under review; not implemented','runtimeBaseline':'21abab2 / V1.15.3','referenceFrame':[852,393],'productPdf':'中式八球产品设计方案.pdf','uiuxPdf':'中式八球UIUX设计方案.pdf','productSource':'landscape-product.md','uiuxSource':'landscape-uiux.md','contract':'ui-contract.json','productPages':len(PRODUCT),'uiuxPages':ui_pages,'figures':data['figures'],'historicalArchive':'archive/v1.15.3','confirmed':['landscape replaces portrait gameplay','maximize first-person display','touch only','preserve 220ms contact synchronization'],'pendingReview':data['reviewItems'],'evidenceStatus':'document/figure QA only, no Creator or device acceptance'}
 (D/'design-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 # File-level QA never claims that future game behavior has passed.
 sx,sy,sw,sh=l['safe'];bounds=list(leaves.values());ok=lambda r:r['x']>=sx and r['y']>=sy and r['x']+r['width']<=sx+sw and r['y']+r['height']<=sy+sh
 overlaps=[]
 for i,r in enumerate(bounds):
  assert r['width']>=44 and r['height']>=44 and ok(r)
  for j,t in enumerate(bounds[:i]):
   if r['x']<t['x']+t['width'] and r['x']+r['width']>t['x'] and r['y']<t['y']+t['height'] and r['y']+r['height']>t['y']:overlaps.append([i,j])
 assert not overlaps,overlaps
 qa={'scope':'design-file QA; no runtime acceptance','referenceTouchBounds':'all >=44 and inside reference safe region','overlapPairs':overlaps,'productPages':len(PRODUCT),'uiuxPages':ui_pages,'screens':len(FIGURES),'pending':'PDF and PNG visual review required after generation','gameCodeChanged':False}
 (OUT/'design-qa.json').write_text(json.dumps(qa,indent=2)+'\n')

if __name__=='__main__':
 raise SystemExit('Current design generator: python3 scripts/build-free-camera-design.py')
