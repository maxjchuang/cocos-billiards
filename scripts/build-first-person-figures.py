"""Editable first-person UX concept drawings only; not game or physics output."""
from pathlib import Path
import math,json,subprocess,base64,html
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/design/first-person';OUT.mkdir(parents=True,exist_ok=True)
BED_Y=.002
BALL_R=.028575
C=['#F5F1E6','#D3A32B','#31599A','#B3453D','#73538D','#CF7D35','#427852','#824B3D','#151918']
def text(x,y,s,size=12,fill='#F4F0E6',anchor='start'):
 return f'<text x="{x}" y="{y}" fill="{fill}" font-size="{size}" text-anchor="{anchor}" font-family="PingFang SC,Noto Sans CJK SC,Arial,sans-serif">{html.escape(s)}</text>'
def rect(x,y,w,h,fill,r=0,stroke='none'):
 return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width=".8"/>'
def line(x,y,a,b,c,w=1,dash=''):
 return f'<path d="M{x},{y} L{a},{b}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>'
def circ(x,y,r,c,stroke='none'):
 return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="{stroke}" stroke-width="1"/>'
def ball(x,y,r,n):
 col=C[n-8 if n>8 else n];a=circ(x+.6,y+1.4,r,'#061610')+circ(x,y,r,col if n<9 else C[0]);ident=f'b{str(x).replace(".","_")}{n}'
 if n>8:a+=f'<clipPath id="{ident}">{circ(x,y,r,"white")}</clipPath>'+f'<g clip-path="url(#{ident})">'+rect(x-r,y-r*.48,r*2,r*.96,col)+'</g>'
 a+=circ(x,y,r,'url(#sphere)')
 if n:a+=circ(x,y,r*.5,'#FCF9F0')+text(x,y+r*.22,str(n),max(4,r*.65),'#20342A','middle')
 return a

def hud(mode):
 a=rect(0,0,393,852,'#0E1C19',25)+text(24,28,'9:41',12)+rect(16,48,40,40,'#203129',12)+line(30,61,30,75,'#F4F0E6',2)+line(40,61,40,75,'#F4F0E6',2)
 a+=text(68,73,'中式八球',18)+text(68,88,'人机练习',11,'#ABBAB0')
 a+=rect(148,47,68,44,'#263D30',10,'#6A6047')+text(182,73,mode,11,'#D9BD83','middle')
 # Platform capsule remains reserved, never painted as a working game control.
 for x,name,group,ids in [(20,'林间听风','全色 · 剩4',[1,2,4,7]),(202,'AI 陪练','半色 · 剩5',[9,10,12,14,15])]:
  a+=rect(x,95,171,64,'#20372C' if x==20 else '#15251F',12)+circ(x+23,116,14,'#4E7059' if x==20 else '#735B3D')
  a+=text(x+46,114,name,13)+text(x+46,131,group,11,'#ABBAB0')
  if x==202:a+=rect(324,102,29,17,'#26382A',4,'#8D7855')+text(338.5,114,'标准',10,'#D9BD83','middle')
  for i,n in enumerate(ids):a+=ball(x+18+i*21,146,9,n)
 a+=text(24,179,'轮到你 · 全色球',12,'#D9BD83')+text(274,179,'○ 母球',11,'#F5F1E6')+text(369,179,'◇ 4号',11,'#E5BD74','end')
 a+=text(24,724,'击球力度',12,'#ABBAB0')+text(369,724,'65%',14,'#F4F0E6','end')+line(27,741,366,741,'#364B40',4)+line(27,741,247,741,'#D9BD83',4)+circ(247,741,9,'#E2CB98')
 for x,w,name,icon in [(24,76,'微调','fine'),(112,169,'出杆','cue-idle'),(293,76,'打点','spin')]:
  main=name=='出杆';a+=rect(x,766,w,48,'#D9BD83' if main else '#1C3028',12,'#E5D1A5' if main else '#405247')
  svg=(ROOT/f'docs/design/icons/{icon}.svg').read_text();svg=svg.replace('<svg ',f'<svg x="{x+w/2-28}" y="780" ',1).replace('width="24"','width="20"').replace('height="24"','height="20"').replace('#243F32','#17372B' if main else '#F4F0E6')
  a+=svg+text(x+w/2+10,795,name,14,'#17372B' if main else '#F4F0E6','middle')
 return a+rect(139,838,115,4,'#617368',2)

