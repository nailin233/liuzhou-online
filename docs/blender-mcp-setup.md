# Blender MCP 环境配置文档

## 验证结果 ✅

**状态**: 环境验证通过，测试模型生成成功

| 项目 | 状态 | 详情 |
|------|------|------|
| Blender 安装 | ✅ | Blender 5.3.0 (Steam) |
| BlenderMCP 插件 | ✅ | 已注册并可用 |
| GLB 生成 | ✅ | 2.71 KB |
| 格式验证 | ✅ | glTF 2.0 Binary |
| 材质规范 | ✅ | PBR, metalness=0, roughness=0.85 |
| 颜色规范 | ✅ | 立面 #C9D2D6, 顶面 #E4EBED |
| 三角形数 | ✅ | 12 (< 500 目标) |
| 测试套件 | ✅ | 6/6 通过 |

## Blender 安装位置

**路径**: `J:\SteamLibrary\steamapps\common\Blender\blender.exe`  
**版��**: Blender 5.3.0 (hash 02f0899d78e3, 2026-11-10)  
**安装方式**: Steam (AppID 365670)  
**BlenderMCP 插件**: 已安装并自动注册

## 执行命令

```powershell
# 生成测试建筑模型（无界面后台执行）
& "J:\SteamLibrary\steamapps\common\Blender\blender.exe" `
    --background `
    --python scripts/generate-test-model.py

# 验证生成的模型
node --test tests/blender-mcp-test.mjs
```

## 测试模型规格

### 几何规格
- **底面**: 10m × 10m 正方形
- **高度**: 15m
- **原点**: 底面中心 (0, 0, 0)
- **坐标系**: +Y 向上 (Blender 标准 ↔ Three.js 匹配)

### 材质规格 (按 art-direction.md 规范)
- **系统**: PBR (Physically Based Rendering)
- **metalness**: 0.0 (非金属)
- **roughness**: 0.85 (建筑白模)
- **heightSource**: `osm.height`

### 颜色编码
| 面类型 | 颜色 | HEX | RGB (0-1) |
|--------|------|-----|-----------|
| 立面 | 浅灰蓝 | `#C9D2D6` | (0.788, 0.824, 0.839) |
| 顶面 | 更浅灰 | `#E4EBED` | (0.894, 0.922, 0.929) |

### 文件信息
- **格式**: glTF 2.0 Binary (.glb)
- **文件**: `tests/blender-test-model.glb`
- **大小**: 2.71 KB
- **顶点**: 8
- **面**: 6 (四边形)
- **三角形**: 12

## 生成的文件

```
codex-issue-16/
  scripts/
    generate-test-model.py     # Blender Python 生成脚本
  tests/
    blender-test-model.glb     # 生成的测试模型 ✅
    blender-mcp-test.mjs       # 验证测试脚本
  blender-test-viewer.html     # Three.js 查看器页面
  docs/
    blender-mcp-setup.md       # 本文档
```

## Blender 5.x 兼容性说明

Blender 5.3.0 有以下 API 变化，脚本已相应适配：

1. **`use_nodes` 弃用**: 材质默认启用节点，无需显式设置
2. **`export_colors` 移除**: glTF 导出不再支持此参数，已删除
3. **命令行参数**: `--` 后的参数通过 `sys.argv` 中 `--` 的索引提取

## Three.js 集成

模型已通过格式验证，浏览器加载验证步骤：

1. 启动开发服务器: `npm run dev`
2. 打开 `blender-test-viewer.html`（需要调整路径）
3. 或在 `main.ts` 中使用 GLTFLoader 加载模型

示例加载代码:
```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
loader.load('/tests/blender-test-model.glb', (gltf) => {
    scene.add(gltf.scene);
});
```

## 下一步: 批量建筑生成

Issue #16 验证通过后，可以推进 Issue #17（批量建筑生成）：
1. 读取 `docs/research/issue-1.md` 中的 OSM 建筑数据
2. 扩展脚本支持任意多边形轮廓的挤出
3. 批量生成五星街所有建筑白模
4. 生成 `public/models/wuxing-street/manifest.json`

---

**生成时间**: 2026-11-22  
**Blender 版本**: 5.3.0  
**任务**: Issue #16 - Blender MCP 环境验证  
**状态**: ✅ 完成
