"""Check the serialized game GLB seam against its actual decimated wood mesh.
Run Blender --background --factory-startup --python scripts/check-game-table.py.
"""
import bpy
import hashlib
import json
import sys
from pathlib import Path
from mathutils.bvhtree import BVHTree

root = Path(__file__).resolve().parents[1]
asset = root/'assets/resources/models/table-v8/table.glb'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(asset))
wood = next(obj for obj in bpy.context.scene.objects
            if obj.type == 'MESH' and obj.name.startswith('Static Walnut'))
vertices = [wood.matrix_world @ vertex.co for vertex in wood.data.vertices]
wood.data.calc_loop_triangles()
triangles = [triangle.vertices[:] for triangle in wood.data.loop_triangles]
tree = BVHTree.FromPolygons(vertices, triangles, all_triangles=True)
leather = next(obj for obj in bpy.context.scene.objects
               if obj.type == 'MESH' and obj.name.startswith('Static Tobacco'))
gaps = []
for vertex in leather.data.vertices:
    point = leather.matrix_world @ vertex.co
    if abs(point.z-.685) < .0001:
        nearest, normal, _, distance = tree.find_nearest(point)
        gaps.append(max(0, (point-nearest).dot(normal)))
assert gaps, 'The exported lower leather skirt must be present'
report = {'gameGlbSha256': hashlib.sha256(asset.read_bytes()).hexdigest(),
          'maximumSeamGapM': max(gaps), 'measuredLowerSkirtVertices': len(gaps)}
assert report['maximumSeamGapM'] <= .001, 'Derived leather skirt must follow the decimated apron within 1mm'
arguments=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
output = root/(arguments[0] if arguments else 'docs/technical/validation/table-v8/asset-geometry.json')
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(report, indent=2)+'\n')
print('DERIVED_SEAM', json.dumps(report))
