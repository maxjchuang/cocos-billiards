# 放大窗袋口避让验收

2026-10-23；基线fb77515，设计补充见docs/design/magnifier-placement.md。

- acceptance.json：106项Node测试、Web Mobile成功构建（退出36）、三个手机画幅和缩小嵌入画幅的DOM触摸、81项界面回归与本机性能。
- creator-native.json：Creator从Main场景Play后，45项引擎触摸专项检查通过；不是DOM或硬件触屏认证。
- 393x852.png：瞄准右下角袋并展开微调，放大窗移动到左侧安全区域，六袋均可见。
- 320-aim.png：短屏采用96宽的紧凑放大窗。
- 320-fine.png：短屏展开微调无安全位置时收起窗口，优先保留袋口。

专项脚本scripts/preview-magnifier.js逐一瞄准六袋，每袋7项，另有打点弹层/设置关闭/触摸取消3项，共45项。检查的是实际Mask四角投影，不只检查候选bounds。默认用Web Mobile模块路径；原生Creator可传geometryModule，使用当前项目的BilliardsTableGeometry.ts在编辑器import-map中的文件URL（不将本机路径写入仓库）。测试会重置球局。

安全区为运行环境默认值，本轮专项不替代上轮安全区/15状态全量截图认证。真机与微信相关仍按用户要求跳过。实际扬声器听感、实体振动与真实后台没有新增认证。此前原生调试连接失败和探针模块路径错误不混作游戏运行错误；正确映射后的45项与错误收集单独留档。
