# Codex + Blender MCP 建模任务清单

本文档追踪 Codex 通过 Blender MCP 完成的建模任务。

## 环境配置

### Blender MCP 状态
- [ ] Blender 已安装
- [ ] MCP 服务器已配置
- [ ] Codex 已连接到 MCP
- [ ] 测试连接成功

### 数据准备
- [x] OSM 建筑数据 (docs/research/issue-1.md)
- [x] OSM 水系数据 (docs/research/issue-8.md)
- [x] 坐标转换规范 (docs/game-and-map-architecture.md)
- [x] 美术规范 (docs/art-direction.md)

---

## 建模任务

### 任务 1: 环境验证
**Issue**: 待创建  
**负责人**: Codex  
**目标**: 验证 Blender MCP 可用性

**验收标准**:
- [ ] Codex 可以通过 MCP 连接 Blender
- [ ] 可以创建简单几何体 (立方体)
- [ ] 可以应用材质
- [ ] 可以导出 GLB 文件
- [ ] GLB 可以在 Three.js 中加载

**输出**:
- 测试脚本
- 示例 GLB 文件
- 环境配置文档

---

### 任务 2: 单体建筑白模生成
**Issue**: 待创建  
**负责人**: Codex  
**目标**: 生成单个建筑的白模

**输入**:
```json
{
  "id": "way-123456",
  "outline": [[109.428, 24.326], ...],
  "height": 15.0,
  "heightSource": "osm.levels"
}
```

**验收标准**:
- [ ] 建筑轮廓正确
- [ ] 高度正确
- [ ] 材质颜色符合规范
- [ ] 面数 < 500 三角形
- [ ] 原点位于轮廓质心地面
- [ ] 单位为米，+Y 向上

**输出**:
- way-123456.glb
- 生成脚本

---

### 任务 3: 批量建筑生成
**Issue**: 待创建  
**负责人**: Codex  
**目标**: 批量生成五星街所有建筑

**输入**:
- 从 docs/research/issue-1.md 提取的建筑列表
- 约 200-500 栋建筑

**验收标准**:
- [ ] 所有建筑生成成功
- [ ] 按 heightSource 正确分类和着色
- [ ] 缺失高度的建筑使用 3m 占位 + 斜纹
- [ ] 所有模型符合规范
- [ ] 生成 manifest.json 记录每个模型

**输出**:
- public/models/wuxing-street/buildings/*.glb
- manifest.json

**性能要求**:
- 处理时间 < 30 分钟
- 内存使用 < 8GB

---

### 任务 4: 道路网络生成
**Issue**: 待创建  
**负责人**: Codex  
**目标**: 生成道路网络几何体

**输入**:
- OSM 道路数据 (way paths)
- 道路宽度和类型

**验收标准**:
- [ ] 道路按类型着色 (主干道、次干道等)
- [ ] 道路宽度正确
- [ ] 道路高度略高于地面 (避免闪烁)
- [ ] 交叉口处理合理

**输出**:
- public/models/wuxing-street/roads/roads.glb

---

### 任务 5: 柳江水系生成
**Issue**: 待创建  
**负责人**: Codex  
**目标**: 生成柳江河段模型

**输入**:
- 柳江轮廓 (从 docs/research/issue-8.md)

**验收标准**:
- [ ] 水体轮廓正确
- [ ] 使用水体材质颜色 (#1F4A5C)
- [ ] roughness = 0.35
- [ ] 高度为 0m (地面水平)

**输出**:
- public/models/wuxing-street/water/liujiang.glb

---

### 任务 6: 绿地生成 (可选)
**Issue**: 待创建  
**负责人**: Codex  
**目标**: 生成公园和绿地

**输入**:
- OSM 绿地数据

**验收标准**:
- [ ] 绿地轮廓正确
- [ ] 使用绿地颜色 (#24392E)
- [ ] 高度略高于地面

**输出**:
- public/models/wuxing-street/parks/*.glb

---

### 任务 7: 地标精细建模 (未来)
**Issue**: 待创建  
**负责人**: Codex (需要更详细的参考资料)  
**目标**: 为重要地标创建精细模型

**候选地标**:
- 柳侯公园标志性建筑
- 柳州博物馆
- 五星街历史建筑

**要求**:
- 面数 < 20,000 三角形
- 贴图 1024×1024
- 需要参考照片

---

## 工作流程

### 标准流程

1. **创建 Issue**
   ```bash
   gh issue create \
     --title "[Codex/Blender] 任务标题" \
     --body "任务描述" \
     --label "agent:codex,milestone:m1,type:modeling"
   ```

2. **Codex 执行**
   - 读取输入数据
   - 通过 MCP 操控 Blender
   - 生成模型文件
   - 验证规范

3. **提交 PR**
   - 模型文件放在 `public/models/`
   - 更新 manifest.json
   - 添加测试脚本
   - 截图验证

4. **审查**
   - 检查模型规范
   - 在 Three.js 中测试加载
   - 性能测试
   - 合并到 main

---

## Manifest 格式

```json
{
  "region": "wuxing-street",
  "bounds": {
    "center": [109.4281, 24.3264],
    "size": [500, 500]
  },
  "generated": "2026-11-22T18:00:00+08:00",
  "buildings": [
    {
      "id": "way-123456",
      "file": "buildings/way-123456.glb",
      "osmLink": "https://www.openstreetmap.org/way/123456",
      "height": 15.0,
      "heightSource": "osm.levels",
      "triangles": 480,
      "generator": "codex-blender-mcp",
      "version": "1.0"
    }
  ],
  "roads": [
    {
      "file": "roads/roads.glb",
      "triangles": 12000
    }
  ],
  "water": [
    {
      "file": "water/liujiang.glb",
      "triangles": 2000
    }
  ]
}
```

---

## 备用方案

如果 Blender MCP 不可用或遇到问题:

1. **Python 脚本生成**
   - Codex 生成 Blender Python 脚本
   - 用户手动执行: `blender --background --python script.py`

2. **程序化几何生成**
   - 在 Three.js 中直接用代码生成几何体
   - 不需要外部建模工具

3. **简化白模**
   - 先用最简单的盒子替代
   - 后续逐步精细化

---

**更新时间**: 2026-11-22  
**状态**: 等待 Blender MCP 环境配置
