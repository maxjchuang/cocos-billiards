"""Generate the approved three-mode touch specifications and review figures."""
from pathlib import Path
import base64, io, json, runpy, shutil, subprocess, sys
sys.dont_write_bytecode = True
from reportlab.pdfgen import canvas
from pypdf import PdfReader, PdfWriter
ROOT = Path(__file__).resolve().parents[1]
D = ROOT / 'docs/design'
base = runpy.run_path(str(ROOT / 'scripts/build-layout-review.py'))['base']
Art = base['Art']
OUT = D / 'interaction'
OUT.mkdir(exist_ok=True)
PAGES = [
('三状态触摸操作', '已批准的移动端横屏交互，版本3.0', [
('自由观察', '轻点台面在松手时瞄准触点，球杆朝向同步更新，单指拖动围绕锚点环绕，双指同向拖动同步平移相机与锚点，捏合调整距离。锚点沿台面移动并有边界，居中球桌恢复完整桌面。'),
('俯视观察', '正交镜头垂直台面，长边横向展示。单指按下立即朝台面触点瞄准，移动持续跟随，抬手保留方向。双指平移、缩放。'),
('瞄准', '镜头移至母球后方。横向相对拖动调角，慢拖低灵敏度。向下后拉蓄力，松手击球，推回零点取消。轻点保持方向。'),
('进入与切换', '开局摆球从俯视进入，确认后俯视选线路。后续保留主模式，瞄准时重定位至新母球。模式切换清除当前手势，240ms镜头过渡，可减少动态。')]),
('一杆操作与参数', '观察、确定方向、后拉与触球构成连续流程', [
('后拉出杆', '瞄准方向、打点确认后，向下拉增加力度。力度0%至100%，满力行程96逻辑像素，前段更细。回推至4px零点容差内为0%。'),
('边缘起手', '底部剩余空间不足96px时提示向上移一点再后拉。尚未蓄力时允许上移重设零点，具备行程后可后拉。'),
('微调与打点', '微调支持连续低灵敏度拖动、抬手续拖和0.1度步进。打点使用草稿、确认、取消与回中，按钮回显确认值。'),
('实际触球', '松手启动100至160ms前送，杆头接触母球同帧提交物理并播放声音。之后短距离送杆、淡出。AI沿用独立的自动出杆入口。')]),
('权限、取消与验收', '比赛阶段决定编辑权限，观察模式始终可辨认', [
('双指与取消', '第二指加入取消蓄力，俯视恢复单指按下前方向，进入双指观察。手指数减少等待全部抬起。暂停、后台、窗口变化、系统取消清除手势。'),
('摆球与比赛', '摆球时单指编辑母球，双指平移缩放，自由观察可检查位置。AI、球运动与结果查看提供观察权限，球停稳且裁判允许后恢复方向编辑。'),
('反馈与可用性', '三模式常驻选中反馈，触区至少44px。锚点20px操作后600ms淡出，俯视触点300ms淡出。力度仅蓄力时显示，底部保留微调和打点。'),
('验收', '覆盖三横屏667×375、852×393、932×430与DPR2/3。检查触点方向、模式隔离、双指恢复、蓄力零点、边缘重设、唯一触球、AI和裁判回归。真实设备及微信专项按既有约定跳过。')]),
]
UX = [
('输入判定与反馈', '所有距离均为逻辑像素，首轮参数待手感校准', [
('起手方向', '自由观察小于8px的轻点在松手时瞄准，拖动越过8px后仅环绕。瞄准状态8px后识别，横向超过纵向1.3倍进入调角，向下超过横向1.3倍进入后拉。模糊斜向继续等待，识别后固定用途。'),
('双指意图', '中心累计移动6px或指距变化4%进入识别，以归一化幅度更大者判定。平移与缩放各自锁定，全部抬起重新识别。'),
('提示与零点', '俯视触点空心圆环，锚点十字圆环。蓄力显示百分比与零点，零力度显示松手取消。底部无行程时显示向上移一点再后拉。'),
('中断', '触摸取消、第二指、模式切换、暂停、后台与尺寸变化取消蓄力。前送触球前暂停取消，触球后冻结原杆并在继续时恢复。')]),
('模式、阶段与布局', '主状态与临时控件分开表达', [
('布局', '左侧3项模式控件，每项至少44px。观察时显示居中球桌，瞄准时底部显示微调与打点两个线框按钮，身份卡位于顶部两侧。'),
('权限', '俯视单指仅在合法可瞄准阶段编辑方向。摆球单指移动母球。AI、球运动、结果查看可自由或俯视观察。运动时进入瞄准显示只读提示。'),
('镜头记忆', '自由与俯视分别记忆目标和距离。进入瞄准沿当前方向回母球后方，下一杆瞄准以新母球重新就位，观察模式保留视角。'),
('微调与面板', '微调条相对拖动并显示相对角度，可续拖超过原±5度窗口。打点面板确认后回显，面板外台面作为背景，关闭后开始新手势。')]),
('运动与一致性验收', '以真实触球时刻作为唯一提交边界', [
('后拉与前送', '拉力使用零点后4px死区，96px满力，幂曲线1.6。台面杆后移最多180mm，前送100加60乘力度比例毫秒，触球后80ms送杆，再80ms淡出。'),
('保护触摸', '方向拖动、蓄力和双指观察均有独立所有权。俯视第二指恢复方向快照，取消后无残余角度、力度或额外击球。'),
('验证图稿', '三张模式图为设计图，球桌真实材质与轮廓依照V8模型章节。运行截图及自动检查报告另存技术验收目录。'),
('回归范围', '测试纯手势、镜头、ShotSequence与组件入口，构建Creator Web Mobile，浏览器多画幅合成DOM触摸，工程预览运行核验。')]),
]

