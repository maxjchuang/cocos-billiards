"""Build the product V2.2 and UI/UX V2.4 documents. Use --uiux-only for visual revisions."""
from pathlib import Path
import sys, runpy, json, math, shutil, subprocess
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))
from free_camera_content import PRODUCT, STATES
from table_visual_design import append_table_pages
UIUX_ONLY = "--uiux-only" in sys.argv
DOCUMENTS_ONLY = "--documents-only" in sys.argv
DOCUMENT_VERSION = "2.2"
DOCUMENT_DATE = "2026.11.08"
ui = runpy.run_path(str(Path(__file__).with_name('build-layout-review.py')))
b = ui['base']
Art, canvas = b['Art'], b['canvas']
root = Path(__file__).resolve().parents[1]
design = root/'docs/design'
out = design/'free-camera'
tmp = root/'tmp/pdfs/free-camera'
out.mkdir(exist_ok=True)
tmp.mkdir(parents=True,exist_ok=True)
INK, GOLD, BG = ui['INK'], ui['GOLD'], ui['BG']

def frame(c,w,h,title,sub,page):
    a=Art(c,w,h)
    a.rect(0,0,w,h,'#F7F5EE')
    a.text(42,32,'EIGHT CLUB / DESIGN V'+DOCUMENT_VERSION,9,'#607466')
    a.text(w-42,32,DOCUMENT_DATE+' · 设计评审',10,'#607466','end')
    a.text(42,80,title,24 if w<700 else 29,'#203D30')
    for i,row in enumerate(b['wrap'](sub,w-84,12)):
        a.text(42,108+i*19,row,12,'#607466')
    a.line(42,h-40,w-42,h-40,'#D8DED1',.7)
    a.text(42,h-21,'横屏 · 统一界面 · 连续自由镜头',9,'#607466')
    a.text(w-42,h-21,str(page),10,'#607466','end')
    return a

def hud(a,kind):
    placing=kind=='placement'
    ui['identity'](a,181.6,'林间听风','线后摆球' if placing else '你的回合 · 全色 剩4',True)
    ui['identity'](a,505.4,'AI 陪练','尚未分组' if placing else '标准 · 半色 剩5',False,True)
    a.rect(44,12,44,44,BG,10,alpha=.9)
    b['icon'](a,'pause',66,34)
    a.rect(44,68,44,88,BG,10,alpha=.9)
    b['icon'](a,'cue',66,87,GOLD,.9)
    a.text(66,117,'回到',11,INK,'middle')
    a.text(66,135,'出杆位',11,INK,'middle')
    a.text(778,121,'65%',16,INK,'middle',True)
    a.rect(756,132,44,144,BG,22,alpha=.5)
    a.line(778,144,778,264,'#40594B',3)
    a.line(778,264,778,186,GOLD,3)
    a.circle(778,186,6,GOLD)
    if placing:
        b['button'](a,(166,320,224,48),'确认摆球',primary=True)
    elif kind=='spin':
        ui['spin_panel'](a)
    else:
        ui['dock'](a)
    a.rect(371,382,110,3,'#6E8075',2,alpha=.6)

def screen(a,kind):
    with a.screen_clip():
        a.rect(0,0,852,393,BG)
        fn=b['perspective']
        if kind in ['high','placement']:
            original=fn.__globals__['BALLS']
            if kind=='placement':
                balls=[(0,0,.8)]
                order=[1,10,2,11,8,3,12,4,13,5,6,14,7,15,9]
                index=0
                for row in range(5):
                    for col in range(row+1):
                        balls.append((order[index],(col-row/2)*2*b['R'],-.635-row*math.sqrt(3)*b['R']))
                        index+=1
                fn.__globals__['BALLS']=balls
            try:
                fn(a,eye=(0,2.05,.27),target=(0,0,0),orbit=math.pi/2,placing=kind=='placement')
            finally:
                fn.__globals__['BALLS']=original
        else:
            fn(a)
        hud(a,kind)
    a.rect(.5,.5,851,392,None,22,'#3C5546',lw=1)

