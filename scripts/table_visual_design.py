"""Authored UI/UX table studies. Dimensions and visual fitting are explicitly labelled."""
import math
import json
from pathlib import Path
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape

JOY = 'https://www.joybilliard.com/billiards-table/golden-leg-billiards-tables.html'
TENGBO = 'https://www.shtengbo.com/proxq.aspx?ID=7'
PAPER = '#F7F5EE'
DARK = '#203D30'
MUTED = '#607466'
GOLD = '#B38D51'
FELT = '#285D4C'
WOOD = '#654936'
LEATHER = '#4B342A'


def label(a, x, y, text, target, align='start', color=DARK):
    a.text(x, y, text, 14, color, align)
    end = x - 8 if align == 'end' else x + 8
    a.line(end, y + 8, target[0], target[1], MUTED, .8)
    a.circle(*target, 3, GOLD)


def note(a, b, x, y, title, text, width=500):
    a.design_notes = getattr(a, 'design_notes', []) + [(title, text)]
    return b['paragraph'](a, x, y, title, text, width, 13, 18, 22)


def dimension(a, p, q, text, offset=0):
    x,y=p; xx,yy=q
    a.line(x,y+offset,xx,yy+offset,GOLD,1)
    for u,v in [(x,y),(xx,yy)]:
        a.line(u,v+offset-5,u,v+offset+5,GOLD,1)
    a.text((x+xx)/2,(y+yy)/2+offset-10,text,12,DARK,'middle')


def cubic_points(start, control1, control2, end, steps=64):
    points = []
    for index in range(steps + 1):
        t = index / steps
        points.append(tuple((1-t)**3*start[axis]+3*(1-t)**2*t*control1[axis]+3*(1-t)*t*t*control2[axis]+t**3*end[axis] for axis in range(2)))
    return points


def rounded_pocket(kind, mouth):
    """Visual study in pocket-local coordinates. Curve dimensions await calibration."""
    half = mouth / 2
    if kind == 'corner':
        start = (-half-.0225, -.045)
        control1 = (start[0]+.020, -.025)
        control2 = (-half, -.006)
        approach = [(-.20, -.18), start]
        outer = [(-.075, .018), (-.20, -.107)]
    else:
        start = (-half-.034, -.014)
        control1 = (-half-.012, -.014)
        control2 = (-half, -.004)
        approach = [(-.20, -.014), start]
        outer = [(-.075, .06), (-.20, .06)]
    end = (-half, .018)
    curve = cubic_points(start, control1, control2, end)
    left_edge = approach[:-1] + curve
    left = left_edge + outer
    right = [(-u,v) for u,v in left]
    back = [(-half*math.cos(i*math.pi/64), .018+half*math.sin(i*math.pi/64)) for i in range(65)]
    front = [(half*math.cos(i*math.pi/64), .018-.026*math.sin(i*math.pi/64)) for i in range(1,65)]
    return {'left':left, 'right':right, 'leftEdge':left_edge,
            'rightEdge':[(-u,v) for u,v in left_edge], 'curve':curve,
            'opening':back+front, 'back':back, 'start':start, 'end':end,
            'tangent1':(control1[0]-start[0], control1[1]-start[1]),
            'tangent2':(end[0]-control2[0], end[1]-control2[1])}


def draw_pocket(a, profile, project):
    for side in ['left','right']:
        a.poly([project(u,v) for u,v in profile[side]],'#32624F')
    a.poly([project(u,v) for u,v in profile['opening']],'#0B1A13')
    for color,width in [('#9B7850',8),(LEATHER,5)]:
        for q,r in zip(profile['back'],profile['back'][1:]):
            a.line(*project(*q),*project(*r),color,width)
    for edge in ['leftEdge','rightEdge']:
        for q,r in zip(profile[edge],profile[edge][1:]):
            a.line(*project(*q),*project(*r),'#638C6B',1.3)


