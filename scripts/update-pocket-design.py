"""Build V1.12 evidence-led design amendments from the committed 3ff5d2e baseline.
Requires reportlab and pypdf. Game assets, physics and configuration are not modified.
"""
import io, json, math, re, subprocess
from pathlib import Path
from xml.etree import ElementTree as ET
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

ROOT=Path(__file__).resolve().parents[1]; DESIGN=ROOT/'docs/design'; VERSION='1.12'
FONT=next(p for p in [Path('/Library/Fonts/Arial Unicode.ttf'),Path('/System/Library/Fonts/Supplemental/Arial Unicode.ttf')] if p.exists())
pdfmetrics.registerFont(TTFont('Design',str(FONT)))
BG='#F7F6F1'; INK='#223D32'; MUTED='#64786B'; FELT='#21584B'; WOOD='#69503A'; RAIL='#163E34'; GOLD='#DEC58D'
# All four dimensions below belong to ONE published model: JOY Q8 Pro.
OUT_W=1540.;OUT_L=2820.;IN_W=1260.;IN_L=2540.;BALL=57.15
BAND_X=(OUT_W-IN_W)/2;BAND_Y=(OUT_L-IN_L)/2
JOY='https://www.joybilliard.com/billiards-table/golden-leg-billiards-tables.html'
BOJUE='https://www.bojuebilliard.com/heyball-pocket-size-why-85-mm-corners-matter/'
PATENT='https://patents.google.com/patent/CN115350466A/zh'
SVG='{http://www.w3.org/2000/svg}'

def baseline(path):return subprocess.check_output(['git','show','3ff5d2e:'+path],cwd=ROOT)
def text(c,x,y,s,size=16,color=INK):
    c.setFillColor(HexColor(color));c.setFont('Design',size);c.drawString(x,y,s)
def lines(c,x,y,s,width,size=15,leading=25):
    for para in s.split('\n'):
        line=''
        for ch in re.findall(r'\d+(?:\.\d+)?|[A-Za-z]+|.',para):
            if pdfmetrics.stringWidth(line+ch,'Design',size)>width and ch not in '。，；、：！？）】':
                text(c,x,y,line,size);y-=leading;line=''
            line+=ch
        if line:text(c,x,y,line,size);y-=leading
    return y
def rect(c,x,y,w,h,color,r=0):
    c.setFillColor(HexColor(color))
    if r:c.roundRect(x,y,w,h,r,fill=1,stroke=0)
    else:c.rect(x,y,w,h,fill=1,stroke=0)
def frame(c,title,subtitle,page):
    rect(c,0,0,1200,900,BG);text(c,48,860,'EIGHT CLUB / UI UX DESIGN',11,MUTED)
    text(c,970,860,'V1.12 / 2026.10.22',11,MUTED);text(c,48,812,title,29)
    lines(c,48,780,subtitle,1100,13,20);text(c,48,22,'专业球房 / 资料核验修订 / 不作为实物加工图',10,MUTED);text(c,1130,22,str(page),11,MUTED)
def line(c,x1,y1,x2,y2,color=MUTED,dash=False):
    c.setStrokeColor(HexColor(color));c.setLineWidth(1);c.setDash(4,3) if dash else c.setDash();c.line(x1,y1,x2,y2);c.setDash()
def dimension(c,x1,y1,x2,y2,label):
    line(c,x1,y1,x2,y2)
    for x,y in [(x1,y1),(x2,y2)]:
        if y1==y2:line(c,x,y-5,x,y+5)
        else:line(c,x-5,y,x+5,y)
    text(c,(x1+x2)/2-40,(y1+y2)/2+9,label,13)

def pocket_shapes(cx,cy,scale):
    """Visual prototype only. Mouth width follows candidate 85/82 mm, rear is unmeasured."""
    iw=IN_W*scale;ih=IN_L*scale
    for sx in [-1,1]:
        for sz in [-1,0,1]:
            width=(85 if sz else 82)*scale
            nx,ny=(sx/math.sqrt(2),sz/math.sqrt(2)) if sz else (sx,0)
            x=cx+sx*iw/2;y=cy+sz*ih/2
            if sz:x-=nx*width/2;y-=ny*width/2
            # Round-ended opening is illustrative; these pixel ratios are not physical parameters.
            local=[(-width/2,0)]+[(width/2*math.sin(a),width*.3+width/2*math.cos(a)) for a in [-math.pi/2+i*math.pi/32 for i in range(33)]]+[(width/2,0)]
            pts=[(x+ny*u+nx*v,y-nx*u+ny*v) for u,v in local]
            yield width,pts