SCREENS=[
('low','低位瞄准','母球后方的近距离观察位置。',[
('共同界面','上沿身份、左侧暂停与回到出杆位、右侧力度、下沿操作条固定。'),
('手势分工','单指拖动调球杆方向。双指同向移动环绕、抬高镜头，捏合改变远近。'),
('回位语义','回到出杆位只调整镜头。方向、力度与确认打点分别保存。')]),
('high','高位全局观察','同一镜头抬高、环绕并拉远后的示意状态。',[
('连续观察','高低机位之间连续变化。完整六袋可进入画面，球与袋口始终遵守同一空间比例。'),
('同一HUD','身份、力度与三个操作的坐标、尺寸和样式与低机位一致。当前球杆方向与轨迹随场景投影。'),
('参数独立','环绕后继续按当前球杆方向出杆。回位可重新从母球后方确认击球方向。')]),
('placement','统一界面内摆球','推荐较高机位进入，用户仍可主动环绕、抬高和缩放。',[
('手势归属','单指轻触或拖动编辑母球，双指调整镜头。第二指加入时保留最近合法球位并建立观察起点。'),
('确认动作','操作条替换为确认摆球。重叠、袋口或越界时保留合法位置并提示原因，确认按钮仅在合法时可用。'),
('确认之后','保留当前镜头，进入正常瞄准。用户可点击回到出杆位，或继续在当前角度观察和瞄准。')]),
('spin','打点编辑与自由观察','面板编辑草稿，场景区域支持双指观察。',[
('方向定义','沿球杆看向母球定义高低杆和左右塞，读数保持该方向定义。'),
('编辑与恢复','完成应用、取消恢复原值，复位仍需确认。面板外单指瞄准暂停，双指观察可用。'),
('面板归属','图示为左侧258×304面板。默认左右分工待评审，所有机位共用同一布局。')]),
]