def render_image(a, filename, x=64, y=145, width=1072, height=570, cover=False):
    path=Path(__file__).resolve().parents[1]/'docs/design/table-model'/filename
    image=ImageReader(str(path));iw,ih=image.getSize()
    scale=(max if cover else min)(width/iw,height/ih);w,h=iw*scale,ih*scale
    left,top=x+(width-w)/2,y+(height-h)/2
    a.rect(x,y,width,height,'#191E18',14)
    with a.clip_poly([(x,y),(x+width,y),(x+width,y+height),(x,y+height)]):
        a.c.drawImage(image,left,a.h-top-h,width=w,height=h,mask='auto')
        a.svg.append(f'<image href="../table-model/{escape(filename)}" x="{left}" y="{top}" width="{w}" height="{h}"/>')


def table_study(a,b):
    render_image(a,'overview.png')
    note(a,b,64,749,'T01 已确认整桌造型','本图由V8统一Blender模型渲染。外廓2820×1540×850mm，台面2540×1260mm，六袋六腿。桌裙、木帮、皮口与圆腿按该模型执行。',516)
    note(a,b,620,749,'确认与实施状态','2026-11-08用户确认V8模型。游戏接入待实施；Cocos材质、遮挡、触摸兼容和性能需单独验收。早期AI概念图归入探索记录。',516)


def aiming_render(a,b):
    render_image(a,'aiming.png')
    note(a,b,64,749,'T09 V8低位形态','与T01使用同一模型和光照，检查台呢、鼻口、木帮与球径的关系。白球为57.15mm比例参照。游戏相机和球杆沿实际对局参数驱动。',516)
    note(a,b,620,749,'游戏接入验收','在母球后方、贴长库、贴短库和角袋附近复核遮挡。镜头观察与瞄准参数分离，实际击球仍由220ms触球帧提交。',516)


def pocket_render(a,b):
    render_image(a,'corner.png',64,158,526,500)
    render_image(a,'side.png',610,158,526,500)
    a.text(327,691,'角袋',16,DARK,'middle')
    a.text(873,691,'中袋',16,DARK,'middle')
    note(a,b,64,749,'T10 V8袋口近景','皮口具有厚度和封闭端面，袋壁与台呢切面分离，内沿接缝闭合。胶边在急弯处保持完整，外片贴合木桌裙。',516)
    note(a,b,620,749,'几何完成标准','六袋无三角破面、闪烁条纹、透底、悬空皮片或皮口与胶边的可见接缝。角85/中82mm为候选净口，造型确认与厂家测量分开记录。',516)


def leg_render(a,b):
    render_image(a,'leg-profile.png',64,152,390,552,cover=True)
    render_image(a,'legs.png',474,152,662,552)
    note(a,b,64,744,'T11 桌腿轮廓','左图为桌裙以下可见部分的正交图，右图为同一模型近景。连接段露出85mm，主体400mm、最粗166mm，最粗处离地410mm，主体两侧连续外凸。',516)
    note(a,b,620,744,'分段与比例','上部连接段150×150mm，环形收口独立可辨。底部为92mm木脚座及薄型接地垫。14处相对宽度按确认稿检查，误差限为最大宽度的4%。',516)


def model_specification(a,b):
    rows=[
        ['基准文件','table-model/chinese-pool-table.blend / .glb','sketch-matched-legs-v8'],
        ['外廓 / 台面','2820×1540×850 / 2540×1260mm','公开整体比例参考'],
        ['桌腿主体','离地75至475mm / 最粗166mm','最粗处410mm，设计拟合'],
        ['连接段 / 脚座','150×150×160mm / 直径92×高25mm','桌裙以下露出85mm'],
        ['木帮 / 皮口','木面宽95mm / 皮革厚3mm','模型造型拟合'],
        ['材质','哑光胡桃木腿、木脚座、深棕皮口','CC0木纹，见材质署名'],
        ['当前验收','几何专项、278项Node及模型浏览器','Cocos游戏接入待实施'],
    ]
    b['table'](a,64,162,1072,['项目','执行规范','状态与依据'],rows,[1,2.4,1.6],56,13)
    note(a,b,64,646,'T12 版本边界','V8原始GLB约19.4万三角形、173个网格实例，是已确认的高保真评审母版。移动端派生资源需要合批、纹理与细节层次优化，并与母版对照验收。',1072)
    note(a,b,64,758,'文档与资源追溯','模型参数见table-model/model-spec.json，校验与SHA256见model-validation.json；游戏接入步骤及验收标准见技术方案table-model-integration.md。',1072)