# Use the existing proxy only as the drawn shape reference. This script never edits it.
code="""const fs=require('fs'),ts=require('typescript'),Module=require('module');const m=new Module('geometry');m._compile(ts.transpileModule(fs.readFileSync('assets/scripts/BilliardsTableGeometry.ts','utf8'),{compilerOptions:{target:7,module:1}}).outputText,'geometry.js');console.log(JSON.stringify({pockets:m.exports.POCKETS,rails:m.exports.CUSHION_PATHS}));"""
geo=json.loads(subprocess.check_output(['node','-e',code],cwd=ROOT))
def scene(raised=False,near=False,offscreen=False,detail=False):
 cuez=1.16 if near else .65;eye=(0,.25 if raised or near else .18,cuez+(.55 if raised else .45));target=(0,.028575,cuez-.65)
 fwd=tuple(b-a for a,b in zip(eye,target));norm=math.sqrt(sum(x*x for x in fwd));fwd=tuple(x/norm for x in fwd);up=(0,-fwd[2],fwd[1]);f=250/math.tan(math.radians(55/2))
 def cam(p):
  d=[a-b for a,b in zip(p,eye)];return (d[0],sum(a*b for a,b in zip(d,up)),sum(a*b for a,b in zip(d,fwd)))
 def proj(q):return (196.5+f*q[0]/q[2],443-f*q[1]/q[2])
 def clip(v):
  out=[]
  for a,b in zip(v,v[1:]+v[:1]):
   if a[2]>=.035:out.append(a)
   if (a[2]>=.035)!=(b[2]>=.035):
    t=(.035-a[2])/(b[2]-a[2]);out.append(tuple(a[i]+t*(b[i]-a[i]) for i in range(3)))
  return out
 def poly(points,fill,stroke='none'):
  q=clip([cam(p) for p in points]);return '' if len(q)<3 else '<polygon points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in map(proj,q))+f'" fill="{fill}" stroke="{stroke}" stroke-width=".6"/>'
 def path(points,color,dash='4 4'):
  a=''
  for p,q in zip(points,points[1:]):
   p,q=cam(p),cam(q)
   if p[2]<.035 or q[2]<.035:continue
   x,y=proj(p);u,v=proj(q);a+=line(x,y,u,v,color,1.2,dash)
  return a
 def ground_shadow(x,z):
  shadow=''
  # All samples lie on the cloth plane, not behind the screen-space ball silhouette.
  for ring in range(40):
   extent=1.1*(1-ring/40);alpha=.012+.018*(ring/40)
   pts=[]
   for i in range(64):
    t=2*math.pi*i/64
    pts.append((x+.003*extent+BALL_R*extent*math.cos(t),BED_Y+.0001,z+.003*extent+BALL_R*extent*.88*math.sin(t)))
   shadow+=f'<g opacity="{alpha}">'+poly(pts,'#071C13')+'</g>'
  return shadow
 def world_ball(x,y,z,n):
  c=cam((x,y,z));distance=math.sqrt(sum(v*v for v in c))
  if c[2]<=BALL_R+.035:return ''
  normal=tuple(v/distance for v in c)
  u=(normal[2],0,-normal[0]);length=math.sqrt(sum(v*v for v in u));u=tuple(v/length for v in u)
  v=(normal[1]*u[2]-normal[2]*u[1],normal[2]*u[0]-normal[0]*u[2],normal[0]*u[1]-normal[1]*u[0])
  centre=tuple(k*(1-BALL_R**2/distance**2) for k in c);radius=BALL_R*math.sqrt(1-BALL_R**2/distance**2)
  rim=[proj(tuple(centre[j]+radius*(u[j]*math.cos(i*math.pi/48)+v[j]*math.sin(i*math.pi/48)) for j in range(3))) for i in range(96)]
  xs=[p[0] for p in rim];ys=[p[1] for p in rim];sx=(min(xs)+max(xs))/2;sy=(min(ys)+max(ys))/2;rx=(max(xs)-min(xs))/2;ry=(max(ys)-min(ys))/2
  outline='M '+' L '.join(f'{a:.3f},{b:.3f}' for a,b in rim)+' Z';ident='sphere-'+str(n)
  col=C[n-8 if n>8 else n]
  a=f'<clipPath id="{ident}"><path d="{outline}"/></clipPath><g clip-path="url(#{ident})">'
  a+=rect(min(xs),min(ys),rx*2,ry*2,col if n<9 else C[0])
  if n>8:a+=rect(sx-rx,sy-ry*.48,rx*2,ry*.96,col)
  a+=f'<path d="{outline}" fill="url(#grounded-sphere)"/>'
  foot_x,foot_y=proj(cam((x,BED_Y,z)))
  a+=f'<ellipse cx="{foot_x}" cy="{foot_y}" rx="{rx*.48}" ry="{ry*.2}" fill="url(#contact-ao)"/>'
  # Small soft reflection, rather than a hemispherical white patch.
  a+=f'<ellipse cx="{sx-rx*.29}" cy="{sy-ry*.4}" rx="{rx*.16}" ry="{ry*.1}" fill="#FFFFFF" opacity=".28"/>'
  if n:a+=circ(sx,sy,min(rx,ry)*.48,'#F7F3E8')+text(sx,sy+ry*.21,str(n),max(4,min(rx,ry)*.64),'#20342A','middle')
  return a+'</g>'
 a=rect(20,193,353,500,'url(#room)',14)+'<g clip-path="url(#view)">'
 # Low-angle silhouettes show thickness, unlike the current top-only prototype.
 a+=poly([(-.77,-.13,-1.41),(.77,-.13,-1.41),(.77,0,-1.41),(-.77,0,-1.41)],'#372B22')
 a+=poly([(-.77,0,-1.41),(.77,0,-1.41),(.77,0,1.41),(-.77,0,1.41)],'url(#wood)')
 a+=poly([(-.63,.002,-1.27),(.63,.002,-1.27),(.63,.002,1.27),(-.63,.002,1.27)],'url(#felt)')
 for r in geo['rails']:
  points=[(p['x'],.038,p['z']) for p in r['polygon']];a+=poly(points,'url(#rail)')
  for b,c in zip(r['nose'],r['nose'][1:]):a+=poly([(b['x'],.002,b['z']),(c['x'],.002,c['z']),(c['x'],.038,c['z']),(b['x'],.038,b['z'])],'#12372C')
 for p in geo['pockets']:a+=poly([(q['x'],.003,q['z']) for q in p['outline']],'#040B08','#2B382C')
 # Cloth-bound shadow footprints and guide markings share the same ground plane.
 zt=cuez-.82
 balls=[(0,BED_Y+BALL_R,cuez,0),(0,BED_Y+BALL_R,zt-.057,4),(-.26,BED_Y+BALL_R,-.68,1),(.3,BED_Y+BALL_R,-.34,2),(.43,BED_Y+BALL_R,.18,12),(-.4,BED_Y+BALL_R,.2,8)]
 for x,y,z,n in balls:a+=ground_shadow(x,z)
 guide_y=BED_Y+.0002
 if not detail:
  a+=path([(0,guide_y,cuez),(0,guide_y,zt)],'#C7D9CC')
  a+=path([(0,guide_y,zt),(-.55,guide_y,-1.18)],'#D6B976','6 4')
  a+=path([(0,guide_y,zt),(.45,guide_y,zt-.2),(.58,guide_y,.2)],'#C7D9CC')
  # Cue shadow is also cast onto the cloth, below all spheres.
  a+=f'<g opacity=".13">'+poly([(.002,guide_y,cuez+.04),(.009,guide_y,cuez+.04),(.014,guide_y,cuez+.4),(-.002,guide_y,cuez+.4)],'#071C13')+'</g>'
 for x,y,z,n in sorted(balls,key=lambda p:cam(p[:3])[2],reverse=True):a+=world_ball(x,y,z,n)
 if not detail:
  # A tapered shaft occupies real foreground space, rather than a constant-width stick below a circle.
  tip_z=cuez+BALL_R+.010;back_z=cuez+.4;cy=BED_Y+BALL_R
  a+=poly([(-.003,cy,tip_z),(.003,cy,tip_z),(.007,cy,back_z),(-.007,cy,back_z)],'url(#cue)')
  a+=poly([(-.0031,cy,tip_z+.003),(.0031,cy,tip_z+.003),(.0033,cy,tip_z+.015),(-.0033,cy,tip_z+.015)],'#DED8BF')
  a+=poly([(-.0031,cy,tip_z),(.0031,cy,tip_z),(.0031,cy,tip_z+.003),(-.0031,cy,tip_z+.003)],'#6B9691')
 a+='</g>'
 if near:a+=rect(54,207,285,28,'#20382C',8)+text(196.5,225,'贴库位置 · 已抬高观察视角',11,'#D9BD83','middle')
 elif offscreen:a+=rect(92,653,209,28,'#14291F',8)+text(196.5,671,'部分轨迹在视野外 · 全轨迹见俯视',11,'#D6C497','middle')
 return a

