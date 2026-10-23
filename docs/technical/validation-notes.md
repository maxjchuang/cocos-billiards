# 最新补充：放大窗避让袋口（2026-10-23）

106项Node测试与类型检查通过，Creator Web Mobile构建退出36。320×568 DPR1、393×852 DPR2、430×932 DPR3、179×390 DPR2缩小呈现各45项专项和81项界面回归通过；实际Mask四角投影验证与所有袋口12px禁入区不相交。短屏拖动使用96宽窗口，展开微调无安全位置时暂时隐藏，不遮挡袋口。Creator从Main重新Play后45项引擎触摸专项通过。浏览器与原生正确映射后的游戏error/rejection收集均为空。

本机普通/放大瞄准各3秒约60 FPS，P95分别17.7/18.7ms，50次菜单往返组件365不增长。专项脚本与范围见[validation/magnifier](../../validation/magnifier/README.md)。初次原生探针沿用Web Mobile chunk路径导致导入失败，改用编辑器import-map文件URL后通过；不作为游戏异常。源码避免Set展开，防止Creator的loose转译把集合变成单项数组；Node测试不足以替代这次实际引擎回归。

以下为完整UI/UX基线的历史记录，不以新专项替代历史安全区和设备范围。

# 最新：完整UI/UX验收（2026-10-23）

最新结果以[execution-plan.md](execution-plan.md)、[机器报告](../../validation/ui-complete/acceptance.json)与[截图总览](../../validation/ui-complete/contact-sheet.png)为准：100项Node检查、Web Mobile构建及浏览器回归通过；计划27项通过、Q05真机与微信相关用户豁免。下文旧横屏问题已由竖屏阻挡策略替代，局部放大/音效/振动与完整状态已实现，不再是当前缺失。

参考393×852 DPR2、安全区47/34：56项布局、35项原对局、28打点、17异常输入、81完整方案、12反馈、14完整受控球局、28袋口、3分辨率通过。附加320×568 DPR1（0/0）、430×932 DPR3（59/34）、393×852 DPR2（59/34）各有17输入、81方案、45布局、9触球检查。15状态固定截图可通过preview-scenarios.js复现。

真实viewport横竖旋转、横屏DOM触摸阻挡和旋回球局/力度保留通过；10 FPS逐帧9项通过。模拟Cocos前后台事件7项通过，真实操作系统后台不认证。音频解码与AudioSource播放状态、触球事件和关闭即停有检查，未认证实际扬声器听感；振动受控适配器检查不等于实体震动认证。

本机Chromium普通与放大瞄准约60FPS，P95分别18.2/18.2ms，50次菜单往返组件365不增长；无新warn/error/unhandledrejection。历史undefined rejection根因仍未知。Creator CLI成功退出36后有既有编辑器window.json恢复缓存报错，未将其计为游戏异常。原生GUI已从Creator打开Main并Play，81/35/28/9项引擎触摸检查通过，证据见creator-native.json/png。

下文保留历史验证范围，不能用其旧计数覆盖本轮结果。

# 浏览器自动验证记录

代码基线 `19d06fd`。使用 Chromium 打开 Cocos Web Mobile 构建，通过合成 DOM TouchEvent 进入实际页面监听、Cocos输入、物理、裁判与绘制循环。未使用微信开发者工具；没有修改游戏assets源码。完整数据见 [browser-validation.json](../../validation/browser-validation.json)。

## 画幅与流程

| 逻辑尺寸 | 设备DPR | 通过项 |
| --- | --- | --- |
| 320×568 | 1 | 对局35、打点旋转28、异常输入/布局17、逐帧9 |
| 360×640 | 2 | 异常输入/布局17、逐帧9 |
| 393×852 | 2 | 对局35、打点旋转28、异常输入/布局17、逐帧9 |
| 430×932 | 3 | 对局35、打点旋转28、异常输入/布局17、逐帧9 |
| 768×1024 | 2 | 异常输入/布局17、逐帧9 |

DPR3模拟中Cocos将渲染DPR限制为2，坐标仍正确。竖屏主要按钮高48逻辑像素；320短屏面板说明未与底部按钮重叠。另有81项逻辑/组件检查通过。

异常输入包括第二根手指取消、首指拖动、力度越界、按钮外抬手、触摸取消、打点径向约束、遮罩不穿透、微调±5°边界、暂停及取消重开。额外13项完整球局通过：弱开球、接手自由球、选组、实际进袋清完9–15、单独进8获胜、再开局。为隔离流程，每杆布置了受控目标球位，不是自然球阵的AI比赛。

## 低帧率与生命周期

6倍CPU降速下9项触球检查通过。进一步真正限制引擎为10 FPS，记录11个绘制帧，触球前2帧母球静止，首次运动与逻辑220ms触球姿态同帧；该帧实际约点击后300ms绘出。帧率限制不能保证墙钟220ms绘出新帧，但不会让母球先动再补播触球。帧率已恢复60。

通过DOM按钮与显式Cocos EVENT_HIDE / EVENT_SHOW完成7项恢复检查：触球前取消、隐藏静止、显示后明确继续、触球后冻结并恢复原杆。真实页面切换尝试中，自动化仍将两个页面报告为visible，未产生visibilitychange；因此不能将模拟事件的通过当成真实后台认证。

## 控制台与范围

