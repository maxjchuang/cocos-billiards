"""Author the holistic landscape layout review using the existing vector primitives."""
from pathlib import Path
import runpy
import subprocess
import sys
sys.dont_write_bytecode = True
base = runpy.run_path(str(Path(__file__).with_name('build-landscape-design.py')))
Art, canvas = base['Art'], base['canvas']
root = Path(__file__).resolve().parents[1]
out = root / 'docs/design/layout-review'
tmp = root / 'tmp/pdfs/layout-review'
out.mkdir(exist_ok=True)
tmp.mkdir(parents=True, exist_ok=True)
BG, INK, GOLD, MUTED = '#0E1C19', '#F4F0E6', '#D9BD83', '#ABBAB0'


def identity(a, x, name, detail, active=False, ai=False):
    a.rect(x, 8, 148, 44, BG, 8, alpha=.93)
    a.circle(x + 20, 30, 13, '#8D694C' if ai else '#527C64')
    if ai:
        a.poly([(x+10,21),(x+20,27),(x+30,21),(x+26,37),(x+20,41),(x+14,37)], '#ECC78F')
        a.circle(x+16,30,1,BG)
        a.circle(x+24,30,1,BG)
    else:
        a.circle(x+24,25,3,GOLD)
        a.poly([(x+9,38),(x+18,22),(x+30,38)], '#234C3C')
    a.text(x+40,26,name,12,INK)
    a.text(x+40,43,detail,10,MUTED)
    if active:
        a.line(x+40,51,x+138,51,GOLD,2)
        a.circle(x+137,22,2.5,GOLD)


def dock(a):
    a.rect(166,320,224,48,BG,12,stroke='#55715E',alpha=.96,lw=.7)
    a.rect(242,324,72,40,GOLD,9)
    for x, title, kind, primary in [(170,'微调','fine',False),(242,'出杆','cue',True),(314,'打点','spin',False)]:
        color=BG if primary else INK
        base['icon'](a,kind,x+17,344,color,.9)
        a.text(x+32,348,title,12,color)


def controls(a, spin=False):
    identity(a,181.6,'林间听风','你的回合 · 全色 剩4',True)
    identity(a,505.4,'AI 陪练','标准 · 半色 剩5',False,True)
    a.rect(44,12,44,44,BG,10,alpha=.9)
    base['icon'](a,'pause',66,34)
    a.rect(44,68,44,56,BG,10,alpha=.9)
    a.rect(56,78,20,12,None,3,INK,lw=1)
    a.line(62,84,70,84,INK,1)
    a.text(66,112,'视角',11,GOLD,'middle')
    a.text(778,121,'65%',16,INK,'middle',True)
    a.rect(756,132,44,144,BG,22,alpha=.5)
    a.line(778,144,778,264,'#40594B',3)
    a.line(778,264,778,186,GOLD,3)
    a.circle(778,186,6,GOLD)
    if not spin:
        dock(a)
    a.rect(371,382,110,3,'#6E8075',2,alpha=.6)


def spin_panel(a):
    a.rect(96,64,258,304,BG,14,stroke='#526C5B',alpha=.98)
    a.text(112,91,'母球打点',16,INK)
    a.text(330,91,'取消',12,MUTED,'end')
    a.text(112,113,'沿球杆看向母球',11,MUTED)
    base['ball2'](a,225,194,52,0)
    a.circle(225,194,36,None,'#73917D',lw=1)
    a.line(189,194,261,194,'#73917D',.8,'3 4')
    a.line(225,158,225,230,'#73917D',.8,'3 4')
    a.circle(239,205,5,'#214C38',GOLD,lw=1.5)
    for x,y,t in [(225,131,'高杆'),(225,264,'低杆'),(150,198,'左塞'),(300,198,'右塞')]:
        a.text(x,y,t,10,GOLD,'middle')
    a.text(225,292,'低杆30% · 右塞40%',12,INK,'middle')
    base['button'](a,(112,312,100,44),'复位中杆')
    base['button'](a,(220,312,118,44),'完成',primary=True)