def save(name,body):
 defs='''<defs><radialGradient id="contact-ao"><stop stop-color="#05180C" stop-opacity=".18"/><stop offset="1" stop-color="#05180C" stop-opacity="0"/></radialGradient><linearGradient id="cue"><stop stop-color="#866740"/><stop offset=".42" stop-color="#D3B97F"/><stop offset="1" stop-color="#AD8B52"/></linearGradient><radialGradient id="grounded-sphere" cx="35%" cy="29%" r="75%"><stop stop-color="#FFFFFF" stop-opacity=".14"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".015"/><stop offset=".78" stop-color="#162B20" stop-opacity=".08"/><stop offset="1" stop-color="#102319" stop-opacity=".24"/></radialGradient><clipPath id="view"><rect x="20" y="193" width="353" height="500" rx="14"/></clipPath><linearGradient id="room" x2="0" y2="1"><stop stop-color="#0D1C18"/><stop offset="1" stop-color="#253C2F"/></linearGradient><linearGradient id="wood" x2="1" y2="1"><stop stop-color="#73573D"/><stop offset="1" stop-color="#3D3027"/></linearGradient><linearGradient id="felt" x2="0" y2="1"><stop stop-color="#204D40"/><stop offset="1" stop-color="#2A6553"/></linearGradient><linearGradient id="rail" x2="0" y2="1"><stop stop-color="#275444"/><stop offset="1" stop-color="#14382D"/></linearGradient><radialGradient id="sphere" cx="30%" cy="25%"><stop stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".4" stop-color="#FFFFFF" stop-opacity=".02"/><stop offset="1" stop-color="#000000" stop-opacity=".28"/></radialGradient></defs>'''
 (OUT/(name+'.svg')).write_text('<svg xmlns="http://www.w3.org/2000/svg" width="393" height="852" viewBox="0 0 393 852" data-status="design-only-not-implemented">'+defs+body+'</svg>')