新导航后控制台错误/告警、window error、unhandledrejection和失败资源均为0。补齐本地预览favicon，/favicon.ico返回200 image/svg+xml；编码目录越界请求仍为403。历史undefined rejection本轮未复现，但根因仍未定位。

仅覆盖Chromium合成DOM触摸，不代表真实硬件触屏、Safari/Firefox、真机性能、设备安全区或真实后台切换。尚未实现的局部放大、音效、振动未计入通过项。此前Creator检查仍为独立证据，本轮重点补充浏览器链路。

## 横屏已知问题

额外852×393检查发现两项问题，按先保留可用版本、其余问题后续迭代的决定记录，本轮未修改游戏布局。

| 编号 | 实际观察 | 状态 |
| --- | --- | --- |
| LANDSCAPE-TOUCH | 三个主按钮高约33.21逻辑像素，小于44要求 | 待后续修正 |
| LANDSCAPE-SPIN | 说明超出面板底部13像素，摘要与完成按钮重叠 | 待后续修正 |

现有设计参考为竖屏。后续需明确竖屏策略，或提供横屏独立布局与可滚动打点内容。横屏不能列为通过的适配目标。

## 图像与复验

[320短屏](../../validation/browser-320x568.png)、[393主界面](../../validation/browser-393x852.png)、[430长屏](../../validation/browser-430x932.png)、[横屏问题](../../validation/browser-landscape-issue.png)。

启用浏览器手机与触摸模拟，等Main场景启动完成，在开发控制台加载仓库脚本。测试会重置当前球局，勿在进行中的对局使用。

```js
// scripts/preview-smoke.js
previewSmoke({inputMode:'dom'}).then(console.log).catch(console.error)
previewContactProbe({inputMode:'dom'}).then(console.log).catch(console.error)
// scripts/preview-spin.js
previewSpinSmoke({inputMode:'dom'}).then(console.log).catch(console.error)
// scripts/preview-browser-validation.js
previewBrowserValidation().then(console.log).catch(console.error)
previewBrowserLifecycleEvents().then(console.log).catch(console.error)
previewControlledRound().then(console.log).catch(console.error)
```

## 手机 UI 文字采样修复（2026-10-21）

用户真机反馈按钮等 UI 文字模糊。引擎检查确认：HUD 相机按逻辑像素显示，但设计分辨率仍是 960×640，系统字体纹理使用 `view.getScaleX()` 采样。在 393×852、DPR 2 下，文字采样比例仅 0.81875，随后被相机放大。

现将设计分辨率与 HUD 逻辑尺寸同步，使用 EXACT_FIT，使文字采样比例等于引擎渲染 DPR；尺寸或 DPR 变化时刷新已有文字纹理。保留现有 UI 几何尺寸、命中区域与引擎 DPR 上限 2，未提高整幅 3D 画面的像素预算。

验证：81 项 Node 测试通过，Creator 3.8.7 Web Mobile 构建成功（退出码 36）。393×852 DPR2 下，文字纹理采样比例为 2，标题纹理宽度从 201 提高到 402；17 项 DOM 输入/布局、35 项对局、28 项打点检查全部通过，已人工查看浏览器截图。320×568 DPR1、430×932 DPR3（引擎仍为 2）分别通过 17 项输入/布局检查与 3 项分辨率检查；不刷新切回 393×852 后的分辨率检查也通过。

在 Console 加载 `scripts/preview-browser-validation.js` 后可执行 `previewUiResolutionProbe()`。结果见 `validation/ui-resolution-check.json`。以上自动检查使用 Chromium 模拟。用户已在手机刷新后反馈“检查通过”，记录为本次 UI 清晰度的真机手动复核，未记录设备型号及浏览器；未执行新的微信导出或开发者工具验证，横屏已有布局问题也不属于本次修复。

## V1.12 新袋口运行复验（2026-10-22）

89项类型/Node检查通过；新几何覆盖六袋近袋低速及满力、袋前不提前捕获、擦袋角弹开、净空不足拒绝、力度不足停在袋前、非法摆球、预测首次边界与真实事件一致。旧用例中“球在台面边缘即进袋”的前提已迁移到落袋代理面，并补充不提前捕获的反例。

Creator 3.8.7 Web Mobile构建退出36。最终包在Chromium 393×852 DPR2通过：17项输入/布局、35项对局、28项打点、28项袋口/网格/六袋帧循环、3项文字DPR、9项触球时序，以及13项受控完整球局。首次移动仍在逻辑220 ms触球帧，触球一次。320×568 DPR1与430×932 DPR3分别通过17项输入、28项袋口、3项文字及9项时序；DPR3引擎仍按2渲染。

六袋专项以受控初速度驱动真实Cocos更新和绘制，覆盖0.3 m/s近袋与4 m/s射入，以及球体/号码同步隐藏；不是触摸输入替代品。原DOM回归另行覆盖按钮出杆、进袋、裁判、打点和暂停。完整球局也使用受控目标球位，非自然球阵的自动清台。

新导航页面error/unhandledrejection为空，浏览器Console错误和警告均为0。截图与原始结果见`validation/pocket-geometry-browser.png`和`validation/pocket-geometry-check.json`。构建后编辑器window.json恢复仍有缓存报错；本轮没有重新操作原生Creator预览。手机、微信及真实袋口手感尚未复核，早期用户手机通过反馈不自动覆盖这次改动；历史横屏问题仍保留。
