# 未通过及被替代证据

- M0-initial.png：标准受光Effect未随导出打包，已用resources材质显式引用修复。
- M0-lit.png：按HDR照度用于LDR导致过曝；最终按实际管线选照度。
- paired-shots-1/2.json：较早fixture和断言版本的历史结果；以根目录完整16组报告为准。
- performance-before-scheduling.json：满球阵高力度、每500ms改线，三个预测片段P95约38–40ms未达标。最终增加密集球阵输入稳定等待，并新增静止预测采样，保留失败记录。
- 原生手动刷新预览页面曾触发Creator SceneFacadeManager IPC错误。恢复需要重启编辑器和Play，不使用location.reload刷新嵌入页面。
