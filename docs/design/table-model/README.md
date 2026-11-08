# 中式台球桌三维评审模型 V8

2026-11-08。用户已确认V8模型为开发与设计执行基准。模型以米为单位，同一Blender场景导出GLB与七个观察机位，另提供单腿正交轮廓图。游戏接入待实施，步骤和验收见[技术方案](../../technical/table-model-integration.md)。

当前参数及材质见model-spec.json，资源指纹见model-validation.json。下方V2至V7章节保留历史演进，当前造型按V8执行。

## 查看

启动本机预览后打开 <http://127.0.0.1:8877/>。拖动旋转，滚轮缩放，触屏双指缩放和平移。顶部可切换整体、低位、木边、桌腿、角袋和中袋，底部可查看线框和57.15mm参照球。

```sh
python3 -m http.server 8877 --bind 127.0.0.1 --directory docs/design/table-model
```

## 模型文件

- [通用GLB模型](chinese-pool-table.glb)，包含几何、法线、UV和内嵌材质贴图。
- [Blender可编辑源文件](chinese-pool-table.blend)，包含模型、灯光与观察相机。
- [参数表](model-spec.json)，记录单位、尺寸、候选袋口、材质与机位。
- [整桌](overview.png)、[低位](aiming.png)、[角袋](corner.png)、[中袋](side.png)和[木边](wood.png)均由此模型渲染。

## 尺寸与造型状态