def table(c,cx,cy,outer_h,balls=False):
    s=outer_h/OUT_L;ow=OUT_W*s;iw=IN_W*s;ih=IN_L*s
    rect(c,cx-ow/2,cy-outer_h/2,ow,outer_h,WOOD,8)
    # This narrow green strip is illustrative; its physical width is NOT specified.
    rect(c,cx-iw/2-4,cy-ih/2-4,iw+8,ih+8,RAIL,4)
    rect(c,cx-iw/2,cy-ih/2,iw,ih,FELT)
    for width,pts in pocket_shapes(cx,cy,s):
        c.setFillColor(HexColor('#080E0C'));c.setStrokeColor(HexColor('#503F2E'));c.setLineWidth(max(.3,width*.04))
        p=c.beginPath();p.moveTo(*pts[0])
        for xy in pts[1:]:p.lineTo(*xy)
        p.close();c.drawPath(p,fill=1,stroke=1)
    if balls:
        c.setFillColor(HexColor('#F5F1E6'));c.circle(cx,cy-ih*.24,BALL*s/2,fill=1,stroke=0)
    return s,ow,iw,ih

def appendix_ui():
    out=io.BytesIO();c=canvas.Canvas(out,pagesize=(1200,900));c.setAuthor('Cocos Billiards Design')
    frame(c,'先校准整桌，再绘制袋口','G01 / 整桌比例参考JOY Q8 Pro；视觉原型采用BOJUE候选开口比例。二者不构成同一型号的完整实物复刻。',25)
    s,ow,iw,ih=table(c,290,430,560,True)
    dimension(c,290-ow/2,745,290+ow/2,745,'外宽1540 mm')
    dimension(c,290-iw/2,112,290+iw/2,112,'内宽1260 mm')
    text(c,470,695,'外长2820 / 内长2540 mm',16)
    text(c,560,640,'每侧整体边带约140 mm',23)
    y=lines(c,560,600,'推算：（1540−1260）÷2=140 mm；长边方向亦为（2820−2540）÷2=140 mm。这里只能推出整体边带空间，不能推出库边、石板、皮口各自的尺寸。',570,17,29)
    text(c,560,y-25,'旧图67.4 mm不能约束真实袋洞',21)
    y=lines(c,560,y-62,'撤销用旧UI图稿反推台边并据此压扁袋洞的做法。视觉原型采用85/82 mm候选开口，相对57.15 mm球径约1.49/1.43倍；袋内圆弧仅为视觉示意，不能生成物理边界。',570,17,29)
    lines(c,560,y-25,'球径沿用57.15 mm。以整桌外宽250 px排版，内宽204.55 px、整体边带每侧22.73 px、台面球径9.28 px；整桌外高457.79 px。',570,16,27)
    text(c,560,205,'同比例对照：球径与候选净开口',17)
    c.setFillColor(HexColor('#E8DFCA'));c.circle(600,145,BALL*.9/2,fill=1,stroke=0)
    text(c,565,102,'球57.15 mm',12)
    dimension(c,720,145,720+85*.9,145,'角袋85 mm')
    dimension(c,945,145,945+82*.9,145,'中袋82 mm')
    lines(c,60,75,'整桌尺寸：JOY Q8 Pro。候选净开口：BOJUE 85/82 mm。视觉原型组合不代表某个型号的完整复刻；袋内曲线待核验。',1080,13,22)
    c.showPage()
    frame(c,'中袋构造：分清入口、开孔与皮口','G02 / 结构关系示意，不是JOY Q8 Pro工程图。曲线形状仅用于辨认部件，不量取半径、纵深、支承区或落袋线。',26)
    rect(c,65,325,590,365,WOOD,10);rect(c,65,325,590,180,FELT)
    rect(c,65,485,220,32,RAIL);rect(c,435,485,220,32,RAIL)
    # A qualitative circular slate cutout and flanking jaw curves; no fabricated mm values.
    c.setFillColor(HexColor('#080E0C'));c.circle(360,533,70,fill=1,stroke=0)
    c.setStrokeColor(HexColor(GOLD));c.setLineWidth(8);p=c.beginPath();p.arc(284,457,436,609,0,180);c.drawPath(p)
    c.setStrokeColor(HexColor(RAIL));c.setLineWidth(16)
    for xa,xb in [(255,303),(465,417)]:
        p=c.beginPath();p.moveTo(xa,501);p.curveTo(xa+(xb-xa)*.6,501,xb,510,xb,535);c.drawPath(p)
    line(c,360,603,520,642);text(c,440,657,'皮口 / 承接部件（示意）',14)
    line(c,360,533,550,562);text(c,465,577,'石板圆弧缺口',14,'#F5F1E6')
    line(c,285,501,145,405,GOLD);text(c,90,383,'左右胶边转入袋口',14,'#F5F1E6')
    text(c,710,680,'可确认的结构关系',23)
    y=lines(c,710,638,'胶边入口决定球怎样接触袋角；石板缺口决定失去支承的位置；皮口和下方袋网承接下落的球。三者不是同一条轮廓。',420,17,29)
    text(c,710,y-25,'撤销旧版浅椭圆定稿',21)
    y=lines(c,710,y-63,'18 mm浅弧、55 mm总深、12.4 mm余量全部撤销。旧版12 mm袋角半径和25 mm支承区亦未获实物核验，不再作为实施参数。',420,16,28)
    lines(c,65,235,'结构依据：专利CN115350466A明确石板具有形成袋口的圆弧形缺口；其结构说明不能证明任意椭圆轮廓，更不能直接等同于某个在售型号的精确袋型。',1070,16,27)
    lines(c,65,135,'绘制要求：先按实际整桌比例留出空间，再区分胶边曲线、石板缺口与皮口遮挡。未核验的轮廓用“结构示意 / 待核验”标识；不能用黑色轮廓直接生成碰撞或捕获区域。',1070,16,27)
    c.showPage()
    frame(c,'尺寸证据与实施门槛','G03 / 尺寸出处不可跨品牌拼成同一型号。新增图稿替代V1.10；先完成结构核验再落地游戏几何。',27)
    rows=[('JOY Q8 Pro整桌','2820×1540 mm，内沿2540×1260 mm','厂家公开参数；用于整桌比例'),('JOY产品页袋口','页面列85 mm，未区分角袋与中袋','不能从中推出中袋82 mm'),('BOJUE另一配置','角袋85 mm / 中袋82 mm','跨品牌候选参考；不是JOY实测'),('圆弧缺口与袋角','专利说明与厂家文字支持曲线结构','定性依据；不提供本型号完整轮廓'),('中袋浅椭圆与深度','旧版18 / 55 / 67.4 mm定稿作废','不得作为事实或实现约束'),('袋角半径 / 支承区','旧版12 / 25 mm未获实物核验','从实施配置移除，等待证据')]
    y=710
    for a,b,d in rows:
        rect(c,50,y-66,1100,70,'#EAF0E7' if (710-y)//82%2==0 else BG)
        text(c,65,y-13,a,17);text(c,350,y-13,b,16);text(c,350,y-43,d,14,MUTED);y-=82
    lines(c,60,180,'落地前需同一型号的正俯视袋口参考和尺寸图或测量，明确胶边测量点、石板开孔、皮口与球心失去支承的位置。若只有照片，只能形成标注近似的视觉原型，不能宣称精确物理还原。',1080,16,27)
    lines(c,60,78,'本轮仅修订设计文档与图稿。游戏仍沿用2540×1270 mm台面与旧袋口；不自动替换为1260 mm，也不实现尚未核实的深度。完整证据链接见pocket-geometry-spec.md。',1080,13,22)
    c.showPage();c.save();out.seek(0);return PdfReader(out)

def appendix_product():
    out=io.BytesIO();c=canvas.Canvas(out,pagesize=(595.28,841.89));c.setAuthor('Cocos Billiards Design')
    sections=[('球桌比例与尺寸证据',[
        ('目标','修正袋口与台边的比例错误。先校准整桌，再分别绘制胶边入口、石板缺口和皮口，不通过压扁袋洞迎合旧图稿。'),
        ('同一型号的参考','选JOY Q8 Pro公开尺寸作为整桌视觉参考：外沿2820×1540 mm、内沿2540×1260 mm。居中对称条件下，整体边带每侧约140 mm；这是推算，不能当作胶条宽度。球径沿用57.15 mm。'),
        ('袋口资料不混用','JOY页仅列85 mm，未区分两种袋口。BOJUE的角袋85 / 中袋82 mm属于另一厂家配置，保留为候选资料，不能拼接成JOY型号的完整参数。'),
        ('撤销无依据的定稿','撤销18 mm中袋浅弧、55 mm洞口总深、67.4 mm台边约束及12.4 mm余量。12 mm袋角半径和25 mm支承区也未经实物核验，不再作为实施参数。'),
        ('对玩法的要求','球应通过真实胶边约束后落袋。未失去台面支承时不可提前消失。摆球、辅助线、碰撞与画面必须共享核验后的几何；既有220 ms击球同步及裁判规则保留。')]),
        ('结构核验与实施范围',[
        ('部件边界','胶边曲线控制袋角接触，石板缺口控制失去支承，皮口和袋网承接落球。结构专利能说明圆弧缺口，不能提供某个在售型号的精确加工尺寸。'),
        ('图稿状态','整桌比例按厂家公开内外尺寸校准。局部中袋图为结构示意；其轮廓不标虚构毫米值，也不直接用于碰撞。早期PDF界面图仅说明流程，新图G01/G02说明比例与结构。'),
        ('落地前的证据','取得同一型号袋口俯视资料及尺寸图或测量，明确胶边测量点、开孔轮廓、皮口边缘和失去支承位置。无法精确核验时，仅做明确标注近似的视觉原型。'),
        ('验证要求','分别验证六袋正向、擦袋角、沿库与斜角、袋前不提前消失、白球落袋犯规、非法摆球及辅助线一致性。逻辑、Creator/浏览器与手机结果分别记录。'),
        ('当前交付','产品、UI/UX、可编辑图稿、manifest和技术方案同步到V1.12。游戏代码未改，仍使用原台面及旧袋口；设计参考型号不自动改变当前游戏尺寸。')])]
    for page,(title,items) in enumerate(sections,8):
        rect(c,0,0,596,842,BG);text(c,42,802,'EIGHT CLUB / PRODUCT DESIGN',10,MUTED);text(c,42,755,title,24)
        text(c,42,724,'V1.12 / 2026-10-22 / 资料核验修订',11,MUTED);y=674
        for a,b in items:text(c,42,y,a,15);y=lines(c,42,y-27,b,510,12,21)-22
        text(c,42,28,'专业球房 / V1.12 / 整桌比例已校准，袋型仍需核验',8.5,MUTED);text(c,542,28,str(page),10);c.showPage()
    c.save();out.seek(0);return PdfReader(out)

# A renderer-independent SVG reference: full table dimensions and readable candidate mouth proportions.
def svg_table(cx,cy,outer_h):
    s=outer_h/OUT_L;ow=OUT_W*s;iw=IN_W*s;ih=IN_L*s
    a=[f'<g data-table-reference="JOY Q8 Pro" data-pocket-status="candidate-mouth-width-unverified-rear-profile">',f'<rect x="{cx-ow/2}" y="{cy-outer_h/2}" width="{ow}" height="{outer_h}" rx="8" fill="{WOOD}"/>',f'<rect x="{cx-iw/2-3}" y="{cy-ih/2-3}" width="{iw+6}" height="{ih+6}" rx="3" fill="{RAIL}"/>',f'<rect x="{cx-iw/2}" y="{cy-ih/2}" width="{iw}" height="{ih}" fill="{FELT}"/>']
    for width,pts in pocket_shapes(cx,cy,s):
        a.append('<path data-role="pocket-visual-prototype" d="M '+' L '.join(f'{x:.5f},{y:.5f}' for x,y in pts)+' Z" fill="#080E0C" stroke="#503F2E" stroke-width="'+str(max(.3,width*.04))+'"/>')
    return ''.join(a)+'</g>',s,iw,ih

def update_screens():
    ET.register_namespace('',SVG[1:-1]);count=0
    for p in (DESIGN/'screens').glob('S*.svg'):
        root=ET.fromstring(baseline(str(p.relative_to(ROOT))));cs=list(root)
        start=next((i for i,e in enumerate(cs) if e.attrib.get('fill')=='#07110D' and e.tag==SVG+'rect'),None)
        if start is None:continue
        wood=cs[start+1];x=float(wood.attrib['x']);y=float(wood.attrib['y']);w=float(wood.attrib['width']);h=float(wood.attrib['height']);cx=x+w/2;cy=y+h/2
        pockets=[i for i,e in enumerate(cs) if i>start and e.attrib.get('fill')=='#050907' and e.tag==SVG+'circle']
        end=pockets[-1]+1
        oldbed=next(e for e in cs[start:end] if e.attrib.get('fill')==FELT);oldw=float(oldbed.attrib['width'])
        # Keep the table's allocated height. Recalculate outer width and inner rectangle.
        markup,s,iw,ih=svg_table(cx,cy,h);group=ET.fromstring(markup)
        for e in cs[start:end]:root.remove(e)
        root.insert(start,group)
        # Existing ball/cue positions are composition examples: fit uniformly into the corrected bed.
        # Stop before the next UI block/overlay; never scale the bottom controls or dialogs.
        children=list(root);at=start+1;payload=[]
        while at<len(children):
            e=children[at];attrs=e.attrib;tag=e.tag.split('}')[-1]
            outside=False
            if tag in ['rect','text']:
                ey=float(attrs.get('y',cy));ew=float(attrs.get('width',0));outside=ey>y+h+2 or ew>w*1.3
            if outside:break
            payload.append(e);at+=1
        if payload:
            k=iw/oldw;g=ET.Element(SVG+'g',{'transform':f'translate({cx*(1-k)} {cy*(1-k)}) scale({k})','data-role':'state-composition-not-metrology'})
            j=0
            while j<len(payload):
                e=payload[j]
                if e.tag==SVG+'circle' and e.attrib.get('fill')=='#09261B' and j+1<len(payload):
                    body=payload[j+1];bx=float(body.attrib.get('cx',cx));by=float(body.attrib.get('cy',cy));r=float(body.attrib.get('r',0))
                    last=j+1
                    while last<len(payload) and not(payload[last].tag==SVG+'circle' and payload[last].attrib.get('fill')=='#FFFFFF'):last+=1
                    if r>0 and last<len(payload):
                        f=BALL*s/(2*k*r);ballgroup=ET.Element(SVG+'g',{'transform':f'translate({bx*(1-f)} {by*(1-f)}) scale({f})','data-role':'physical-ball-scale'})
                        for member in payload[j:last+1]:root.remove(member);ballgroup.append(member)
                        g.append(ballgroup);j=last+1;continue
                root.remove(e);g.append(e);j+=1
            root.insert(start+1,g)
        root.set('data-design-version',VERSION);root.set('data-pocket-profile','not-finalized')
        p.write_text(ET.tostring(root,encoding='unicode'));count+=1
    return count

def editable_plates():
    markup,s,iw,ih=svg_table(275,455,560)
    template=f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="{BG}"/>'+markup
    def t(x,y,value,size=20):return f'<text x="{x}" y="{y}" font-family="Arial Unicode MS,PingFang SC,Arial,sans-serif" font-size="{size}" fill="{INK}">{value}</text>'
    template+=t(48,70,'G01 · 整桌比例校准 / V1.12',30)+t(500,220,'JOY Q8 Pro：外沿2820×1540 mm',25)+t(500,265,'同一型号内沿2540×1260 mm',25)+t(500,330,'每侧整体边带约140 mm：推算，非胶条宽度',20)+t(500,395,'视觉原型开口约1.5球径，袋内曲线仅为示意',19)+t(500,455,'撤销旧浅弧与深度定稿；不从旧UI反推实物',19)+t(500,520,'BOJUE候选开口＋JOY整桌比例：不是型号复刻',19)+t(500,585,'精确中袋轮廓、皮口、支承区：待同型号核验',19)+t(48,820,'来源与状态见 pocket-geometry-spec.md；本图不用于生成物理参数。',17)+'</svg>'
    (DESIGN/'screens/G01-袋口同比例规范.svg').write_text(template)
    # Qualitative layer diagram: intentionally no manufactured radius/depth values.
    svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="{BG}"/>'+t(48,70,'G02 · 中袋构造关系 / V1.12',30)
    svg+=f'<rect x="90" y="230" width="600" height="370" rx="12" fill="{WOOD}"/><rect x="90" y="415" width="600" height="185" fill="{FELT}"/><circle cx="390" cy="380" r="74" fill="#080E0C"/><path d="M 310 380 A 80 80 0 0 1 470 380" fill="none" stroke="{GOLD}" stroke-width="8"/><path d="M 90 415 H 310 Q 335 415 335 390 M 445 390 Q 445 415 470 415 H 690" fill="none" stroke="{RAIL}" stroke-width="18"/>'
    svg+=t(750,260,'胶边入口',23)+t(750,315,'石板圆弧缺口',23)+t(750,370,'皮口与下方袋网',23)+t(750,445,'轮廓未按同型号尺寸核验',19)+t(750,490,'不量取半径、纵深或落袋线',19)+t(90,690,'结构依据：CN115350466A。此图只区分部件，不是JOY Q8 Pro加工图。',19)+t(90,745,'18 mm浅弧、55 mm总深及旧12/25 mm参数均不再作为实施依据。',19)+'</svg>'
    (DESIGN/'screens/G02-中袋结构关系.svg').write_text(svg)


def patch_pdf_tables(page):
    raw=page.get_contents().get_data().decode('latin1')
    def blocks(color):
        return list(re.finditer(r'q\s+'+re.escape(color)+r' rg(?:(?!\n[qQ]\n)[\s\S])*?\nQ',raw))
    mouths=blocks('.031373 .054902 .047059')
    bottoms=blocks('.019608 .035294 .027451')
    starts=blocks('.027451 .066667 .05098')
    replacements=[]
    for start in starts:
        end_limit=next((b.start() for b in starts if b.start()>start.start()),len(raw))
        ms=[b for b in mouths if start.start()<b.start()<end_limit][:6]
        bs=[b for b in bottoms if start.start()<b.start()<end_limit][:6]
        if len(ms)!=6 or len(bs)!=6:continue
        coords=[]
        for b in ms:
            m=re.search(r'\bn\s+([\d.]+) ([\d.]+) m\s+([\s\S]*?)\nf\*',b.group())
            if not m:continue
            nums=[float(v) for v in re.findall(r'-?[\d.]+',m.group(3))]
            if len(nums)!=24:continue
            coords.append((nums[4],float(m.group(2))))
        if len(coords)!=6:continue
        left=min(x for x,y in coords);right=max(x for x,y in coords);top=max(y for x,y in coords);bottom=min(y for x,y in coords)
        if abs((top-bottom)/(right-left)-2)>.02:continue
        buf=io.BytesIO();c=canvas.Canvas(buf,pagesize=(float(page.mediabox.width),float(page.mediabox.height)))
        table(c,(left+right)/2,(top+bottom)/2,(top-bottom)*476/452)
        c.save();buf.seek(0);code=PdfReader(buf).pages[0].get_contents().get_data().decode('latin1')
        replacements.append((start.start(),bs[-1].end(),code))
        ball_shadows=[b for b in blocks('.035294 .14902 .105882') if bs[-1].end()<b.start()<end_limit]
        whites=blocks('1 1 1')
        ball_scale=(top-bottom)*476/452/OUT_L
        for shadow in ball_shadows:
            sm=re.search(r'\bn\s+([\d.]+) ([\d.]+) m\s+([\s\S]*?)\nf\*',shadow.group())
            if not sm:continue
            nums=[float(v) for v in re.findall(r'-?[\d.]+',sm.group(3))]
            if len(nums)!=24:continue
            bx=nums[4];by=float(sm.group(2));r=float(sm.group(1))-bx
            if not(left<=bx<=right and bottom<=by<=top):continue
            highlight=next((b for b in whites if b.start()>shadow.end()),None)
            if not highlight:continue
            next_shadow=next((b for b in ball_shadows if b.start()>shadow.start()),None)
            if next_shadow and highlight.start()>next_shadow.start():continue
            # The body immediately follows the shadow; use its exact centre.
            body=re.search(r'\bn\s+[\d.]+ ([\d.]+) m\s+([\s\S]*?)\nf\*',raw[shadow.end():highlight.start()])
            if not body:continue
            ns=[float(v) for v in re.findall(r'-?[\d.]+',body.group(2))]
            if len(ns)<6:continue
            bx=ns[4];by=float(body.group(1));factor=BALL*ball_scale/(2*r)
            wrapped=f'q\n{factor} 0 0 {factor} {bx*(1-factor)} {by*(1-factor)} cm\n'+raw[shadow.start():highlight.end()]+'\nQ'
            replacements.append((shadow.start(),highlight.end(),wrapped))
    for a,b,code in sorted(replacements,reverse=True):raw=raw[:a]+code+raw[b:]
    return raw.encode('latin1')

def update_pdf(name,base_count,appendix,is_ui):
    r=PdfReader(io.BytesIO(baseline('docs/design/'+name)));w=PdfWriter()
    for p in r.pages[:base_count]:
        data=patch_pdf_tables(p) if is_ui else p.get_contents().get_data()
        stream=DecodedStreamObject();stream.set_data(data.replace(b'V1.9',b'V1.12').replace(b'2026.10.21',b'2026.10.22'));p[NameObject('/Contents')]=stream
        buf=io.BytesIO();c=canvas.Canvas(buf,pagesize=(float(p.mediabox.width),float(p.mediabox.height)))
        if is_ui:
            rect(c,280,8,800,27,BG);text(c,290,21,'V1.12：旧球桌图仅说明流程；旧袋型参数停用。整桌比例与结构以25–27页为准。',10,MUTED)
        else:
            rect(c,40,18,475,22,BG);text(c,42,28,'专业球房 / V1.12 / 撤销旧浅弧定稿；修订见8–9页',8.5,MUTED)
        c.save();buf.seek(0);p.merge_page(PdfReader(buf).pages[0]);w.add_page(p)
    for p in appendix.pages:w.add_page(p)
    for p in w.pages:p.compress_content_streams()
    w.add_metadata({'/Title':name[:-4]+' V1.12','/Author':'Cocos Billiards Design','/Subject':'Evidence review: table proportions and pocket structure; profile not finalized'})
    with open(DESIGN/name,'wb') as f:w.write(f)
    print(name,len(w.pages),'pages')

if __name__=='__main__':
    editable_plates();print('Editable screens calibrated:',update_screens())
    update_pdf('中式八球产品设计方案.pdf',7,appendix_product(),False)
    update_pdf('中式八球UIUX设计方案.pdf',24,appendix_ui(),True)
    p=DESIGN/'design-manifest.json';m=json.loads(p.read_text());m['version']=VERSION
    m['pocketGeometry']={'status':'whole-table proportions calibrated; exact pocket profile not finalized; runtime unchanged','ballDiameterMm':BALL,'tableReference':{'model':'JOY Q8 Pro','outerMm':[OUT_L,OUT_W],'innerMm':[IN_L,IN_W],'overallBorderInferredMm':140,'borderInference':'symmetric centred layout; not cushion-only width','source':JOY},'crossBrandCandidate':{'brand':'BOJUE','cornerMouthMm':85,'sideMouthMm':82,'status':'not verified for JOY; do not merge as one model','source':BOJUE},'visualPrototype':{'mouthSource':'BOJUE cross-brand candidate','cornerMouthToBallRatio':85/BALL,'sideMouthToBallRatio':82/BALL,'rearProfile':'round-ended illustrative path; not measured geometry','physicsUse':False},'exactGeometry':{'sideBackArcDepthMm':None,'sideTotalDepthMm':None,'jawRadiusMm':None,'shelfDepthMm':None,'slateCutProfile':None,'dropBoundary':None},'withdrawnV110':['18 mm shallow elliptical back','55 mm total depth','67.4 mm frame as real constraint','12.4 mm margin','12 mm jaw radius as implementation parameter','25 mm shelf as implementation parameter'],'structureSource':PATENT,'spec':'pocket-geometry-spec.md','uiuxPages':[25,26,27],'productPages':[8,9]}
    p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
