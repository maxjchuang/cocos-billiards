# V8球桌模型接入方案

2026-11-08。造型基准已由用户确认，V8派生资源已接入游戏，软件范围内的实施与验证完成。模型造型确认、运行证据和真实设备范围分别记录。

## 1. 权威资源与完成状态

| 内容 | 基准 | 状态 |
| --- | --- | --- |
| 可编辑母版 | [Blender模型](../design/table-model/chinese-pool-table.blend) | 用户确认V8造型 |
| 可交换资源 | [GLB](../design/table-model/chinese-pool-table.glb) | 同一母版导出 |
| 参数及材质 | [model-spec.json](../design/table-model/model-spec.json) | sketch-matched-legs-v8 |
| 文件指纹与审查 | [model-validation.json](../design/table-model/model-validation.json) | 几何、模型浏览器与278项Node记录 |
| 正交腿型 | [轮廓图](../design/table-model/leg-profile.png)、[草图采样](../design/table-model/leg-profile-reference.json) | 主体14处相对宽度误差约3.1% |
| Cocos资产导入及可玩接入 | assets/resources/models/table-v8/table.glb | 已接入，软件验证通过 |
| 真实手机、微信小游戏 | 沿用用户豁免范围 | 跳过，不计作通过 |

执行前核对指纹。V1至V7、旧AI概念图及结构简图作为历史记录。新增派生资源记录母版版本、导出设置和简化方式。Main场景、已有脚本与资产的.meta UUID保留。

## 2. 造型及坐标约束

外廓1.54×2.82×0.85m，台面1.26×2.54m，台呢高度0.80m。球径0.05715m。公开整体比例与本游戏拟合细节在参数表中分别注明。

六条腿采用圆形主体和圆角方形上连接段。连接段150×150×160mm，在桌裙下露出85mm；主体离地75至475mm，最大直径166mm，最粗位置410mm；脚座直径92mm、高25mm。上下收口独立可辨，主体两侧连续外凸。完整高度轮廓与14处宽度共同验收，避免只按最大直径缩放。

Blender母版采用Z向上。现有GLB已变换为Y向上，模型中心沿长边为Z，台呢面Y=0.80m。现有游戏物理在XZ平面，台面Y=0。

- 从Blender坐标转换为游戏坐标使用 `(x, z-0.80, -y)`。
- 从当前GLB导入结果接入时，仅在确认导入器输出为该Y向上坐标后，将桌体根节点平移Y=-0.80m。单位缩放为1。
- 通过台面中心、四角、六袋、参照球和外廓实测确认轴向与单位。禁止同时重复旋转坐标及套用偏移。
- 参照白球和评审相机、灯光不进入正式桌体实例。正式球位由权威球局驱动。

## 3. Cocos资源路径与职责