# The baseline screen is retained verbatim; the new navigation is an editable overlay.
img=base64.b64encode((ROOT/'docs/design/refinement/aim.png').read_bytes()).decode()
base=f'<image width="393" height="852" href="data:image/png;base64,{img}"/>'
base+=rect(60,47,218,48,'#0E1C19')+text(68,73,'中式八球',18)+text(68,88,'人机练习',11,'#ABBAB0')+rect(148,47,68,44,'#263D30',10,'#6A6047')+text(182,73,'俯视',12,'#D9BD83','middle')
save('FP01-overhead',base)
for name,raised,near,off in [('FP02-aim',False,False,False),('FP03-raised',True,False,False),('FP04-rail',True,True,False),('FP05-offscreen',False,False,True)]:save(name,hud('第一人称')+scene(raised,near,off))
print('Base first-person figures generated')
# A vector detail sheet makes contact and projected shadow footprints reviewable.
normal_detail=scene(detail=True).replace('sphere-','detail-normal-sphere-')
raised_detail=scene(raised=True,detail=True).replace('sphere-','detail-raised-sphere-')
detail=rect(0,0,393,852,'#F7F5EE')+text(24,38,'球与台呢的接触关系',21,'#203D30')+text(24,64,'FP06 · 透视示意，非引擎截图',11,'#64786B')
detail+=text(24,98,'较低视点',14,'#203D30')+f'<svg x="24" y="114" width="345" height="220" viewBox="110 485 173 110">{normal_detail}</svg>'
detail+=text(24,372,'较高视点 · 球位与球径不变',14,'#203D30')+f'<svg x="24" y="388" width="345" height="220" viewBox="110 485 173 110">{raised_detail}</svg>'
for y,label in [(650,'球底接触台呢，不靠下沉球体掩盖间隙。'),(690,'深色接触核心紧贴落地点，外缘柔和散开。'),(730,'阴影随台面透视变化，不是偏移的黑圆。'),(770,'小高光与同向落影共同表达球体质感。')]:detail+=text(24,y,label,12,'#203D30')
save('FP06-contact',detail)
