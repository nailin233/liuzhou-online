/**
 * Coordinate System - WGS84 地理坐标到本地米制 3D 坐标转换工具
 *
 * 原点：OSM 锚点 node/6038500119（五星街 way/205513960 第 6 节点）
 *   lon = 109.4086882°E, lat = 24.3157756°N
 * 坐标系：右手系，单位米（m）
 *   +X = 东，+Y = 上，+Z = 南（北为 -Z）
 * 投影：地球半径 R = 6378137 m 的局部等距圆柱近似（与 manifest*.json / roads.json / waterways.json 一致）
 */

export const EARTH_RADIUS_M = 6378137.0;
const DEG_TO_RAD = Math.PI / 180;

export interface GeoCoordinate {
  /** 纬度 (Latitude, WGS84 十进制度) */
  lat: number;
  /** 经度 (Longitude, WGS84 十进制度) */
  lon: number;
  /** 可选高程 (米) */
  alt?: number;
}

export interface LocalCoordinate {
  /** X 坐标 (米, 东向为正) */
  x: number;
  /** Y 坐标 (米, 上向为正) */
  y: number;
  /** Z 坐标 (米, 南向为正, 北向为负) */
  z: number;
}

/** 已审计的五星街基准锚点（OSM node/6038500119） */
export const WUXING_STREET_ORIGIN: GeoCoordinate = {
  lat: 24.3157756,
  lon: 109.4086882,
  alt: 0,
};

export class CoordinateSystem {
  private readonly originLat: number;
  private readonly originLon: number;
  private readonly cosOriginLat: number;

  constructor(
    originLat: number = WUXING_STREET_ORIGIN.lat,
    originLon: number = WUXING_STREET_ORIGIN.lon,
  ) {
    this.originLat = originLat;
    this.originLon = originLon;
    this.cosOriginLat = Math.cos(originLat * DEG_TO_RAD);
  }

  /** 将 WGS84 经纬度转换为本地米制坐标 (+X 东, +Y 上, +Z 南) */
  public geoToLocal(geo: GeoCoordinate): LocalCoordinate {
    const x = (geo.lon - this.originLon) * DEG_TO_RAD * EARTH_RADIUS_M * this.cosOriginLat;
    const z = -(geo.lat - this.originLat) * DEG_TO_RAD * EARTH_RADIUS_M;
    return {
      x: x === 0 ? 0 : x,
      y: geo.alt ?? 0,
      z: z === 0 ? 0 : z,
    };
  }

  /** 将本地米制坐标逆转换为 WGS84 经纬度 */
  public localToGeo(local: LocalCoordinate): GeoCoordinate {
    const lat = this.originLat - local.z / (DEG_TO_RAD * EARTH_RADIUS_M);
    const lon = this.originLon + local.x / (DEG_TO_RAD * EARTH_RADIUS_M * this.cosOriginLat);
    return {
      lat,
      lon,
      alt: local.y,
    };
  }
}
