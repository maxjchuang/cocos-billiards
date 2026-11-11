"""Inspect the actual serialized game GLB against its shared curved cloth openings.
Run Blender --background --factory-startup --python scripts/check-game-pocket-curves.py.
"""
import bpy
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

root=Path(__file__).resolve().parents[1]
asset=root/'assets/resources/models/table-v8/table.glb'
geometry=json.loads((root/'tmp/model-tools/game-table-geometry.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(asset))
cloth=next(obj for obj in bpy.context.scene.objects if obj.name.startswith('Static Forest baize'))
vertices=[cloth.matrix_world@vertex.co for vertex in cloth.data.vertices]
cloth.data.calc_loop_triangles()
tree=BVHTree.FromPolygons(vertices,[face.vertices[:] for face in cloth.data.loop_triangles],all_triangles=True)
checks=[]
for index,pocket in enumerate(geometry['pockets']):
    tangent,normal,lip=pocket['tangent'],pocket['normal'],pocket['lip']
    front=[]
    for point in pocket['outline']:
        x,z=point['x']-lip['x'],point['z']-lip['z']
        u=x*tangent['x']+z*tangent['z'];v=x*normal['x']+z*normal['z']
        if v<=.018+1e-8:front.append((point,u,v))
    errors=[]
    for point,u,v in front:
        _,_,_,distance=tree.find_nearest(Vector((point['x'],-point['z'],.8)))
        errors.append(distance)
        if abs(u)<.009:
            supported=Vector((point['x']-normal['x']*.002,-point['z']+normal['z']*.002,1))
            opening=Vector((point['x']+normal['x']*.002,-point['z']-normal['z']*.002,1))
            assert tree.ray_cast(supported,Vector((0,0,-1)),.3)[0] is not None,(index,'missing supported shelf')
            assert tree.ray_cast(opening,Vector((0,0,-1)),.3)[0] is None,(index,'cloth covers the opening')
    maximum=max(errors)
    assert maximum<.0015,(index,'export lost the curved front',maximum)
    checks.append({'pocket':index,'kind':pocket['kind'],'frontSamples':len(front),'maximumRimErrorM':maximum,
                   'frontSagittaM':max(point[2] for point in front)-min(point[2] for point in front)})
report={'assetSha256':hashlib.sha256(asset.read_bytes()).hexdigest(),'passed':len(checks),'total':6,'checks':checks}
output=root/'docs/technical/validation/pocket-curves/serialized-rims.json'
output.write_text(json.dumps(report,indent=2)+'\n')
print('SERIALIZED_CURVED_RIMS',json.dumps(report))
