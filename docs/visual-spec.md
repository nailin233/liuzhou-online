# 网上柳州 · 视觉规范

## 文档状态
- 版本：v1.0
- 更新日期：2026-11-22
- 状态：**设计规范** — 本文档为实现者和评审者提供视觉标准

---

## 1. 设计原则

### 1.1 核心理念
网上柳州采用**简约工业风格**（Minimalist Industrial），强调：
- **真实性优先**：真实地理数据 > 视觉美化
- **信息清晰**：功能信息 > 装饰元素
- **性能优先**：移动端流畅 > 高精度渲染
- **可访问性**：支持色盲模式、高对比度

### 1.2 视觉关键词
- 精确 (Precise)
- 科技感 (Technical)
- 克制 (Restrained)
- 功能性 (Functional)

---

## 2. 色彩系统

### 2.1 主色板
```css
/* 背景与环境 */
--color-sky: #101820;           /* 天空/背景 */
--color-ground: #17232c;        /* 地面 */
--color-fog: #101820;           /* 雾效（同背景）*/

/* 建筑白模 */
--color-building-primary: #3e8f91;   /* 青绿色主色调 */
--color-building-highlight: #5aafb2; /* 鼠标悬停高亮 */
--color-building-shadow: #2d6a6c;    /* 阴影侧面 */

/* 道路与线条 */
--color-road-major: #6b8e95;    /* 主干道 */
--color-road-minor: #4a6570;    /* 次干道/支路 */
--color-grid-major: #284454;    /* 网格主线 */
--color-grid-minor: #203340;    /* 网格次线 */

/* UI 与文字 */
--color-text-primary: #edf4f5;  /* 主文字 */
--color-text-secondary: #afc4cb;/* 次要文字 */
--color-accent: #8ad2c8;        /* 强调色（青色） */
--color-warning: #d4a373;       /* 警告色（琥珀） */
--color-error: #c45c5c;         /* 错误/缺失数据 */
```

### 2.2 色彩使用规则

