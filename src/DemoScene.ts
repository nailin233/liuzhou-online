/**
 * Demo Scene - 演示场景 (白模)
 * 
 * 这是一个临时的演示场景，用于验证渲染系统。
 * 注意: 这不是柳州真实地图，仅用于开发测试。
 */

import * as THREE from 'three';

export interface DemoSceneOptions {
  buildingColor?: number;
  buildingRoughness?: number;
  floorColor?: number;
  floorRoughness?: number;
}

export class DemoScene {
  private objects: THREE.Object3D[] = [];

  constructor(private options: DemoSceneOptions = {}) {}

  /**
   * 创建演示场景对象
   */
  public create(): THREE.Object3D[] {
    this.objects = [];

    // 地面
    const floorGeometry = new THREE.PlaneGeometry(160, 160);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: this.options.floorColor ?? 0x17232c,
      roughness: this.options.floorRoughness ?? 0.9,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    this.objects.push(floor);

    // 网格辅助线
    const grid = new THREE.GridHelper(160, 80, 0x284454, 0x203340);
    grid.position.y = 0.012;
    this.objects.push(grid);

    // 演示建筑 (随机分布)
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: this.options.buildingColor ?? 0x3e8f91,
      roughness: this.options.buildingRoughness ?? 0.75,
    });

    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        // 随机跳过一些位置
        if ((i * 5 + j * 2) % 4 === 0) continue;

        // 随机高度
        const height = 1.4 + (((i + 9) * 7 + (j + 9) * 11) % 7) * 0.65;

        const boxGeometry = new THREE.BoxGeometry(1.45, height, 1.45);
        const box = new THREE.Mesh(boxGeometry, buildingMaterial);
        box.position.set(i * 3.5, height / 2, j * 3.5);
        this.objects.push(box);
      }
    }

    return this.objects;
  }

  /**
   * 移除演示场景
   */
  public dispose(): void {
    this.objects.forEach(obj => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (obj.material instanceof THREE.Material) {
          obj.material.dispose();
        }
      }
    });
    this.objects = [];
  }
}