TEXT_PAGES=[
('手势与观察规则',[
('单指瞄准','使用相对拖动调整球杆方位，可抬手续拖。镜头保持当前观察位置，球杆与预测线反馈实际方向。'),
('双指观察','同向平移调整方位与俯角，捏合调整远近。达到识别阈值后锁定主意图，灵敏度与阈值由交互原型校准。'),
('手指数变化','第二指加入时结束单指编辑并重新建立手势起点。双指退为单指后等待全部抬起再接受新的单指编辑。'),
('控件优先','控件内起始触摸由该控件独占。双指观察要求两指都起始于场景。面板、力度和按钮保留各自命中范围。'),
('取消恢复','取消保存最近有效参数。窗口尺寸变化结束旧手势并继续对局，暂停和后台恢复需要明确继续。')]),
('组件与视觉规范',[
('参考布局','852×393逻辑像素。身份条148×44，暂停44×44，回到出杆位44×88，力度44×144，操作条224×48。'),
('操作条','三项触区72×44，图标18、标签12，水平图文排列。出杆72×40金色表面，圆角9，操作条圆角12。打点位于出杆右侧。'),
('文字与颜色','标题18-24、动作12、正文14、身份12/10、力度16。背景#0E1C19、面板#1C3028、主字#F4F0E6、次字#ABBAB0、强调#D9BD83。'),
('图标与状态','1.5px圆端点线框。行动方使用文字与金色短线，禁用保留可读标签，按下反馈与布局位置分开处理。'),
('微调与打点','微调条展开在操作条上方，范围±5°、步长0.1°。打点面板258×304，球面104、选择半径36，球面编辑触区至少144×144。')]),
('镜头、回位与遮挡',[
('自由观察范围','镜头围绕球台移动并保持台面上方。通过距离与局部遮挡处理提供母球、杆头和目标的观察路径。俯角和缩放边界由原型校准。'),
('回位和打断','沿当前球杆方向回到母球后方，新的观察手势可以打断回位并连续接管。准备与运动阶段使用该杆起点，结算后回位使用当前母球。'),
('信息简化','简洁显示、左右布局与帮助位于暂停菜单。简洁状态保留行动方、球组、力度、暂停、回位与必要阶段操作。'),
('轨迹和球体','白虚线表示母球，金虚线表示目标球。轨迹、球号、连续半色环带与阴影遵循同一场景投影和遮挡关系。'),
('关键区域','保护母球、杆头、首碰点、当前目标袋口与轨迹。参考保护边距20/12逻辑像素，连续按下期间控件固定。')]),
('出杆时序与恢复',[
('0-220ms','0-140ms图标球杆后收，140-220ms前送。准备开始锁定方向、力度和确认打点，期间允许自由观察。'),
('220ms关键帧','按钮触球、母球启动和击球音效同帧发生，提交次数为一次。'),
('220-820ms','220-480ms反馈短线扩散并让球离场，480-640ms留杆，640-820ms图标复位。'),
('中断规则','触球前取消准备，人类恢复后重新点击。AI沿用锁定命令重新准备。触球后继续原杆。低帧率按事件顺序与提交次数验收。'),
('减少动态','简化回位动画和位移动效，保留触球同步。镜头转场的速度与舒适性需要交互验证。')]),
('响应与完整流程',[
('横屏适配','检查667×375、852×393、932×430及平板。按实际系统和宿主安全区排布，所有互动目标至少44，字号保持可读。'),
('开始与暂停','开始选择玩法和AI难度。暂停集中继续、设置、难度、规则、判罚、布局和重开。重开提供二次确认。'),
('阶段操作','摆球显示确认摆球，选组显示全色/半色，开球处理显示裁判要求的动作。操作区按阶段替换，镜头和身份连续保留。'),
('结果与资料','结果显示胜者、原因、再来一局和查看台面。身份详情展示完整昵称，规则和署名分页。五项既有设置即时生效。'),
('默认横屏','引擎从入口按横屏启动。窗口变化时重新适配并结束旧手势，保持球局、镜头与参数。后台恢复后明确继续。')]),
('可验证的完成标准',[
('C01 统一界面','低位、高位与任意环绕位置的身份、力度、主操作坐标和样式一致。固定入口名为回到出杆位。'),
('C02 手势隔离','双指环绕与捏合前后，球杆方位、力度和打点值相同。第二指加入与退出均无方向跳变、母球跳位或额外击球。'),
('C03 摆球','任意可操作观察角度可合法摆球，双指只改变镜头。确认保留镜头，回位保持合法球位。'),
('C04 跨阶段','AI、准备、运动、打点草稿与结果阶段可观察。运动中回位使用保存的出发点，停稳后保持用户观察位置。'),
('C05 回归与环境','验证220ms同帧唯一提交、裁判和AI回归、布局避让、窗口适配和后台恢复。文件检查、浏览器、Creator及设备验收分别记录。')]),
]