def rail_section(a,b):
    a.rect(64,156,1072,490,'#E9EDE4',18)
    a.text(84,190,'局部剖面概念 · 台面一侧在左，木扶手一侧在右',13,MUTED)
    a.rect(110,458,870,9,FELT)
    a.rect(110,467,870,42,'#879083')
    a.rect(110,509,870,80,'#46372C')
    profile=[(318,389),(320,381),(329,372),(350,362),(383,351),(446,341),(520,337),(590,339),(590,458),(365,458),(356,427),(342,408),(326,399)]
    a.poly(profile,'#3C6E55')
    a.poly([(370,425),(590,375),(590,458),(365,458)],'#244631')
    a.poly([(590,338),(616,333),(939,333),(954,342),(954,456),(590,456)],WOOD)
    a.line(617,337,935,337,'#B39266',2)
    a.line(599,450,947,450,'#37291F',1.5)
    for x in range(624,940,15):
        a.line(x,349,x+4,433,'#7F5C40',.5,alpha=.3)
    for q,r in zip(profile[:9],profile[1:9]):
        a.line(*q,*r,'#6B9373',3)
    b['ball2'](a,260,400,57.15,0)
    a.line(167,342.85,167,457.15,GOLD,1)
    a.line(162,342.85,172,342.85,GOLD,1)
    a.line(162,457.15,172,457.15,GOLD,1)
    a.text(156,409,'57.15mm',12,DARK,'end')
    label(a,140,264,'圆润鼻口与连续包布',(320,389))
    label(a,610,263,'库边上表面的截面变化',(450,343))
    label(a,1050,300,'独立木扶手与倒角',(915,336),'end')
    label(a,1050,615,'石板承托与桌裙层次',(815,504),'end')
    a.text(84,625,'鼻口高度、截面倾角、包布厚度和倒角半径待同型号资料校准',12,MUTED)
    note(a,b,64,689,'T02 造型要求','台呢从库边上表面连续包向圆润鼻口。接触边缘、上部轮廓和外侧木扶手各有可辨认的转折，低机位呈现柔和的体积变化。',516)
    note(a,b,620,689,'参数标识','球径沿用项目57.15mm。剖面用于表达部件关系，各层高度与支承结构均为拟合示意。厂商参数核验完成后，再替换为可量取剖面。',516)


