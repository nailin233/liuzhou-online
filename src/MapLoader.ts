/**
 * Map Data Loader - 地图数据加载器
 * 
 * 从 OSM 数据或预处理的 JSON 文件加载真实地图数据
 * 
 * 状态: 骨架代码，等待:
 * 1. Grok 完成 OSM 数据审计 (Issue #1, #8)
 * 2. Claude 完成数据管线设计 (Issue #2, #9)
 */

import * as THREE from 'three';
import type { CoordinateSystem } from './coordinate';

export interface MapBuildingData {
  /** 建筑ID */
  id: string;
  /** 建筑轮廓点 (WGS84) */
  outline: Array<{ lat: number; lon: number }>;
  /** 高度 (米, 可选) */
  height?: number;
  /** 建筑类型 (可选) */
  type?: string;
  /** 名称 (可选) */
  name?: string;
}

export interface MapRoadData {
  /** 道路ID */
  id: string;
  /** 道路路径点 (WGS84) */
  path: Array<{ lat: number; lon: number }>;
  /** 道路宽度 (米) */
  width: number;
  /** 道路类型 */
  type: string;
  /** 名称 (可选) */
  name?: string;
}

export interface MapData {
  buildings: MapBuildingData[];
  roads: MapRoadData[];
  // 未来扩展: 水系、绿地等
}

/**
 * 地图加载器
 * 
 * TODO: 实现从 JSON 文件加载地图数据
 * TODO: 实现建筑白模生成
 * TODO: 实现道路网络生成
 */
export class MapLoader {
  constructor(private coordinateSystem: CoordinateSystem) {}

  /**
   * 从 URL 加载地图数据
   * 
   * @param url 地图数据 URL (JSON 格式)
   */
  public async loadFromUrl(url: string): Promise<MapData> {
    console.warn(`MapLoader.loadFromUrl('${url}') 尚未实现`);
    
    // TODO: 实现真实的数据加载
    return {
      buildings: [],
      roads: [],
    };
  }

  /**
   * 将地图数据转换为 Three.js 对象
   * 
   * @param mapData 地图数据
   * @returns Three.js 对象数组
   */
  public createMapObjects(mapData: MapData): THREE.Object3D[] {
    const objects: THREE.Object3D[] = [];

    // TODO: 遍历 buildings 并生成白模
    // TODO: 遍历 roads 并生成道路几何体

    console.warn('MapLoader.createMapObjects() 尚未实现');

    return objects;
  }
}
