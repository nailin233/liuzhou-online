"""Generate the audited Wuxing building batch offline in Blender background mode."""
import gzip
import hashlib
import json
import math
from pathlib import Path
from xml.etree import ElementTree

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "data/wuxing-street/map.osm.gz"
OUTPUT = ROOT / "public/models/wuxing-street"
BBOX = (109.4062238, 24.3135183, 109.4111526, 24.3180329)
LON, LAT = 109.4086882, 24.3157756
HEIGHT = 3.0


def project(node):
    # Blender uses +Y north. The glTF exporter maps Blender Y to glTF -Z.
    east = math.radians(float(node.get("lon")) - LON) * 6378137 * math.cos(math.radians(LAT))
    north = math.radians(float(node.get("lat")) - LAT) * 6378137
    return east, north


def read_buildings(raw):
    osm = ElementTree.fromstring(raw)
    nodes = {node.get("id"): node for node in osm.findall("node")}
    anchor = nodes["6038500119"]
    if project(anchor) != (0, 0):
        raise ValueError("Unexpected anchor position")
    for way in osm.findall("way"):
        tags = {tag.get("k"): tag.get("v") for tag in way.findall("tag")}
        if tags.get("building") in (None, "no"):
            continue
        way_id = way.get("id")
        refs = [nd.get("ref") for nd in way.findall("nd")]
        if refs[0] != refs[-1] or len(set(refs)) != len(refs) - 1 or len(refs) < 4:
            raise ValueError(f"Invalid footprint on way {way_id}")
        if "height" in tags or "building:levels" in tags:
            raise ValueError(f"Height classification must be reviewed for way {way_id}")
        yield way_id, way.get("version"), tags, [project(nodes[ref]) for ref in refs[:-1]]


def centered_ring(points):
    pairs = list(zip(points, points[1:] + points[:1]))
    weights = [x * v - u * y for (x, y), (u, v) in pairs]
    twice_area = sum(weights)
    if abs(twice_area) < 1e-6:
        raise ValueError("Degenerate footprint")
    cx, cy = (sum((p[k] + q[k]) * w for (p, q), w in zip(pairs, weights))
              / (3 * twice_area) for k in (0, 1))
    ordered = points if twice_area > 0 else reversed(points)
    return [(x - cx, y - cy) for x, y in ordered], [cx, 0, -cy]


def material(name, hex_value):
    mat = bpy.data.materials.new(name)
    shader = mat.node_tree.nodes.get("Principled BSDF")
    srgb = bytes.fromhex(hex_value)
    # Blender and glTF store linear values. The specification gives sRGB swatches.
    linear = [((v / 255 + 0.055) / 1.055) ** 2.4 for v in srgb]
    shader.inputs["Base Color"].default_value = (*linear, 1)
    shader.inputs["Roughness"].default_value = 0.85
    shader.inputs["Metallic"].default_value = 0
    return mat


def export_building(way_id, ring, materials):
    n = len(ring)
    verts = [(x, y, h) for h in (0, HEIGHT) for x, y in ring]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n, i + n))

    name = f"way-{way_id}"
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    for mat in materials:
        mesh.materials.append(mat)
    mesh.polygons[1].material_index = 1
    # Inset only the upper face. The coplanar perimeter is part of the roof,
    # so it survives export and never adds a false wall or any extra height.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.faces.ensure_lookup_table()
    border = bmesh.ops.inset_region(bm, faces=[bm.faces[1]], thickness=0.16,
                                     use_even_offset=True, use_boundary=True)
    for face in border["faces"]:
        face.material_index = 2
    bm.to_mesh(mesh)
    bm.free()
    mesh.calc_loop_triangles()
    triangles = len(mesh.loop_triangles)
    if triangles > 500:
        raise ValueError(f"{name} exceeds triangle budget: {triangles}")

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj["heightSource"] = "missing"
    obj["osmId"] = f"way/{way_id}"
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    path = OUTPUT / "buildings" / f"{name}.glb"
    result = bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB",
                                       use_selection=True, export_yup=True,
                                       export_extras=True, export_animations=False,
                                       export_copyright="© OpenStreetMap contributors (ODbL 1.0)")
    if result != {"FINISHED"}:
        raise RuntimeError(f"Could not export {path}")
    bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.meshes.remove(mesh)
    return {"file": f"buildings/{path.name}", "triangles": triangles,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    raw = gzip.decompress(SNAPSHOT.read_bytes())
    digest = hashlib.sha256(raw).hexdigest()
    if digest != "36859fd8619e1b1413399c2c51c05b66fd69fa4254efeddc38182c563f9d33c2":
        raise ValueError("Snapshot changed. Re-audit the input before generating.")
    buildings = list(read_buildings(raw))
    if len(buildings) != 34:
        raise ValueError("Expected the 34 audited building ways")
    (OUTPUT / "buildings").mkdir(exist_ok=True, parents=True)
    bpy.ops.object.select_all(action="DESELECT")
    materials = [material("missing-facade", "5C4A57"), material("missing-roof", "6E5868"),
                 material("missing-outline", "D9549B")]
    records = []
    for way_id, version, tags, points in buildings:
        ring, position = centered_ring(points)
        records.append({"id": f"way/{way_id}", "version": int(version), "tags": tags,
                        "position": position, "heightSource": "missing", "height": None,
                        "modelHeight": HEIGHT, **export_building(way_id, ring, materials)})
    manifest = {
        "source": "https://www.openstreetmap.org/api/0.6/map?bbox=" + ",".join(map(str, BBOX)),
        "snapshotHttpDate": "2026-11-22T11:08:46Z", "snapshotSha256": digest,
        "attribution": "© OpenStreetMap contributors",
        "copyrightUrl": "https://www.openstreetmap.org/copyright",
        "license": "ODbL 1.0", "licenseUrl": "https://opendatacommons.org/licenses/odbl/1-0/",
        "crs": "EPSG:4326", "bbox": BBOX, "origin": {"lon": LON, "lat": LAT, "node": "6038500119"},
        "units": "m", "axes": ["east", "up", "south"], "buildings": records,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)
                                          + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