def pocket_plans(a,b):
    pockets=b['GEO']['pockets']
    for index,(pocket,title,candidate) in enumerate([(pockets[0],'角袋 · 斜向进入','85mm'),(pockets[1],'中袋 · 两段长库之间','82mm')]):
        left=64+index*552
        cx=left+260
        a.rect(left,156,520,526,'#E9EDE4',18)
        a.text(left+20,189,title,18,DARK)
        scale=2600;cy=389
        def local(q):
            x=q['x']-pocket['lip']['x'];z=q['z']-pocket['lip']['z']
            return x*pocket['tangent']['x']+z*pocket['tangent']['z'],x*pocket['normal']['x']+z*pocket['normal']['z']
        def p(u,v):return cx+u*scale,cy-v*scale
        a.rect(left+20,216,480,235,WOOD,10)
        a.rect(left+20,389,480,212,FELT)
        profile=rounded_pocket(pocket['kind'],pocket['mouth'])
        with a.clip_poly([(left+20,216),(left+500,216),(left+500,601),(left+20,601)]):
            # The felt shelf and the slate opening have separate silhouettes.
            a.rect(left+20,342,480,259,FELT)
            draw_pocket(a,profile,p)
        xx,yy=p(0,-.061)
        b['ball2'](a,xx,yy,.028575*scale,0)
        a.line(cx,586,cx,444,'#D9BD83',1,'5 5')
        for side in [-1,1]:
            x=cx+side*pocket['mouth']*scale/2
            a.line(x,342.2,x,650,'#9DAA96',.6,'3 5')
        a.line(cx-pocket['mouth']*scale/2,342.2,cx+pocket['mouth']*scale/2,342.2,'#D9BD83',.8,'4 4')
        dimension(a,(cx-pocket['mouth']*scale/2,650),(cx+pocket['mouth']*scale/2,650),'候选净宽 '+candidate)
        a.text(cx,670,'同一比例 · 球径57.15mm',11,MUTED,'middle')
    note(a,b,64,722,'T03 两类袋口分别定义','角袋的直库沿桌角转入，中袋连接左右两段长库。直库与袋内侧采用相切曲线连接，转弯位置连续变化。台呢承托区、石板开口与皮口各有独立轮廓。局部放大和相切要求见T08。',516)
    note(a,b,620,722,'资料置信度','JOY页面仅列85mm袋口参数，角/中袋的分别口径与测量基准待核验。85/82mm用于比较现有候选比例，袋喉和石板缺口继续列为待校准。',516)


def fall_frames(a,b):
    for i,(time,cx,cy) in enumerate([(0,112,282),(80,134,308),(160,150,384),(240,157,512)]):
        left=64+i*272
        a.rect(left,167,256,423,'#E9EDE4',15)
        a.text(left+18,201,f'{time}ms',20,DARK)
        a.text(left+18,226,['进入开口','向内下沉','袋内遮挡','沉入暗部'][i],13,MUTED)
        with a.clip_poly([(left+14,244),(left+242,244),(left+242,550),(left+14,550)]):
            a.rect(left+14,320,228,230,'#14281E')
            a.rect(left+209,302,26,160,LEATHER)
            a.circle(left+cx,cy,36,'#D3A32B')
            a.circle(left+cx,cy,18,'#FCF9F0')
            a.text(left+cx,cy+8,'1',26,DARK,'middle',True)
            a.ellipse(left+cx-10,cy-14,7,4,'#FFFFFF',alpha=.3)
            a.rect(left+14,320,98,150,WOOD)
            a.rect(left+14,316,98,8,FELT)
            a.line(left+112,322,left+112,410,'#78907B',1)
            a.rect(left+112,442,123,108,'#09150F')
            a.line(left+112,442,left+232,442,'#2A392C',1)
        a.text(left+18,569,['球体完整可见','球体尺寸保持','球体降到台面以下','遮挡后再移除'][i],12,DARK)
    note(a,b,64,645,'T04 袋内空间与时序','袋口由包布转角、皮口、袋壁、暗部与向下集球通道组成。剖切图用于观察遮挡顺序。约320ms为视觉调校值，评审时按正常速度与逐帧两种方式检查。',516)
    note(a,b,620,645,'状态衔接','球体保持原尺寸，滚动并下沉；完全被遮挡后再移除。最后一颗球完成下落后切换回合或显示结果。暂停冻结，重开清空下落表现。',516)
    a.text(64,817,'示意帧以支承丢失为0ms；完整袋内碰撞、弹袋和网兜形变列入后续物理范围。',12,MUTED)


def materials(a,b):
    render_image(a,'wood.png',64,158,526,500)
    render_image(a,'skirt.png',610,158,526,500)
    a.text(327,691,'木帮与顺纹UV',16,DARK,'middle')
    a.text(873,691,'皮口外片与桌裙贴合',16,DARK,'middle')
    note(a,b,64,749,'T05 材质基准','V8采用Poly Haven的CC0胡桃木扫描贴图。木帮基材粗糙度0.25、漆层权重0.28，腿身和木脚座采用粗糙度0.34的较哑光表面。纹理和署名随派生资源保留。',516)
    note(a,b,620,749,'表面与灯光迁移','深棕皮口保持厚度、缝线和柔和边缘，台呢保持细密低反光。Creator固定曝光下逐项对照母版，颜色和光泽由实际画面复核。',516)


