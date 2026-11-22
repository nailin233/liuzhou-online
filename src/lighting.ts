/**
 * Lighting Setup - 光照系统配置
 * 
 * 提供场景的基础光照配置
 */

import * as THREE from 'three';

export interface LightingOptions {
  /** 天空颜色 */
  skyColor?: number;
  /** 地面颜色 */
  groundColor?: number;
  /** 环境光强度 */
  ambientIntensity?: number;
  /** 太阳光颜色 */
  sunColor?: number;
  /** 太阳光强度 */
  sunIntensity?: number;
  /** 太阳光位置 */
  sunPosition?: [number, number, number];
}

export function setupLighting(scene: THREE.Scene, options: LightingOptions = {}): THREE.Object3D[] {
  const lights: THREE.Object3D[] = [];

  // 环境光 (天空光 + 地面光)
  const hemisphereLight = new THREE.HemisphereLight(
    options.skyColor ?? 0xbcd2e0,
    options.groundColor ?? 0x293744,
    options.ambientIntensity ?? 2.2
  );
  scene.add(hemisphereLight);
  lights.push(hemisphereLight);

  // 太阳光 (平行光)
  const sunLight = new THREE.DirectionalLight(
    options.sunColor ?? 0xffe0b5,
    options.sunIntensity ?? 2.1
  );
  const [x, y, z] = options.sunPosition ?? [-10, 25, 8];
  sunLight.position.set(x, y, z);
  scene.add(sunLight);
  lights.push(sunLight);

  return lights;
}