def screen(a, kind):
    with a.screen_clip():
        a.rect(0,0,852,393,BG)
        if kind == 'overhead':
            base['overhead'](a)
        else:
            base['perspective'](a)
        controls(a,kind=='spin')
        if kind == 'spin':
            spin_panel(a)
    a.rect(.5,.5,851,392,None,22,'#3C5546',lw=1)


if __name__ == '__main__':
    screens = [
        ('overview','俯视 · 全局判断','overhead'),
        ('first-person','第一人称 · 同一套操作位置','first'),
        ('spin','打点 · 局部操作替换','spin'),
    ]
    for name,title,kind in screens:
        c=canvas.Canvas(str(tmp/(name+'.pdf')),pagesize=(852,393))
        c.setTitle(title)
        c.setAuthor('Cocos Billiards')
        art=Art(c,852,393)
        screen(art,kind)
        art.save(out/(name+'.svg'))
        c.showPage()
        c.save()
        subprocess.run(['pdftoppm','-singlefile','-scale-to','1704','-png',str(tmp/(name+'.pdf')),str(out/name)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

    pages=[
     ('整体布局 · 信息、场景、操作各归其位','俯视以完整球桌为中心。控件位置按观察与操作频率分层。', 'overhead',[
     ('身份集中到上沿','两张148×44轻量身份条保留头像、昵称、球组与剩球数。当前回合合入本人身份条，金色短线强调行动方。'),
     ('操作合成一条','微调、出杆、打点合并为224×48操作条。每项触区至少72×44，图标与文字横排。出杆使用局部金色强调，打点保持在右。'),
     ('双手分工与遮挡','左手负责操作条，右手调力度。此稿建议默认操作条置左下，暂停菜单可切换至右下。落位按袋口与轨迹检查，按下期间固定。')]),
     ('双视角 · 相同的控件坐标','切换视角时，身份、力度和操作入口保持位置。', 'first',[
     ('观察优先','第一人称场景铺满画布。母球、球杆和当前目标作为构图中心，身份贴近上沿，操作条贴近下沿。'),
     ('降低常驻信息量','暂停和视角归入左侧导航。简洁显示、左右布局与辅助说明通过暂停菜单访问。力度百分比始终可读。'),
     ('尺寸与状态','三操作触区依次72×44，底部操作条外框224×48。图标18、标签12。方向、力度和确认打点在220ms触球关键帧统一提交。')]),
     ('临时面板 · 接续当前操作','打点面板承接操作条所在侧，完成后恢复相同位置。', 'spin',[
     ('单一编辑区域','打开打点后收起底部操作条，在同侧显示258×304面板。保留球局、身份与力度的可读状态，编辑期间暂停瞄准输入。'),
     ('草稿生命周期','拖动只更新草稿，完成后应用。取消保留原值，复位仍需确认。母球图沿球杆观察方向定义高低杆与左右塞。'),
     ('本轮评审重点','确认整体分区、连续操作条、默认左侧操作及双视角一致性。具体镜头与球位遮挡需在后续交互原型中验证。')]),
    ]
    c=canvas.Canvas(str(out/'整体组件布局评审.pdf'),pagesize=(1200,900))
    c.setTitle('中式八球 整体组件布局评审')
    c.setAuthor('Cocos Billiards')
    for number,(title,subtitle,kind,copy) in enumerate(pages,1):
        a=base['doc_frame'](c,1200,900,title,subtitle,number)
        c.saveState()
        scale=1072/852
        c.translate(64,900-156-393*scale)
        c.scale(scale,scale)
        screen(Art(c,852,393),kind)
        c.restoreState()
        base['columns'](a,copy)
        c.showPage()
    c.save()
    print('Created three layout screens and a three-page review PDF.')
