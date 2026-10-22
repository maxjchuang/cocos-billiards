# V1.13本机验收证据

2026-10-23；Cocos Creator 3.8.7 Web Mobile，Chromium156，合成DOM触摸。不会认证手机硬件。项目入口和状态以docs/technical/execution-plan.md为准。

- acceptance.json：99项Node测试、CLI构建结果、各画幅浏览器流程、S01–S15投影测量、性能、10FPS和旋转报告。反馈12项包含不支持音频解锁时不阻断触摸。
- S01.png–S15.png：393×852 DPR2、安全区47/34的同状态引擎截图；contact-sheet.png为总览。
- reference-S01.png：相同Chromium/字体/画幅的SVG截图；包含宿主示意，其状态栏、胶囊、底部指示条不属于游戏实现对照区域。
- pixel-metrics.json：S01六处文字的字形墨迹范围（目标色阈值18/255）、六种纯色中心采样；不宣称整图栅格逐像素相同。
- landscape-blocked.png：横屏阻挡状态。旋回竖屏后需要明确继续，球局和力度保留。

## 复现

先按README使用Creator3.8.7构建并启动本机预览，浏览器启用手机设备和触摸模拟再刷新，等待Main加载。开发脚本会重置球局，不在进行中的对局运行。依次加载scripts/preview-smoke.js、preview-spin.js、preview-browser-validation.js、preview-pockets.js、preview-plan.js、preview-scenarios.js到开发控制台，函数不会加入正式游戏构建。

执行previewSmoke()、previewSpinSmoke()、previewBrowserValidation()、previewPlan()、previewFeedbackAndReduced()、previewControlledRound()、previewPockets()、previewBrowserLifecycleEvents()、previewUiResolutionProbe()，均返回命名检查。previewLayoutAcceptance({top:47,bottom:34})会验证15状态的触区与边界，参考画幅还验证冻结尺寸；附加画幅见acceptance.json profiles。

previewScenario('S01')至'S15'会设置固定昵称、球位、状态和安全区，供截图对照；结束运行previewScenarioRestore()恢复安全区服务、设置和初始球局。球位夹具及SVG哈希保存在validation/fixtures-s01.json。previewPerformance()记录普通/放大各3秒与50次菜单往返。低帧率用引擎game.frameRate=10后执行previewContactProbe()，必须在finally恢复原帧率。

原生Creator GUI复验仍被系统锁屏阻止；Q04只完成CLI导入/构建与浏览器运行部分。真实手机和微信构建/开发工具/真机为用户明确豁免。真实后台、实际扬声器听感、实体振动、设备安全区与Safari未认证；本机性能不推广到设备。
