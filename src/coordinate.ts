/**
 * Coordinate System - 坐标系统转换工具
 * 
 * 处理 WGS84 地理坐标 (经纬度) 到本地笛卡尔坐标 (米) 的转换
 * 
 * 状态: 骨架代码，等待 Claude 架构设计完成后实现
 */

export interface GeoCoordinate {
  /** 纬度 (Latitude) */
  lat: number;
  /** 经度 (Longitude) */
  lon: number;
  /** 可选高度 (米) */
  alt?: number;
}

export interface LocalCoordinate {
  /** X 坐标 (米, 东向为正) */
  x: number;
  /** Y 坐标 (米, 高度) */
  y: number;
  /** Z 坐标 (米, 北向为正) */
  z: number;
}

/**
 * 坐标转换器
 * 
 * TODO: 实现基于 Mercator 或 UTM 的转换算法
 * TODO: 需要定义柳州市区的参考原点
 */
export class CoordinateSystem {
  private originLat: number;
  private originLon: number;

  constructor(originLat: number, originLon: number) {
    this.originLat = originLat;
    this.originLon = originLon;
  }

  /**
   * 将 WGS84 坐标转换为本地坐标
   * 
   * @param geo WGS84 经纬度坐标
   * @returns 本地笛卡尔坐标 (米)
   */
  public geoToLocal(geo: GeoCoordinate): LocalCoordinate {
    // TODO: 实现真实的坐标转换
    // 当前返回占位值
    console.warn('CoordinateSystem.geoToLocal() 尚未实现');
    return {
      x: 0,
      y: geo.alt ?? 0,
      z: 0,
    };
  }

  /**
   * 将本地坐标转换为 WGS84 坐标
   * 
   * @param local 本地笛卡尔坐标
   * @returns WGS84 经纬度坐标
   */
  public localToGeo(local: LocalCoordinate): GeoCoordinate {
    // TODO: 实现真实的坐标转换
    console.warn('CoordinateSystem.localToGeo() 尚未实现');
    return {
      lat: this.originLat,
      lon: this.originLon,
      alt: local.y,
    };
  }
}

/**
 * 五星街区域的临时参考点 (待 Grok 调研确认)
 * 
 * 注意: 这是占位值，不是准确坐标
 */
export const WUXING_STREET_ORIGIN: GeoCoordinate = {
  lat: 24.3264, // 临时值
  lon: 109.4281, // 临时值
  alt: 0,
};