def frame(c, w, h, title, sub, page):
    a = Art(c,w,h)
    a.rect(0,0,w,h,'#F7F5EE')
    a.text(42,34,'EIGHT CLUB · 3.0 · 2026.11.09',11,'#607466')
    a.text(42,82,title,27,'#203D30')
    a.text(42,113,sub,12,'#607466')
    a.text(w-42,h-24,str(page),10,'#607466','end')
    return a

def screen(a, mode):
    a.rect(0,0,852,393,'#101F1B')
    if mode != 'top':
        img=D/'table-model'/('aiming.png' if mode in ('aim','pull','cancel') else 'overview.png')
        a.c.drawImage(str(img),82,12,width=688,height=365, preserveAspectRatio=True,anchor='c')
        a.svg.append('<image x="82" y="16" width="688" height="365" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,'+base64.b64encode(img.read_bytes()).decode()+'"/>')
    else:
        a.rect(114,65,614,272,'#684D36',18)
        a.rect(130,81,582,240,'#21564B',10)
        for x,y in [(130,81),(421,81),(712,81),(130,321),(421,321),(712,321)]: a.circle(x,y,12,'#080F0D')
        for x,y,n in [(300,200,0),(490,150,1),(570,240,8),(440,260,11)]:
            a.circle(x,y,7,'#F6F1E0' if n==0 else '#D8B96D')
            if n:a.text(x,y+3,str(n),7,'#10231B','middle')
        a.line(300,200,490,150,'#E4C57F',1.5)
        a.circle(490,150,14,None,'#E4C57F',1)
    for i,(name,key) in enumerate([('自由观察','free'),('俯视观察','top'),('瞄准击球','aim')]):
        y=70+i*52
        a.rect(8,y,64,46,'#314A3D' if key==('aim' if mode in ('pull','cancel') else mode) else '#192D25',8)
        a.text(40,y+28,name,10,'#E4C57F' if key==('aim' if mode in ('pull','cancel') else mode) else '#EAEBDD','middle')
    if mode in ('aim','pull','cancel'):
        for x,label in [(170,'微调'),(250,'打点')]:
            a.rect(x,333,72,44,'#20382C',8);a.circle(x+15,355,6,None,'#EAEBDD',1);a.text(x+46,360,label,11,'#EAEBDD','middle')
        a.text(425,360,'向下后拉 · 松手击球 · 推回取消',12,'#E4C57F','middle')
        if mode in ('pull','cancel'):
            a.rect(474,122,64,164,'#20382C',8)
            a.line(506,150,506,260,'#687B6F',3)
            if mode=='pull':a.line(506,150,506,222,'#E4C57F',4)
            a.line(496,150,516,150,'#E4C57F',1)
            a.circle(425,140,9,None,'#E4C57F',1)
            a.circle(425,206 if mode=='pull' else 142,12,None,'#EAEBDD',1)
            a.text(506,142,'65%' if mode=='pull' else '0%',12,'#E4C57F','middle')
            a.text(506,284,'松手击球' if mode=='pull' else '松手取消',11,'#E4C57F','middle')
    else:
        a.rect(8,238,64,44,'#192D25',8);a.text(40,265,'居中',12,'#EAEBDD','middle')
    a.text(120,30,'玩家一 · 全色',12,'#EAEBDD');a.text(720,30,'AI · 标准',12,'#EAEBDD','end')