PAGES=[
('T01','已确认整桌造型','V8统一模型渲染 · 2026-11-08用户确认 · 游戏接入待实施。',table_study),
('T02','库边剖面与包布','圆润鼻口、上表面截面变化、木扶手与承托层共同定义低视角形态。',rail_section),
('T03','角袋与中袋的部件关系','两类入口分别研究，净口、皮口外沿与袋内空间分别标注。',pocket_plans),
('T04','进袋下落与空间遮挡','球体进入袋内、连续下沉并被实体遮挡，随后完成本杆结算。',fall_frames),
('T05','材质、灯光与落地感','V8实际模型材质近景，木纹、皮口与桌裙使用同一母版。',materials),
]

PARAMETERS=[
['整桌 / 台面','2820×1540×850 / 2540×1260mm','JOY公开型号数据 [S1]'],
['整体边带','对称布置时约140mm','由内外尺寸推算，涵盖多个结构层'],
['球体比例','球径57.15mm','沿用本项目比例参照'],
['袋口净宽','现有候选角85 / 中82mm','S1仅列85mm，分别口径与测法待核验'],
['库边截面','鼻口高34mm / 木面宽95mm','V8造型拟合，实物测量待核验'],
['袋内结构','皮革厚3mm / 下落空间185mm','V8造型拟合，完整袋内物理待实施'],
['桌体与材质','胡桃木桌裙、车枳圆腿与木脚座','V8已确认，毫米数为游戏造型拟合'],
]
ACCEPTANCE=[
('V01 比例','整桌与台面按T06尺寸检查模型包围范围；球径57.15mm。T03两图使用同一比例。约140mm只描述整体边带。'),
('V02 低位形态','在母球后方低位、贴长库、贴短库和角袋附近四类机位，各能辨认鼻口、包布与木扶手；转折连续且无硬直绿墙。'),
('V03 袋口连续','六袋的高位与低位共12组画面；直库、圆弧袋角与袋内侧相切连接，放大400%时轮廓连续。台呢转角、皮口、木扶手和袋内空间连接完整，无透底、悬空接缝或可见支撑穿过入口。'),
('V04 下落与状态','六袋各检查慢速和高速进球；连续帧中球体尺寸保持，下沉后经实体遮挡再移除。最后一球落白和黑8结果需完成下落再切换；暂停冻结，重开清空。'),
('V05 材质与镜头','T01高位、母球后低位、角袋和中袋特写四张样板使用同一光照；布、木、皮、金属可辨。绕台与拉远时桌体、桌腿和地面阴影连续呈现。'),
]


