# Blender MCP 集成方案

## 概述

使用 Codex + Blender MCP 进行柳州建筑的 3D 建模工作。

## 工作流程

### 1. 准备阶段

#### 1.1 安装 Blender MCP
```bash
# 需要先安装 Blender 和 MCP 服务器
# 具体安装方式取决于 Blender MCP 的实现
```

#### 1.2 配置 Codex
Codex 需要配置 MCP 连接信息，以便访问 Blender 的建模功能。

### 2. 建模任务流程

```
OSM 数据 → Codex 分析 → Blender MCP 命令 → 3D 模型 (.glb)
```

#### 输入
- OSM 建筑轮廓 (GeoJSON)
- 建筑高度数据
- 建筑类型和标签

#### 输出
- GLB 格式的 3D 模型
- 符合 docs/art-direction.md 规范
- 每个建筑一个独立文件或合并为区域模型

### 3. Codex 建模任务示例

**任务**: 为五星街区域生成建筑白模

**输入数据**:
```json
{
  "buildings": [
    {
      "id": "way-123456",
      "outline": [[109.428, 24.326], [109.429, 24.326], ...],
      "height": 15.0,
      "heightSource": "osm.levels",
      "levels": 5
    }
  ]
}
```

**Codex 工作流**:
1. 读取建筑数据
2. 通过 MCP 调用 Blender 创建几何体
3. 应用材质（按 heightSource 分类）
4. 导出 GLB 文件
5. 验证模型规范

### 4. 技术规范

#### 4.1 模型要求 (来自 docs/art-direction.md)

| 项 | 要求 |
|---|---|
| 格式 | glTF 2.0 `.glb`，单位米，+Y 向上 |
| 原点 | OSM 轮廓质心的地面处 |
| 面数 | 普通建筑 ≤ 500 三角形 |
| 材质 | PBR metallic-roughness |
| 颜色 | 按 heightSource 编码 (见规范) |

#### 4.2 颜色编码

| heightSource | 立面色 | 顶面色 |
|---|---|---|
| `osm.height` | `#C9D2D6` | `#E4EBED` |
| `osm.levels` | `#9FB0B8` | `#BCC9CE` |
| `missing` | `#5C4A57` + 斜纹 | `#6E5868` |

### 5. 目录结构

```
public/
  models/
    wuxing-street/
      buildings/
        way-123456.glb
        way-123457.glb
        ...
      roads/
        roads-chunk-0-0.glb
      water/
        liujiang.glb
      manifest.json
```

### 6. MCP 命令示例

假设 Blender MCP 提供类似的 API:

```python
# Codex 通过 MCP 执行的伪代码
mcp.blender.new_scene()
mcp.blender.set_units('METRIC')

# 创建建筑
for building in buildings:
    vertices = convert_to_local_coords(building.outline)
    mesh = mcp.blender.extrude_polygon(
        vertices=vertices,
        height=building.height
    )
    
    # 应用材质
    material = get_material_for_source(building.heightSource)
    mcp.blender.assign_material(mesh, material)

# 导出
mcp.blender.export_glb(
    path="output/buildings.glb",
    options={'apply_modifiers': True}
)
```

## 任务拆分

### 阶段 1: 基础设施 (Issue #11)
- [ ] 验证 Blender MCP 可用性
- [ ] 配置 Codex MCP 连接
- [ ] 创建测试场景验证流程
- [ ] 编写 OSM → Blender 数据转换脚本

### 阶段 2: 建筑生成 (Issue #12)
- [ ] 读取 OSM 建筑数据
- [ ] 批量生成建筑白模
- [ ] 应用材质和颜色编码
- [ ] 导出 GLB 文件
- [ ] 验证模型规范

### 阶段 3: 道路和水系 (Issue #13)
- [ ] 生成道路网络几何体
- [ ] 生成柳江水系模型
- [ ] 优化性能（合并网格）

### 阶段 4: 集成测试 (Issue #14)
- [ ] 在 Three.js 中加载生成的模型
- [ ] 性能测试
- [ ] 视觉验证
- [ ] 与真实地图对比

## 优势

1. **自动化**: Codex 可以批量处理数百个建筑
2. **一致性**: 程序化生成保证风格统一
3. **可追溯**: 每个模型都能追溯到 OSM ID
4. **可重复**: 数据更新后可以重新生成

## 注意事项

1. **性能**: Blender 批量建模可能很慢，考虑分块处理
2. **内存**: 同时处理太多建筑可能导致内存不足
3. **验证**: 每个生成的模型都需要验证规范
4. **备用方案**: 如果 MCP 不可用，可以生成 Blender Python 脚本

## 备用方案: Blender Python 脚本

如果 MCP 不可用，Codex 可以生成 Python 脚本:

```python
# generate_buildings.py
import bpy
import json

def create_building(outline, height, material):
    # Blender Python API 代码
    pass

if __name__ == "__main__":
    with open("buildings.json") as f:
        data = json.load(f)
    
    for building in data["buildings"]:
        create_building(
            building["outline"],
            building["height"],
            building["heightSource"]
        )
    
    bpy.ops.export_scene.gltf(filepath="output.glb")
```

然后在命令行执行:
```bash
blender --background --python generate_buildings.py
```

## 下一步

1. **调研 Blender MCP**: 确认可用性和 API
2. **创建 Issue**: 为 Codex 创建 Blender 建模任务
3. **测试流程**: 用单个建筑验证整个流程
4. **批量生成**: 处理五星街所有建筑

---

**创建时间**: 2026-11-22  
**负责人**: Codex (配合 Blender MCP)  
**状态**: 规划中