figures=[]
for mode,title in [('free','自由观察'),('top','俯视观察'),('aim','瞄准准备'),('pull','后拉蓄力反馈'),('cancel','归零取消反馈')]:
    tmp=ROOT/'tmp/pdfs';tmp.mkdir(parents=True,exist_ok=True)
    c=canvas.Canvas(str(tmp/f'interaction-{mode}.pdf'),pagesize=(852,393))
    a=Art(c,852,393);screen(a,mode);a.save(OUT/f'{mode}.svg');c.showPage();c.save()
    subprocess.run(['pdftoppm','-singlefile','-scale-to','1704','-png',str(tmp/f'interaction-{mode}.pdf'),str(OUT/mode)],check=True)
    figures.append({'name':mode,'title':title,'source':f'interaction/{mode}.svg','render':f'interaction/{mode}.png'})

# Preserve the approved V8 model chapter from the existing UI/UX PDF.
manifest=json.loads((D/'design-manifest.json').read_text())
old=PdfReader(D/'中式八球UIUX设计方案.pdf')
first=manifest['tableFigures'][0]['page']-1
model_pages=list(old.pages[first:])
retained = runpy.run_path(str(ROOT/'scripts/free_camera_content.py'))['PRODUCT']
retained[10]=('V8球桌造型与接入','已确认模型与当前游戏集成基线',[
retained[10][2][0],retained[10][2][1],retained[10][2][2],
('交付与验收','V8移动端派生模型已接入游戏，几何、材质和软件验证见技术接入方案。交互实施状态与设备范围见三状态实施计划。'),
('文档入口','本版UI/UX的T01至T12沿用已确认V8模型章节，页码见design-manifest.json。早期造型与交互记录按历史版本保存。')])
for kind, filename, pages in [('产品','中式八球产品设计方案.pdf',PAGES+[retained[6],retained[10]]),('UI / UX','中式八球UIUX设计方案.pdf',PAGES+UX)]:
    target=ROOT/'tmp/pdfs'/filename
    c=canvas.Canvas(str(target),pagesize=(1200,900));c.setAuthor('Cocos Billiards');c.setTitle('中式八球 '+kind+' 3.0')
    markdown=['# 中式八球 '+kind+'设计 3.0\n\n2026-11-09 · 三状态操作与后拉出杆\n']
    for number,(title,sub,items) in enumerate(pages,1):
        a=frame(c,1200,900,title,sub,number);markdown.append('## '+title+'\n\n'+sub+'\n')
        for i,(heading,body) in enumerate(items):
            base['paragraph'](a,48,170+i*155,heading,body,1104,16,22,26)
            markdown.append('### '+heading+'\n\n'+body+'\n')
        c.showPage()
    if kind=='UI / UX':
        for figure in figures:
            a=frame(c,1200,900,figure['title'],'交互设计图稿 · V8球桌造型见后续模型章节',len(pages)+figures.index(figure)+1)
            c.drawImage(str(D/figure['render']),48,195,width=1104,height=509)
            c.showPage();markdown.append('## '+figure['title']+'图稿\n\n!['+figure['title']+']('+figure['render']+')\n')
    c.save();reader=PdfReader(target);writer=PdfWriter()
    for p in reader.pages:writer.add_page(p)
    if kind=='UI / UX':
        offset=len(reader.pages)
        for index,p in enumerate(model_pages):
            overlay=io.BytesIO();stamp=canvas.Canvas(overlay,pagesize=(1200,900));a=Art(stamp,1200,900)
            a.rect(32,12,500,35,'#F7F5EE');a.text(42,34,'EIGHT CLUB · 3.0 · V8 MODEL SPECIFICATION',10,'#607466')
            a.rect(1120,860,60,30,'#F7F5EE');a.text(1158,879,str(offset+index+1),10,'#607466','end')
            stamp.showPage();stamp.save();overlay.seek(0);p.merge_page(PdfReader(overlay).pages[0]);writer.add_page(p)
        for item in manifest['tableFigures']:item['page']=offset+item['page']-first
        markdown.append('## V8球桌规范\n\n采用已批准V8模型与资源契约，外廓2820×1540×850mm、台面2540×1260mm、球径57.15mm。六条车枳圆腿主体400mm、最粗166mm，脚座92mm。模型与材质细节见[模型规范](table-model/README.md)。\n')
    with open(D/filename,'wb') as f:writer.write(f)
    (D/('landscape-product.md' if kind=='产品' else 'landscape-uiux.md')).write_text('\n'.join(markdown))
    shutil.copyfile(D/filename,ROOT/'output/pdf'/filename)