优先将GLB通过Creator资产导入流程转为引擎资源，再组织成独立桌体Prefab。Creator 3.8官方文档支持FBX和glTF模型导入，具体GLB、法线、UV与材质兼容性须在本工程验证。[官方模型资源说明](https://docs.cocos.com/creator/3.8/manual/zh/asset/model/mesh.html)

实际资源目录为 `assets/resources/models/table-v8/`，资产和材质使用稳定.meta。若导入器不能完整迁移材质，在Blender母版导出受控的glTF/FBX派生文件，并在Creator重建材质。发布包使用Creator导入后的本地资产。

| 现有模块 | 接入职责 |
| --- | --- |
| BilliardsTableView | 管理新桌体实例、可见性、局部贴库处理及资源释放，逐步替换当前程序化表现网格 |
| BilliardsTableGeometry | 持续提供球台物理边界、开口、摆球与预测查询 |
| BilliardsGame | 将权威球位及阶段传入表现层，保留原触摸与击球提交入口 |
| BilliardsCameraRig | 从新桌体范围约束观察位置，维持自由镜头、回到出杆位与摆球观察 |
| BilliardsPocketAnimation | 捕获后驱动球体下沉与遮挡，末球下落完成再结算 |

资源按台呢、胶边、木帮、桌裙、皮口、内衬、桌腿和脚座区分。受贴库观察影响的木帮与胶边必须保留可单独处理的范围，不能合并成无法局部遮挡处理的整桌网格。普通桌腿等静态部件可共享网格和材质。

## 4. 视觉边界与物理边界对齐

当前评审母版的轮廓来自Blender建模脚本，运行边界来自独立TypeScript几何，接入前须检查两者的差距。

1. 导出台面中心、六袋局部坐标、净口及胶边鼻口轮廓，转换到同一游戏坐标。
2. 用运行时几何轮廓叠加实际模型，逐点检查开口、库边、支承区域和球半径。位置误差目标为1mm以内。
3. 若不一致，在派生视觉网格中对齐共享几何并保持已确认的可见曲率和层次。任何影响击球、净口、捕获和合法摆球的冲突均记录具体位置、误差和处理方式。
4. 物理变更需单独形成规则及回归项后再实施。模型导入阶段保持球球/碰库求解、裁判、AI、预测、随机种子和220ms唯一提交的既有行为。
5. 六袋各检查慢速、高速、擦袋角、袋前停球和白球落袋。单次捕获与空间下落时序都须成立。

## 5. 材质、袋口和观察兼容

材质以model-spec.json为视觉参考，在Creator固定曝光下分别调校。木纹采用已署名CC0扫描图并保留顺纹UV；腿身和脚座共用较哑光的胡桃木材质。Blender漆层、纹理乘色和glTF扩展转换差异须逐项核对。数据值相同不能代替画面对照。

皮口厚3mm及封闭端面、袋壁上沿801mm、与台呢/石板切面分离、胶边底部埋入台呢4mm，均为母版拟合。外片与桌裙贴合间距不超过1mm。角袋85mm、中袋82mm为现有游戏候选配置。

低位观察时使用深度遮挡与接触阴影。贴库局部半透明沿新网格重新实现，观察权限与规则阶段分别管理。回到出杆位、双指环绕、暂停及运动中的观察流程均需回归。

## 6. 移动端派生资源

当前GLB为评审母版，浏览器统计193940个三角形、173个网格实例；它们属于几何统计，不等同于实际绘制批次或性能结论。

首轮优化目标为常用画面桌体不超过8万三角形、桌体绘制不超过30批、桌体纹理显存不超过32MiB。上述为待实测的工程目标，未取得手机性能认证。优先共享桌腿网格、合并同材质静态部件和按观察距离简化缝线。保留近袋轮廓、皮口厚度、腿型分段及贴库处理能力。

记录导入后顶点、批次、贴图格式/尺寸、GPU纹理占用及截图。桌腿64段为母版设置，派生段数可在轮廓验收通过后降低。降低细节后须重新运行轮廓、开口及近景对照。避免只为达到批次目标合并全部桌体，造成贴库处理失效。

## 7. 实施顺序与明确完成标准

| 项目 | 工作 | 可验证的完成标准 | 当前状态 |
| --- | --- | --- | --- |
| M01 基准冻结 | 指纹、参数、资源、许可证登记 | Blender/GLB指纹与当前model-validation.json一致；文档显示V8已确认 | 已提交bb179da |
| M02 Creator导入 | 导入、单位、坐标与材质迁移 | 原生Main及Web Mobile均可见完整六袋六腿；尺寸误差≤1mm；无丢材质、反法线或重复参照球 | 软件验证通过 |
| M03 表现替换 | 台呢、木帮、桌裙、腿、皮口和袋壁 | 固定高位、低位、角袋、中袋、木帮、腿、外裙七机位可与母版对照；原桌体无重复渲染 | 软件验证通过 |
| M04 轮廓与接缝 | 模型与共享运行几何对齐 | 六袋开口/鼻口位置误差≤1mm；无破面/闪烁/透底；外片间隙≤1mm；腿型14处宽度误差≤最大宽度4% | 软件验证通过 |
| M05 交互和下落 | 自由镜头、贴库、触摸、捕获后表现 | 摆球/瞄准/AI/出杆/运动/暂停/结果均可观察；六袋连续帧下落与结算通过；220ms触球仅提交一次 | 软件验证通过 |
| M06 性能和生命周期 | 派生资源、批次、纹理与释放 | 输出统计并与本节目标对比；20次重开/进出场无实例累积；固定画幅同状态截图无轮廓退化 | 软件验证通过 |
| M07 回归与证据 | 检查、构建、引擎与浏览器 | npm run check通过，Creator构建、原生预览和Web Mobile分别保存版本/日志/截图；真机/微信标记跳过 | 软件验证通过 |

## 8. 复核命令

```sh
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/check-table-pockets.py
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/check-table-legs.py
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/render-table-leg-profile.py
npm run check
```

设计母版已确认；真实三维弹袋、袋内多球碰撞、皮网形变、实物手感标定与赛事流程仍按既有未实现边界记录。

## 9. 2026-11-08实施记录

实现位于BilliardsTableView、BilliardsGame及BilliardsViewGeometry。通过Creator导入本地派生GLB，沿用资源子Prefab路径 `models/table-v8/table/table`，根节点Y偏移-0.80m。初始化失败时显示加载失败提示。评审参照球由派生导出移除。

`build-game-table.py`从确认母版生成游戏资源。`export-table-geometry.cjs`读取同一纯TS运行几何，台呢、石板和袋壁按共享开口生成，胶边接触线对齐运行轮廓。简化时保留接触线顶点，导出后复核桌腿14处宽度。木帮、胶边、皮口分别按材质合为可局部裁分的网格组，下部固定构件另行合批。

贴库时在桌体根坐标中裁分真实模型三角形，插值UV和法线，仅对20cm局部使用半透明材质实例。父节点变换在裁分前抵消，回到普通位置释放临时网格和节点。当前程序化旧桌体节点在游戏帧保持禁用。

Creator 3.8.8不支持母版的KHR_materials_clearcoat与KHR_materials_specular扩展。派生文件移除这两项扩展，木面漆层用标准PBR近似，台呢显式设置specularIntensity=0.08。确认母版保留原材质，资源兼容策略记录在table-model-asset.json。

| 实测项 | 结果 |
| --- | --- |
| 引擎桌体三角形 / 网格 | 55414 / 12 |
| Blender派生三角形 | 55415，导入后差1个三角形 |
| 桌体、地面与阴影通道绘制 | 隔离测量24次，排除球和HUD |
| 桌体纹理GPU分配 | 13981008字节，约13.3MiB |
| 简化后腿型相对宽度误差 | 约3.07%，限值4% |
| 胶边接触线偏差 | 最大约0.00012mm，限值1mm |
| 序列化GLB外片/桌裙间隙 | 最大约0.934mm，限值1mm |
| 完整桌体创建/销毁 | 2次预热后20次，GPU缓冲占用稳定 |

证据入口为[验收记录](validation/table-v8/README.md)和[汇总](validation/table-v8/summary.json)。三种横屏Web Mobile、桌面开发预览及Creator工程预览分别通过180项专项。手势与220ms触球检查分别记录。原生窗口从Main启动编辑器内预览并观察启动画面，交互专项采用工程预览手机模拟与组件入口。真实手机及微信专项沿用用户豁免。

复建游戏资源与接缝审查使用以下命令。

```sh
node scripts/export-table-geometry.cjs
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/build-game-table.py
blender --background --factory-startup --python scripts/check-game-table.py
```

拉远验收补充。渲染远裁剪面调整为8m，地面覆盖宽度24m。180项专项包含4.5m环绕距离下的桌体八角深度检查，确保远端桌框和桌腿完整显示。

## 2026-11-09 袋口前缘落地修正

直线捕获边界曾直接成为可见切口，现使用V8风格的前后圆弧轮廓共同重建台呢、石板和内衬，前缘64点，台呢0.8mm倒角。首次入袋射线与支撑查询均按曲线计算。当前派生资源Blender 58087三角形，引擎58086三角形、12网格，接触鼻线最大偏差仍约0.00012mm，腿型拟合误差约3.07%。序列化前缘偏差约0.243mm，桌裙间隙约0.934mm。

296项Node、Creator构建、浏览器和工程预览各115项袋口专项、52项触摸回归通过。较早V8资源指标按原日期保留。当前资产指纹在table-model-asset.json，完整验证见[袋口曲线记录](validation/pocket-curves/README.md)。

```sh
node scripts/export-table-geometry.cjs
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/build-game-table.py
blender --background --factory-startup --python scripts/check-game-pocket-curves.py
blender --background --factory-startup --python scripts/check-game-table.py -- docs/technical/validation/pocket-curves/asset-seam.json
```