外廓2820×1540×850mm，有效台面2540×1260mm，六袋、六腿。白球直径57.15mm，用于观察袋口与球径关系。整桌和台面尺寸参考 [JOY Q8 Pro公开资料](https://www.joybilliard.com/billiards-table/golden-leg-billiards-tables.html)。

角袋85mm、中袋82mm为当前候选净口。胶边鼻口距台呢34mm、台呢离地800mm、袋内下落空间185mm以及袋角曲率均属于本轮造型选择，模型参数表明确列为设计拟合。具体厂家剖面、袋喉和石板缺口仍待核验。

模型将木扶手、桌裙、胶边包布、皮口、袋内壁、桌腿和金属脚套拆成独立部件。胶边沿连续的平面袋角曲线扫掠，石板与台呢具有实际袋口开孔。所有视角共用相同几何与材质。后续按用户的模型评审意见继续调整。

## 复现

安装Blender 4.5后，在仓库根目录运行以下命令。模型与渲染图会更新到本目录。

```sh
blender --background --factory-startup --python scripts/build-table-model.py
```

浏览器预览使用本地打包的Three.js 0.180.0，许可证见 [THREE-LICENSE.txt](THREE-LICENSE.txt)。GLB和Blender包含本地材质贴图。胡桃木木纹采用Poly Haven的CC0素材，布面和皮革由建模脚本生成。[材质来源](MATERIAL-CREDITS.md)。预览入口与模型文件在本地服务器读取。

预览构建工具安装到被忽略的本机目录。

```sh
npm install --prefix tmp/model-tools/viewer --no-audit --no-fund three@0.180.0 esbuild@0.25.10
./tmp/model-tools/viewer/node_modules/.bin/esbuild scripts/table-model-viewer.js --bundle --format=iife --outfile=docs/design/table-model/viewer.js --alias:three/addons=./tmp/model-tools/viewer/node_modules/three/examples/jsm --alias:three=./tmp/model-tools/viewer/node_modules/three/build/three.module.js --minify --legal-comments=eof
```

## 木边修订 V2

依据乔氏实拍调整木帮与皮口衔接。六段独立木帮在皮口处收口，长短边分别沿构件长度取样木纹。木面宽95mm、包布后部宽45mm为照片对照后的视觉拟合。木纹采用CC0的American Walnut Veneer，在材质中叠加暖棕染色与漆层，漆层权重0.28、粗糙度0.18，基材粗糙度0.25。预览新增木边近景入口。

## 桌腿修订 V3

六条桌腿采用带肩部的八面切面与向下收腰，最大肩宽232mm，顶部通过独立安装座连接桌裙。底部为贴合腿型的圆角方形香槟铜色脚套，厚25mm，下方为薄型接地垫。腿身横向轻微外展18mm，端部腿纵向外展12mm。桌腿采用哑光程度更高的胡桃木漆面，近景与整桌共用同一模型。预览新增桌腿入口。上述尺寸和轮廓为本轮评审造型拟合，参考JOY公开的钻石腿方向。

## 袋口表面修订 V4

胶边鼻部偏移按弯曲半径限制，背部独立三角化并与鼻部合并为封闭实体，避免在急弯处自相交，底面埋入台呢4mm。袋口内衬改为封闭杯形体，与台呢和石板切面分离，袋壁上沿衔接皮口，遮住后方桌框。皮口上盖具有3mm厚度及封闭端面，外侧包片独立贴合桌裙外轮廓，外表面预留约0.6mm贴合余量。中袋和角袋预设改为台面内侧观察，另提供 [外侧接缝检查图](skirt.png)。

生成模型时会先检查袋口自相交、开放边、内衬重合面和外片贴合距离，检查通过后导出GLB。可在Blender中单独复核现有模型。

```sh
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/check-table-pockets.py
```

## 圆腿修订 V5

六条桌腿改为圆形截面，径向64段并平滑着色。保留肩部和下段收腰，最大肩径232mm、底部直径120mm，安装座同步改为直径210mm圆座。脚套为直径134mm、高25mm的香槟铜色圆形套，底部为直径128mm薄型接地垫。材质沿用哑光胡桃木。上述尺寸为本轮造型拟合，参数表按高度和直径记录。

## 车枳圆腿修订 V6

按[已确认草图](turned-leg-approved.png)调整圆腿。主腿身从高度75mm延伸至560mm，最大直径216mm，最粗位置位于离地440mm处。两侧轮廓采用连续外凸曲线，向下平顺收细。上下增加简洁环形收口，脚座改为直径130mm、高25mm的胡桃木圆脚座，下方为薄型深色接地垫。安装座直径190mm。数值为本轮草图落模的设计拟合。

新增 `scripts/check-table-legs.py` 检查六腿圆形截面、封闭边、最粗位置及主体曲率。主体半径沿高度的斜率须连续递减，以避免出现向内凹的收腰。草图由内置图像生成工具制作，作为轮廓评审依据，三维模型由Blender脚本生成。

## 圆腿比例修订 V7

V6主腿身485mm、最大直径216mm，中下段体量偏大。V7将最大直径修正为174mm，主腿身长径比约2.79；最粗位置保持离地440mm。下段采用更缓和的外凸曲线，保持全段无内凹。脚座直径104mm，安装座直径164mm。数值为确认草图的比例拟合。

增加[单腿正交轮廓图](leg-profile.png)，由实际模型渲染，以排除透视造成的比例误判。可用以下命令重建。

```sh
blender --background docs/design/table-model/chinese-pool-table.blend --python scripts/render-table-leg-profile.py
```

## 确认稿轮廓对齐 V8

V7将主腿身与连接段的占比分配错位，连接段和上收口藏入桌框，主体露出过长。V8按确认稿左侧放大图逐段取样。主腿身高度400mm、最大直径166mm，最粗位置约位于主体自上向下16%处，离地410mm；下端直径64mm。上部采用150mm宽的圆角方形连接段，在桌裙下露出85mm，上收口可见。脚座直径92mm。具体毫米数为在850mm桌高内还原草图比例的拟合值。

[草图轮廓采样](leg-profile-reference.json)记录沿主体高度的14个相对宽度。模型检查直接对比这些采样，允许误差为最大宽度的4%，同时保留全段外凸检查。正交图用于核对整条腿的连接段、收口、主体和脚座。