if not UIUX_ONLY:
    for kind,title,sub,copy in ([] if DOCUMENTS_ONLY else SCREENS):
        c=canvas.Canvas(str(tmp/(kind+'.pdf')),pagesize=(852,393))
        c.setAuthor('Cocos Billiards')
        a=Art(c,852,393)
        screen(a,kind)
        a.save(out/(kind+'.svg'))
        c.showPage();c.save()
        subprocess.run(['pdftoppm','-singlefile','-scale-to','1704','-png',str(tmp/(kind+'.pdf')),str(out/kind)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

    c=canvas.Canvas(str(design/'中式八球产品设计方案.pdf'),pagesize=(595.28,841.89))
    c.setAuthor('Cocos Billiards');c.setTitle('中式八球 产品设计 V2.2')
    product_md=['# 中式八球产品设计 V2.2\n\n2026-11-08 · 横屏自由镜头与已确认V8球桌\n']
    for page,(title,sub,items) in enumerate(PRODUCT,1):
        a=frame(c,595.28,841.89,title,sub,page);y=157
        product_md.append('## '+title+'\n\n'+sub+'\n')
        for heading,body in items:
            y=b['paragraph'](a,44,y,heading,body,507,11.2,14.5,19)
            assert y<797,(page,y)
            product_md.append('### '+heading+'\n\n'+body+'\n')
        c.showPage()
    c.save()
    (design/'landscape-product.md').write_text('\n'.join(product_md))

DOCUMENT_VERSION = '2.4'
DOCUMENT_DATE = '2026.11.08'
c=canvas.Canvas(str(design/'中式八球UIUX设计方案.pdf'),pagesize=(1200,900))
c.setAuthor('Cocos Billiards');c.setTitle('中式八球 UI UX V2.4')
ux_md=['# 中式八球 UI / UX V2.4\n\n2026-11-08 · 已确认V8球桌模型规范\n\n低位、高位、摆球与打点图用于说明交互布局。V8实际渲染与参数见T01、T09-T12。\n']
page=0
for kind,title,sub,items in SCREENS:
    page+=1;a=frame(c,1200,900,title,sub+" 布局示意，造型规范见T01及T09-T12。",page)
    c.saveState();sc=1072/852;c.translate(64,900-156-393*sc);c.scale(sc,sc);screen(Art(c,852,393),kind);c.restoreState()
    b['columns'](a,items)
    ux_md.append(f'## {title}\n\n{sub}\n\n![{title}](free-camera/{kind}.png)\n')
    for heading,body in items:ux_md.append('### '+heading+'\n\n'+body+'\n')
    c.showPage()
for title,items in TEXT_PAGES:
    page+=1;a=frame(c,1200,900,title,'统一界面的组件、手势与状态规范',page)
    ux_md.append('## '+title+'\n')
    for i,(heading,body) in enumerate(items):
        y=b['paragraph'](a,64,175+i*125,heading,body,1072,15,20,24)
        assert y<851,(title,y)
        ux_md.append('### '+heading+'\n\n'+body+'\n')
    c.showPage()
page+=1;a=frame(c,1200,900,'阶段与权限矩阵','镜头观察、球局阶段和参数编辑分别管理',page)
b['table'](a,64,158,1072,['阶段','可操作范围','确认与恢复'],STATES,[1,2,2],70,13)
c.showPage()
page,table_figures,table_md=append_table_pages(c,frame,b,root,page)
c.save()
ux_md.append('## 阶段与权限矩阵\n\n|阶段|可操作范围|确认与恢复|\n|---|---|---|\n'+'\n'.join('|'+ '|'.join(row)+'|' for row in STATES))
ux_md.extend(table_md)
(design/'landscape-uiux.md').write_text('\n'.join(ux_md)+'\n')
contract={'orientation':'landscape-default; no orientation gate','version':'2.1-design-review','date':'2026-11-04','cameraModel':'single continuous orbit camera','cameraControls':{'oneFinger':'aim; placement stage edits cue ball','twoFingerParallel':'orbit and pitch','pinch':'distance','returnAction':'回到出杆位','aimIndependent':True,'fingerCountChange':'rebase when second finger arrives; after dropping to one require all fingers up','shotOrigin':'return uses saved origin during preparation and motion','afterPlacement':'preserve camera','afterSettlement':'preserve camera','boundsAndSensitivity':'pending interaction calibration'},'referenceFrame':[852,393],'safeInsets':[44,0,44,21],'hud':{'pause':[44,12,44,44],'returnToShot':[44,68,44,88],'player1':[181.6,8,148,44],'player2':[505.4,8,148,44],'power':[756,132,44,144],'fine':[170,322,72,44],'shoot':[242,322,72,44],'spin':[314,322,72,44]},'actionDock':[166,320,224,48],'placementConfirm':[166,320,224,48],'spinPanel':[96,64,258,304],'shotContactMs':220,'states':STATES,'reviewItems':['default dock side','camera angle and distance bounds','gesture thresholds and sensitivity','return duration'],'artifactScope':'design review','runtimeBaseline':'21abab2','figures':[{'name':k,'title':t,'source':f'free-camera/{k}.svg','render':f'free-camera/{k}.png'} for k,t,s,i in SCREENS]}
model_spec=json.loads((design/'table-model/model-spec.json').read_text())
model_audit=json.loads((design/'table-model/model-validation.json').read_text())
contract['version']='2.4-model-baseline'
contract['date']='2026-11-08'
contract['tableAppearance']={
    'direction':'墨绿台呢、胡桃木桌体与木脚座、深棕皮口',
    'specification':'landscape-uiux.md#球桌造型规范-v24',
    'referenceModel':'JOY Q8 Pro overall proportions; game-specific V8 styling',
    'dimensionsMm':{'outer':[2820,1540,850],'playingBed':[2540,1260],'ballDiameter':57.15},
    'derivedOverallBorderMm':140,
    'pocketMouthCandidatesMm':{'corner':85,'side':82,'status':'game candidates; manufacturer corner/side measurement definitions unverified'},
    'unverified':['manufacturer cushion profile','manufacturer jaw radii','manufacturer slate cut-out','manufacturer pocket throat','manufacturer slate thickness','real-table calibration'],
    'jawContour':'V8 model contours; T03/T08 explain structural relationships',
    'visualFitting':['cushion profile','jaw curvature','leather thickness','apron and legs','vertical levels'],
    'fallPresentation':{'durationMs':320,'scale':'constant','occlusion':'cloth, jaw, pocket wall and dark interior','settlement':'after final falling ball completes'},
    'figures':table_figures,
    'sources':model_spec['sources'],
    'visualStatus':'V8 user approved 2026-11-08',
    'common3DModel':{'revision':model_spec['revision'],'source':'table-model/chinese-pool-table.blend','export':'table-model/chinese-pool-table.glb','parameters':'table-model/model-spec.json','sha256':model_audit['sha256']},
    'legDesign':model_spec['legDesign'],
    'materials':model_spec['materials'],
    'pocketSurfaceFix':model_spec['pocketSurfaceFix'],
    'renderAssets':['table-model/'+name+'.png' for name in ['overview','aiming','corner','side','wood','legs','skirt','leg-profile']],
    'reviewScope':'approved model geometry and browser review; Cocos integration pending',
    'runtimeIntegration':'pending; docs/technical/table-model-integration.md',
    'priorConceptStatus':'historical exploration; V8 is the execution baseline',
}
(design/'ui-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
manifest={'version':'2.1-design-review','date':'2026-11-04','productPdf':'中式八球产品设计方案.pdf','uiuxPdf':'中式八球UIUX设计方案.pdf','productPages':len(PRODUCT),'uiuxPages':page,'generator':'scripts/build-free-camera-design.py','productSource':'landscape-product.md','uiuxSource':'landscape-uiux.md','contract':'ui-contract.json','figures':contract['figures'],'supersedes':'archive/v2.0','confirmed':['one landscape UI','single continuous free camera','observation independent of aim','placement permits camera adjustment']}
manifest.update({'version':'2.4-model-baseline','date':'2026-11-08','productVersion':'2.2','uiuxVersion':'2.4','tableFigures':table_figures,'tableReferenceStatus':'V8 model approved; manufacturer fine measurements remain unverified','tableRenderStatus':'renders from the accepted V8 Blender model','tableModel':contract['tableAppearance']['common3DModel'],'runtimeIntegration':'pending','priorT01ShapeStatus':'superseded by V8 model'})
manifest['confirmed'].append('V8 metric table model styling')
(design/'design-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
outputs=[manifest['uiuxPdf']] if UIUX_ONLY else [manifest['productPdf'],manifest['uiuxPdf']]
(root/'output/pdf').mkdir(parents=True,exist_ok=True)
for name in outputs:shutil.copyfile(design/name,root/'output/pdf'/name)
for figure in table_figures:
    number=str(figure['page'])
    subprocess.run(['pdftoppm','-f',number,'-l',number,'-singlefile','-scale-to','1200','-png',str(design/manifest['uiuxPdf']),str(design/figure['render']).removesuffix('.png')],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(f'Generated {page} UIUX pages including twelve table specification plates. Product regenerated: {not UIUX_ONLY}.')