contract=json.loads((D/'ui-contract.json').read_text())
contract.update(version='3.0-touch-modes',date='2026-11-09',cameraModel='free orbit / orthographic top / cue aiming',cameraControls={'modes':['free','top','aim'],'free':{'tap':'point at table position on release; under 8 logical pixels','oneFinger':'orbit','twoFingerParallel':'pan anchor','pinch':'distance'},'top':{'oneFinger':'point at contact continuously','twoFingerParallel':'pan','pinch':'scale'},'aim':{'tap':'retain direction','horizontal':'relative angle','downward':'pull power','release':'shoot when positive','returnToZero':'cancel'},'fingerCountChange':'restore top direction; cancel pull; wait all fingers up'},shotContactMs={'human':'100 + 60 * normalized power','AI':220},gesture={'thresholdPx':8,'axisRatio':1.3,'panThresholdPx':6,'pinchThreshold':.04,'pullDistancePx':96,'zeroDeadzonePx':4,'powerExponent':1.6,'transitionMs':240},figures=figures)
contract['hud'].pop('shoot',None)
contract['aiActivity']={'anchor':'turn information row','referenceRect':[110,58,176,28],'fontSize':12,'textWidth':140,'singleLine':True,'difficulty':'AI identity badge'}
contract['resultIdentity']={'alignment':'center','order':['avatar','nickname','title'],'avatarRadius':22,'compactAvatarRadius':18,'standardTopOffsets':[50,96,136,164],'compactTopOffsets':[36,72,106,130]}
contract['playerCard']={'compactContent':['avatar','nickname','group','remainingCount'],'targetRowMinimumHeight':64,'hiddenNumbersAlsoHideGraphics':True,'allNumbersInIdentityView':True}
contract['modeLabels']={'free':'自由观察','top':'俯视观察','aim':'瞄准击球'}
contract['modeIcons']=False
contract['hud']={'pause':[8,8,44,44],'modes':[[8,64,72,44],[8,114,72,44],[8,164,72,44]],'center':[8,218,72,44],'player1':[110,8,148,44],'player2':[562,8,148,44],'fine':[166,329,100,44],'spin':[274,329,100,44],'power':'temporary readout beside pull origin'}
contract['actionDock']=[166,329,208,48]
contract['runtimeBaseline']='touch-modes 3.0 worktree'
contract['artifactScope']='approved touch interaction specification'
contract['reviewItems']=['physical device feel calibration by user','actual WeChat compatibility deferred by user']
contract['tableAppearance']['runtimeIntegration']='V8 integrated; docs/technical/table-model-integration.md'
contract['tableAppearance']['reviewScope']='approved V8 geometry and software integration; hardware scope recorded separately'
(D/'ui-contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
manifest.update(version='3.0-touch-modes',productVersion='3.0',uiuxVersion='3.0',date='2026-11-09',generator='scripts/build-interaction-design.py',productPages=5,uiuxPages=6+len(figures)+len(model_pages),figures=figures,runtimeIntegration='implemented; software acceptance passed; ../technical/touch-modes-plan.md')
manifest['confirmed']=['three touch modes','top continuous point aiming','pull and release stroke','two finger anchor pan','V8 table model']
(D/'design-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('Generated product 5 pages, UI/UX',6+len(figures)+len(model_pages),'pages')