#### 建筑
- **默认状态**：`--color-building-primary` (#3e8f91)
- **鼠标悬停**：亮度提升 15%，过渡时间 150ms
- **缺失高度数据**：降低不透明度至 0.7，添加虚线轮廓
- **阴影面**：使用 Three.js 的 `MeshStandardMaterial` 自动计算明暗

#### 道路
- **高速公路/快速路**：`--color-road-major` (#6b8e95)，宽度 6 米
- **主干道**：`--color-road-major` (#6b8e95)，宽度 4 米
- **次干道/支路**：`--color-road-minor` (#4a6570)，宽度 2.5 米
- **人行道/小路**：不渲染（性能优化）

#### 网格
- **主网格线**（每 10 米）：`--color-grid-major` (#284454)，宽度 1px
- **次网格线**（每 2 米）：`--color-grid-minor` (#203340)，宽度 0.5px
- **开发模式**：显示网格；生产模式：隐藏

### 2.3 色盲友好模式
提供三种预设（通过 UI 切换）：

| 模式          | 建筑主色       | 道路色         | 强调色         |
|---------------|----------------|----------------|----------------|
| 标准          | #3e8f91 (青绿) | #6b8e95 (灰青) | #8ad2c8 (亮青) |
| 红绿色盲      | #5a8fb8 (蓝)   | #7a95aa (灰蓝) | #9bc4e8 (亮蓝) |
| 蓝黄色盲      | #c47a5a (橙)   | #aa8570 (灰橙) | #e8a47c (亮橙) |

---

## 3. 3D 场景规范

### 3.1 光照系统

#### 半球光（HemisphereLight）
```javascript
const hemiLight = new THREE.HemisphereLight(
  0xbcd2e0,  // 天空色（冷白）
  0x293744,  // 地面色（深蓝灰）
  2.2        // 强度
);
```
- 模拟环境光，提供柔和的全局照明
- 不产生阴影

#### 平行光（DirectionalLight）
```javascript
const sunLight = new THREE.DirectionalLight(
  0xffe0b5,  // 暖黄色（模拟日光）
  2.1        // 强度
);
sunLight.position.set(-10, 25, 8); // 西北偏上
```
- 模拟太阳光
- 未来启用阴影时，使用 `sunLight.castShadow = true`

#### 光照强度调整（未来）
根据时间系统调整光照：
- 白天（06:00-18:00）：强度 1.0
- 黄昏（18:00-20:00）：强度 0.6，色温偏橙
- 夜晚（20:00-06:00）：强度 0.2，启用月光（冷蓝）

### 3.2 雾效（Fog）
```javascript
scene.fog = new THREE.Fog(
  0x101820,  // 颜色（同背景）
  45,        // 近距离（米）
  115        // 远距离（米）
);
```
- 提供深度感
- 隐藏远处未加载的地图块
- 移动端可调整远距离至 80 米以提升性能

### 3.3 相机设置
```javascript
const camera = new THREE.PerspectiveCamera(
  55,    // FOV（视野角度）
  1,     // 宽高比（动态更新）
  0.1,   // 近裁剪面（米）
  250    // 远裁剪面（米）
);
camera.position.set(18, 20, 23); // 默认初始位置
```

#### 相机焦点
- **默认焦点**：地图中心 (0, 0, 0)
- **高度范围**：Y = 5m ~ 100m
- **禁止穿地**：相机 Y 坐标始终 > 地面 + 1.5m

---

## 4. 建筑白模规范

### 4.1 几何体生成

#### 标准建筑（有轮廓 + 高度）
```javascript
// 从 OSM building outline 生成拉伸几何体
const shape = new THREE.Shape(outlinePoints); // [(x,z), (x,z), ...]
const extrudeSettings = {
  depth: height,           // 建筑高度（米）
  bevelEnabled: false,     // 禁用倒角（性能）
};
const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
```

#### 缺失高度数据的建筑
- 使用默认高度（见 `game-and-map-architecture.md` 第 3.3 节）
- 在建筑顶部添加虚线边框（使用 `LineSegments`）
- 材质不透明度降至 0.7

#### 地标建筑（未来）
- 使用 GLB 模型替换白模
- 模型规范：< 5000 三角形，无纹理（仅顶点颜色）
- 示例：柳州大剧院、华侨大厦（way/205654183）、聚宝大厦（way/205654194）

### 4.2 材质规范

#### 标准材质（桌面端）
```javascript
const material = new THREE.MeshStandardMaterial({
  color: 0x3e8f91,
  roughness: 0.75,    // 粗糙表面（非光滑）
  metalness: 0.0,     // 非金属
  flatShading: false, // 使用平滑法线
});
```

#### 优化材质（移动端）
```javascript
const material = new THREE.MeshBasicMaterial({
  color: 0x3e8f91,
  // 无光照计算，性能最优
});
```

### 4.3 合并策略
- 同一地图块内的所有建筑合并为单个 `BufferGeometry`
- 使用 `BufferGeometryUtils.mergeGeometries(geometries)`
- 合并后 Draw Call 从 200+ 降至 1-2

---

## 5. 道路网络规范

### 5.1 道路类型与样式

| OSM highway 类型   | 渲染宽度 | 颜色             | 优先级 |
|--------------------|----------|------------------|--------|
| motorway (高速)    | 6 米     | #6b8e95         | 1      |
| trunk (快速路)     | 5 米     | #6b8e95         | 2      |
| primary (主干道)   | 4 米     | #6b8e95         | 3      |
| secondary (次干道) | 3 米     | #5a7a85         | 4      |
| tertiary (三级路)  | 2.5 米   | #4a6570         | 5      |
| residential (住宅) | 2 米     | #4a6570         | 6      |
| footway (人行道)   | 不渲染   | -                | -      |

### 5.2 渲染方式

#### 方案 A：LineSegments（推荐）
```javascript
const points = roadData.flatMap(road => road.points); // [(x,y,z), ...]
const geometry = new THREE.BufferGeometry();
geometry.setFromPoints(points);
const material = new THREE.LineBasicMaterial({
  color: 0x6b8e95,
  linewidth: 2, // 注意：WebGL 限制，仅 Windows 生效
});
const lines = new THREE.LineSegments(geometry, material);
```

#### 方案 B：MeshLine（宽线支持）
- 使用第三方库 `THREE.MeshLine` 在所有平台支持可变宽度
- 性能开销略高，仅在需要明确道路层次时启用

### 5.3 道路标注（未来）
- 主干道显示路名标签（使用 `CSS2DRenderer`）
- 标签仅在缩放级别 > 500m 时显示
- 字体：思源黑体 / Noto Sans CJK SC，12px

---

## 6. UI 信息层

### 6.1 页面布局
```
┌─────────────────────────────────────────────────┐
│ Header: [Logo] LZ.OL          PRE-ALPHA 0.1     │ ← 固定顶部
├─────────────────────────────────────────────────┤
│                                                 │
│   [Panel]                          [3D Viewport]│
│   LIUZHOU ONLINE                                │
│   网上柳州                                       │
│   (说明文字)                                     │
│                                                 │
│                                                 │
│                                     [Status FPS]│ ← 右下角
└─────────────────────────────────────────────────┘
   [Footer: © OpenStreetMap contributors, ODbL]   ← 固定底部
```

### 6.2 Header（顶栏）
- **高度**：72px（桌面），60px（移动）
- **背景**：半透明黑 `rgba(16, 24, 32, 0.85)`，模糊背景（backdrop-filter: blur(10px)）
- **Logo**：`LZ.OL`（Letter-spacing: 0.16em，字重 800）
- **版本号**：`PRE-ALPHA 0.1`（灰色，11px，Letter-spacing: 0.2em）

### 6.3 Panel（信息面板）
- **位置**：左上角（桌面），居中（移动）
- **最大宽度**：320px（桌面），260px（移动）
- **背景**：无（依赖半透明文字背景）
- **内容结构**：
  ```html
  <div class="eyebrow">LIUZHOU ONLINE</div>
  <h1>网上柳州</h1>
  <p>当前是工程校验场景，<strong>不是柳州真实地图</strong>。</p>
  <p class="hint">拖动旋转视角 · 滚轮缩放 · 鼠标右键平移</p>
  ```

#### 文字规范
- **Eyebrow**（副标题）：11px，青绿色 (#86b9b8)，字重 700，Letter-spacing: 0.26em
- **H1**：46px（桌面），35px（移动），字重 600，Letter-spacing: 0.07em
- **正文**：13px，行高 1.8，颜色 #afc4cb
- **强调文字**：字重 600，颜色 #e2efef

### 6.4 Status（状态栏）
- **位置**：右下角（桌面），左下角（移动）
- **内容示例**：`WebGL 正常 · 58 FPS · 测试白模`
- **字体**：12px，Consolas / Menlo / 等宽字体
- **颜色**：#86b9b8（青绿）

### 6.5 Footer（页脚）
- **位置**：固定底部
- **内容**：`地图数据 © OpenStreetMap contributors, ODbL`
- **字体**：10px，颜色 #7795a0
- **链接**：点击跳转至 `game-and-map-architecture.md#附录-a数据来源与验证记录`

### 6.6 交互热点（Hotspot）
当鼠标悬停在建筑上时：
- 建筑高亮（亮度 +15%）
- 显示悬浮卡片：
  ```
  ┌─────────────────────┐
  │ 建筑 ID: way/123456 │
  │ 高度: 14m (估算)    │
  │ 数据源: OSM         │
  └─────────────────────┘
  ```
- 卡片背景：半透明黑 `rgba(16, 24, 32, 0.9)`
- 字体：11px，行高 1.6

---

## 7. 交互规范

### 7.1 桌面端交互

#### 鼠标操作
| 操作               | 功能                 | 响应时间 |
|--------------------|----------------------|----------|
| 左键拖动           | 旋转相机（Orbit）    | 实时     |
| 右键拖动           | 平移焦点             | 实时     |
| 滚轮滚动           | 缩放（距离焦点）     | 实时     |
| 双击建筑           | 聚焦到该建筑         | 300ms    |
| 悬停建筑           | 显示信息卡片         | 150ms    |

#### 键盘操作
| 按键               | 功能                 |
|--------------------|----------------------|
| WASD / 方向键      | 平移焦点（速度 5m/s）|
| Q / E              | 左/右旋转相机        |
| + / -              | 缩放                 |
| Space              | 重置到默认视角       |
| G                  | 切换网格显示         |
| F                  | 切换 FPS 显示        |
| Ctrl+Shift+D       | 切换调试模式         |

### 7.2 移动端交互

#### 触屏手势
| 手势               | 功能                 | 响应时间 |
|--------------------|----------------------|----------|
| 单指拖动           | 旋转相机             | 实时     |
| 双指捏合           | 缩放                 | 实时     |
| 双指平移           | 平移焦点             | 实时     |
| 双击               | 聚焦到点击位置       | 300ms    |
| 长按建筑           | 显示信息卡片         | 500ms    |

#### 虚拟摇杆（未来）
- 左下角：移动摇杆（平移焦点）
- 右下角：视角摇杆（旋转相机）
- 半径：60px，不透明度 0.5

### 7.3 交互反馈

#### 加载状态
- 显示进度条：`正在加载五星街数据... 45%`
- 颜色：强调色 (#8ad2c8)
- 位置：屏幕中央

#### 错误提示
- 显示错误卡片：`数据加载失败：网络超时`
- 背景：红色 (#c45c5c)，不透明度 0.9
- 提供重试按钮

#### 成功反馈
- Toast 提示：`数据加载完成`
- 自动消失时间：2 秒

---

## 8. 响应式设计

### 8.1 断点定义
| 断点           | 屏幕宽度       | 调整内容                 |
|----------------|----------------|--------------------------|
| 桌面（Desktop）| > 1024px       | 完整 UI，60 FPS 目标     |
| 平板（Tablet） | 650px - 1024px | 缩小面板，降低网格密度   |
| 移动（Mobile） | < 650px        | 隐藏次要 UI，30 FPS 目标 |

### 8.2 移动端优化
- **隐藏元素**：网格、次干道、小型建筑（< 100m²）
- **简化材质**：使用 `MeshBasicMaterial`
- **降低分辨率**：`devicePixelRatio` 限制为 1.5
- **禁用特效**：雾效距离减半

---

## 9. 可访问性（Accessibility）

### 9.1 WCAG 2.1 合规
- **对比度**：文字与背景对比度 ≥ 4.5:1（AA 级）
- **焦点指示**：键盘导航时显示明确的焦点轮廓
- **触控目标**：按钮最小尺寸 44×44px

### 9.2 键盘导航
- Tab 键可导航所有交互元素（按钮、链接）
- 相机控制支持纯键盘操作（WASD）

### 9.3 屏幕阅读器
- 所有图标按钮提供 `aria-label`
- 建筑信息卡片使用语义化 HTML（`<article>`）

---

## 10. 实现检查清单

### 10.1 色彩与材质
- [ ] 建筑使用 #3e8f91 主色调
- [ ] 道路分为主干道 (#6b8e95) 和次干道 (#4a6570)
- [ ] 半球光 + 平行光配置正确
- [ ] 雾效范围 45-115 米

### 10.2 3D 场景
- [ ] 相机 FOV 55°，近/远裁剪 0.1m / 250m
- [ ] 建筑白模使用拉伸几何体（ExtrudeGeometry）
- [ ] 同地图块建筑合并为单个 Mesh
- [ ] 道路使用 LineSegments 渲染

### 10.3 UI 与交互
- [ ] Header 显示 Logo 和版本号
- [ ] 左上角信息面板显示项目说明
- [ ] 右下角状态栏显示 FPS
- [ ] 底部页脚显示 OSM 许可信息
- [ ] 鼠标悬停建筑显示信息卡片
- [ ] 支持 WASD 键盘控制

### 10.4 响应式与性能
- [ ] 移动端（< 650px）隐藏网格和次干道
- [ ] devicePixelRatio 限制为 min(DPR, 2)（桌面）和 min(DPR, 1.5)（移动）
- [ ] 桌面端稳定 60 FPS
- [ ] 移动端稳定 30 FPS

### 10.5 可访问性
- [ ] 文字与背景对比度 ≥ 4.5:1
- [ ] 所有按钮可通过 Tab 键访问
- [ ] 提供色盲友好模式切换

---

## 11. 设计资源

### 11.1 字体
- **西文**：Segoe UI（Windows），San Francisco（macOS），Roboto（Android）
- **中文**：Microsoft YaHei UI（微软雅黑 UI），思源黑体（Noto Sans CJK SC）
- **等宽**：Consolas（Windows），Menlo（macOS），Monaco（通用）

### 11.2 图标库
- 暂不使用图标库，优先使用文字标签
- 未来可引入 Feather Icons（MIT 许可）

### 11.3 调色板工具
- 使用 [Coolors.co](https://coolors.co/) 生成色板
- 验证对比度：[WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

---

## 12. 与 game-and-map-architecture.md 的配合

### 12.1 接口对应
- **坐标系统**：本文档定义的轴颜色（X=红, Y=绿, Z=蓝）对应架构文档的轴约定
- **地图块**：建筑材质和道路颜色由地图块的 `type` 字段决定
- **相机控制器**：UI 的键盘映射对应 `CameraController` 接口

### 12.2 性能预算
- 本文档的响应式优化策略服务于架构文档第 5 节的性能指标
- 移动端简化视觉效果以达到 30 FPS 目标

---

## 13. 未来视觉扩展

### 13.1 昼夜循环
- 根据 `SceneState.timeOfDay` 调整光照和天空颜色
- 夜晚启用建筑窗户发光效果（Emissive Material）

### 13.2 天气系统
- 雨天：增加雾效密度，降低光照强度
- 使用粒子系统模拟雨滴（Particle System）

### 13.3 角色与动画
- 第一人称角色高度：1.7 米
- 行走动画：Mixamo 模型 + Three.js AnimationMixer

---

## 14. 变更记录
- **v1.0 (2026-11-22)**：初始版本，定义色彩、光照、UI 和交互规范