def rounded_jaw_detail(a,b):
    a.rect(64,156,660,520,'#E9EDE4',18)
    profile=rounded_pocket('corner',.085)
    def project(u,v):
        return 450+(u+.055)*5200,450-v*3300
    with a.clip_poly([(84,180),(704,180),(704,650),(84,650)]):
        a.rect(84,180,620,470,WOOD)
        a.rect(84,391,620,259,FELT)
        draw_pocket(a,profile,project)
        for q,r in zip(profile['curve'],profile['curve'][1:]):
            a.line(*project(*q),*project(*r),'#D9BD83',3)
        for point,tangent in [(profile['start'],profile['tangent1']),(profile['end'],profile['tangent2'])]:
            x,y=project(*point)
            dx,dv=tangent
            length=math.hypot(dx*5200,dv*3300)
            tx,tz=dx*5200/length,-dv*3300/length
            a.line(x-tx*63,y-tz*63,x+tx*75,y+tz*75,'#D9BD83',1,'5 4')
            a.circle(x,y,5,'#D9BD83',DARK,lw=.8)
    label(a,94,269,'袋内侧相切连接',project(*profile['end']),color='#F4F0E6')
    label(a,94,561,'直库相切连接',project(*profile['start']),color='#F4F0E6')
    note(a,b,764,184,'01 平面袋角','金色曲线标示平面内的转弯。直库、曲线和袋内侧各自的切线方向在连接点对齐。',360)
    note(a,b,764,300,'02 台呢包覆','布面沿圆润的立体鼻口连续包覆。平面转弯与鼻口剖面共同形成实际看到的袋角。',360)
    note(a,b,764,416,'03 台呢承托与开口','台呢承托区延伸到袋沿，深色石板开口位于其后。皮口沿外侧包边，层次分别可辨。',360)
    note(a,b,764,532,'曲率拟合状态','本图表达相切方向与圆滑转弯。曲线半径、袋喉和石板缺口的具体尺寸待同型号资料校准。',360)
    note(a,b,64,718,'T08 评审要求','分别放大角袋与中袋轮廓至400%，检查直库转入曲线以及曲线转入袋内侧的两个连接点。轮廓位置连续、切线方向一致，台呢包覆和皮口收边同步圆滑。',660)
    a.text(764,727,'S3 KNBB中式台球公开实拍',14,DARK)
    a.text(764,752,'作为圆润袋角的同类形态参考',12,MUTED)
    a.text(764,776,'点击标题打开来源',11,MUTED)
    a.c.linkURL('https://www.knbb.nl/chinese-pool-komt-naar-nederland/',(764,900-785,1125,900-705),relative=0)


