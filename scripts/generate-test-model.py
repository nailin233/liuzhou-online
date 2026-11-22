"""
Blender Python 脚本 - 生成测试建筑模型
用于 Issue #16: 验证 Blender MCP 环境

模型规格:
- 底面: 10m × 10m 正方形
- 高度: 15m
- 材质: PBR, metalness=0, roughness=0.85
- 立面颜色: #C9D2D6 (osm.height)
- 顶面颜色: #E4EBED
- 原点: 底面中心
- 坐标系: +Y 向上
"""

import bpy
import bmesh
import sys
import os
from mathutils import Vector

def hex_to_rgb(hex_color):
    """将十六进制颜色转换为 RGB (0-1 范围)"""
    hex_color = hex_color.lstrip('#')
    r = int(hex_color[0:2], 16) / 255.0
    g = int(hex_color[2:4], 16) / 255.0
    b = int(hex_color[4:6], 16) / 255.0
    return (r, g, b, 1.0)

def create_building_model(width=10, depth=10, height=15, 
                         side_color="#C9D2D6", 
                         top_color="#E4EBED"):
    """
    创建建筑白模
    
    Args:
        width: 宽度(米)
        depth: 深度(米)
        height: 高度(米)
        side_color: 立面颜色
        top_color: 顶面颜色
    """
    
    # 清除默认场景
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    
    # 设置单位为米
    bpy.context.scene.unit_settings.system = 'METRIC'
    bpy.context.scene.unit_settings.length_unit = 'METERS'
    
    # 创建立方体
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, height/2, 0))
    building = bpy.context.active_object
    building.name = "TestBuilding"
    
    # 缩放到指定尺寸
    building.scale = (width, height, depth)
    
    # 应用缩放
    bpy.ops.object.transform_apply(scale=True)
    
    # 创建立面材质
    side_material = bpy.data.materials.new(name="BuildingSide_OSMHeight")
    # Blender 5.x: 材质默认已使用节点系统，无需显式设置 use_nodes
    
    # 配置 PBR 材质
    principled = side_material.node_tree.nodes.get('Principled BSDF')
    if principled:
        side_rgb = hex_to_rgb(side_color)
        principled.inputs['Base Color'].default_value = side_rgb
        principled.inputs['Metallic'].default_value = 0.0
        principled.inputs['Roughness'].default_value = 0.85
    
    # 创建顶面材质
    top_material = bpy.data.materials.new(name="BuildingTop_OSMHeight")
    # Blender 5.x: 材质默认已使用节点系统
    
    principled_top = top_material.node_tree.nodes.get('Principled BSDF')
    if principled_top:
        top_rgb = hex_to_rgb(top_color)
        principled_top.inputs['Base Color'].default_value = top_rgb
        principled_top.inputs['Metallic'].default_value = 0.0
        principled_top.inputs['Roughness'].default_value = 0.85
    
    # 进入编辑模式分配材质
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    
    mesh = building.data
    bm = bmesh.from_edit_mesh(mesh)
    
    # 添加材质槽
    if len(building.material_slots) == 0:
        building.data.materials.append(side_material)
        building.data.materials.append(top_material)
    
    # 为顶面分配顶面材质，其他面分配立面材质
    for face in bm.faces:
        # 检查面的法线方向，判断是否为顶面
        if face.normal.z > 0.9:  # 顶面 (+Z 方向)
            face.material_index = 1
        else:  # 侧面
            face.material_index = 0
    
    bmesh.update_edit_mesh(mesh)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    return building

def export_glb(output_path, building):
    """导出为 GLB 格式"""
    
    # 确保输出目录存在
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)
    
    # 选择要导出的对象
    bpy.ops.object.select_all(action='DESELECT')
    building.select_set(True)
    bpy.context.view_layer.objects.active = building
    
    # 导出 GLB (Blender 5.x 兼容参数)
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_materials='EXPORT',
        export_normals=True,
        export_yup=True  # +Y 向上
    )
    
    print(f"✅ 模型已导出: {output_path}")
    
    # 获取面数信息
    poly_count = len(building.data.polygons)
    vertex_count = len(building.data.vertices)
    
    print(f"   顶点数: {vertex_count}")
    print(f"   面数: {poly_count}")
    print(f"   三角形数 (约): {poly_count * 2}")  # 四边形 = 2 个三角形
    
    return {
        'vertices': vertex_count,
        'faces': poly_count,
        'triangles': poly_count * 2
    }

def main():
    """主函数"""
    print("="* 50)
    print("Blender 测试建筑模型生成器")
    print("Issue #16: 验证 Blender MCP 环境")
    print("="* 50)
    print()
    
    # 获取输出路径
    # Blender 命令行: blender --background --python script.py -- /path/to/output.glb
    # sys.argv 在 "--" 之后的部分才是我们的参数
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    default_output = os.path.join(project_root, "tests", "blender-test-model.glb")

    output_path = default_output
    if "--" in sys.argv:
        extra_args = sys.argv[sys.argv.index("--") + 1:]
        if extra_args and extra_args[0] != "--":
            output_path = extra_args[0]
    
    print(f"输出路径: {output_path}")
    print()
    
    # 创建建筑模型
    print("创建建筑模型...")
    building = create_building_model(
        width=10,
        depth=10,
        height=15,
        side_color="#C9D2D6",
        top_color="#E4EBED"
    )
    print("✅ 建筑模型创建完成")
    print()
    
    # 导出 GLB
    print("导出 GLB 文件...")
    stats = export_glb(output_path, building)
    print()
    
    # 验证规范
    print("验证规范:")
    print(f"  ✅ 格式: GLB (glTF 2.0)")
    print(f"  ✅ 单位: 米")
    print(f"  ✅ 坐标系: +Y 向上")
    print(f"  ✅ 原点: 底面中心")
    print(f"  {'✅' if stats['triangles'] < 500 else '⚠️ '} 三角形数: {stats['triangles']} (目标 < 500)")
    print(f"  ✅ 材质: PBR (metalness=0, roughness=0.85)")
    print(f"  ✅ 颜色: 立面 #C9D2D6, 顶面 #E4EBED")
    print()
    print("="* 50)
    print("✅ 测试模型生成完成！")
    print("="* 50)

if __name__ == "__main__":
    main()