def append_table_pages(c,frame,b,root,page):
    Art=b['Art'];out=root/'docs/design/table-studies';out.mkdir(exist_ok=True)
    md=['## 球桌造型规范 V2.4\n\n2026-11-08。执行V8已确认模型。T01/T09/T10/T11为该模型的实际渲染，T12为参数与交付规范。T02-T08中的结构示意用于解释部件关系，具体轮廓与材质以V8模型为准。前四张图用于说明布局与手势。\n']
    figures=[]
    for ident,title,sub,draw in PAGES:
        page+=1;a=frame(c,1200,900,ident+' '+title,sub+(' 结构示意，轮廓与尺寸以V8模型为准。' if ident in ('T02','T03','T04') else ''),page)
        draw(a,b);name=ident.lower()
        a.save(out/(name+'.svg'));c.showPage()
        figures.append({'name':ident,'title':title,'page':page,'source':f'table-studies/{name}.svg','render':f'table-studies/{name}.png'})
        md.append(f'### {ident} {title}\n\n{sub}\n\n![{title}](table-studies/{name}.png)\n')
        for heading,body in getattr(a, 'design_notes', []):
            md.append('#### '+heading+'\n\n'+body+'\n')
    page+=1;a=frame(c,1200,900,'T06 参数、来源与待校准项','公开型号数据、推算和视觉拟合均在本页标明。',page)
    b['table'](a,64,164,1072,['项目','当前规范','依据 / 状态'],PARAMETERS,[1,1.7,2],56,13)
    a.text(64,650,'S1  JOY Q8 Pro 产品参数',15,DARK)
    a.text(64,675,'公开整桌、台面尺寸及铜与牛皮袋口；页面未分别定义角袋与中袋净口。',12,MUTED)
    a.text(64,714,'S2  腾勃 G800Ⅲ代 灵霄 产品结构',15,DARK)
    a.text(64,739,'提供胶边、钢库、框架、皮口与集球结构的部件依据。',12,MUTED)
    a.text(64,779,'S1石板字段含46mm与48mm两种表述；剖面厚度列为待核验。',12,MUTED)
    a.text(64,812,'来源访问日期 2026-11-06 · 点击来源标题可打开公开页面',11,MUTED)
    c.linkURL(JOY,(64,900-685,1100,900-631),relative=0)
    c.linkURL(TENGBO,(64,900-749,1100,900-695),relative=0)
    a.save(out/'t06.svg');c.showPage()
    figures.append({'name':'T06','title':'参数、来源与待校准项','page':page,'source':'table-studies/t06.svg','render':'table-studies/t06.png'})
    md.append('### T06 参数、来源与待校准项\n\n|项目|当前规范|依据与状态|\n|---|---|---|\n'+'\n'.join('|'+ '|'.join(row)+'|' for row in PARAMETERS)+'\n')
    md.append(f'公开来源访问日期2026-11-06。[S1 JOY Q8 Pro]({JOY})、[S2 腾勃灵霄]({TENGBO})。\n\nS1的袋口85mm未区分角/中袋和测量方法；其石板尺寸字段含46mm与48mm两种表述，当前剖面厚度列为待核验。S2提供部件关系参考。\n')
    page+=1;a=frame(c,1200,900,'T07 造型与体验验收','按固定机位、连续帧及参数表逐项评审。',page)
    for i,(title,body) in enumerate(ACCEPTANCE):
        y=b['paragraph'](a,64,175+i*124,title,body,1072,15,20,24)
        assert y<851,('table-acceptance',y)
    a.save(out/'t07.svg');c.showPage()
    figures.append({'name':'T07','title':'造型与体验验收','page':page,'source':'table-studies/t07.svg','render':'table-studies/t07.png'})
    md.append('### T07 造型与体验验收\n')
    for title,body in ACCEPTANCE:md.append('#### '+title+'\n\n'+body+'\n')
    page+=1;a=frame(c,1200,900,'T08 圆润袋角与相切连接','平面曲线与鼻口剖面分别定义，放大观察两个连接位置。',page)
    rounded_jaw_detail(a,b)
    a.save(out/'t08.svg');c.showPage()
    figures.append({'name':'T08','title':'圆润袋角与相切连接','page':page,'source':'table-studies/t08.svg','render':'table-studies/t08.png'})
    md.append('### T08 圆润袋角与相切连接\n\n![圆润袋角与相切连接](table-studies/t08.png)\n')
    for heading,body in getattr(a, 'design_notes', []):
        md.append('#### '+heading+'\n\n'+body+'\n')
    md.append('圆润袋角的同类实拍形态参考。[S3 KNBB中式台球介绍与照片](https://www.knbb.nl/chinese-pool-komt-naar-nederland/)。照片中的圆弧与包布关系用于形态研究，具体尺寸待同型号核验。\n')
    for ident,title,sub,draw in [
        ('T09','V8低位模型观察','与T01使用同一模型、材质与比例参照。',aiming_render),
        ('T10','V8角袋与中袋','实际模型近景 · 袋角、皮口与袋壁的连接依据。',pocket_render),
        ('T11','已确认桌腿造型','正交轮廓与整桌近景共同约束造型。',leg_render),
        ('T12','模型参数与交付边界','造型基准已确认，游戏接入与实物测量分别验收。',model_specification),
    ]:
        page+=1;a=frame(c,1200,900,ident+' '+title,sub+(' 结构示意，轮廓与尺寸以V8模型为准。' if ident in ('T02','T03','T04') else ''),page)
        draw(a,b);name=ident.lower()
        a.save(out/(name+'.svg'));c.showPage()
        figures.append({'name':ident,'title':title,'page':page,'source':f'table-studies/{name}.svg','render':f'table-studies/{name}.png'})
        md.append(f'### {ident} {title}\n\n{sub}\n\n![{title}](table-studies/{name}.png)\n')
        for heading,body in getattr(a, 'design_notes', []):md.append('#### '+heading+'\n\n'+body+'\n')
    md.append('### 模型交付与状态\n\nV8统一Blender母版和GLB、参数、材质署名及文件指纹均已交付。T01、T09至T11为实际模型渲染，T12记录执行参数和资源状态。T02至T08中的结构示意继续解释部件关系，具体形态以V8为准。游戏接入、Creator和设备结果按技术方案单独验收。\n')
    return page,figures,md
