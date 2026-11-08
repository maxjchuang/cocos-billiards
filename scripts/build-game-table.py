"""Derive the local Creator table asset from the approved V8 Blender master.
Run node scripts/export-table-geometry.cjs first, then Blender --background
 docs/design/table-model/chinese-pool-table.blend --python scripts/build-game-table.py.
The approved master is never saved by this script.
"""
import bpy
import bmesh
import json
import math
import hashlib
import struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT/'docs/design/table-model'
OUT = ROOT/'assets/resources/models/table-v8/table.glb'
geometry = json.loads((ROOT/'tmp/model-tools/game-table-geometry.json').read_text())
collection = bpy.data.collections['Chinese pool table - metres']
source_hash = hashlib.sha256((MASTER/'chinese-pool-table.blend').read_bytes()).hexdigest()
assert source_hash == json.loads((MASTER/'model-validation.json').read_text())['sha256']['chinese-pool-table.blend'], 'Approved model fingerprint mismatch'


def world(point):
    return Vector((point['x'], -point['z']))


def closest(point, segments):
    best = None
    distance = math.inf
    for a, b in segments:
        delta = b-a
        t = max(0, min(1, (point-a).dot(delta)/delta.length_squared))
        projected = a+delta*t
        error = (point-projected).length_squared
        if error < distance:
            best, distance = projected, error
    return best, math.sqrt(distance)


def make_prism(name, outline, bottom, top, material):
    n = len(outline)
    vertices = [(p.x, p.y, z) for z in (bottom, top) for p in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i, (i+1)%n, (i+1)%n+n, i+n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    uv = mesh.uv_layers.new()
    for face in mesh.polygons:
        for index in face.loop_indices:
            point = mesh.vertices[mesh.loops[index].vertex_index].co
            uv.data[index].uv = (point.x*2.5, point.y*.6)
    return obj


# Curves such as piping and stitches become regular game mesh assets.
bpy.ops.object.select_all(action='DESELECT')
curves = [obj for obj in collection.objects if obj.type == 'CURVE']
for obj in curves:obj.select_set(True)
if curves:
    bpy.context.view_layer.objects.active = curves[0]
    bpy.ops.object.convert(target='MESH')

# Match the collision nose using the exported runtime geometry at its contact height.
target_segments = []
for cushion in geometry['cushions']:
    points = [world(p) for p in cushion['nose']]
    target_segments.extend((a, b) for a, b in zip(points, points[1:]) if (a-b).length > 1e-8)
maximum_nose_error = 0
for obj in list(collection.objects):
    if obj.name.startswith('14 Reference'):
        bpy.data.objects.remove(obj, do_unlink=True)
        continue
    if not obj.name.startswith(('06 ', '07 ')):
        continue
    source_segments = []
    for edge in obj.data.edges:
        a, b = [obj.data.vertices[index].co for index in edge.vertices]
        if abs(a.z-.834) < 1e-5 and abs(b.z-.834) < 1e-5:
            aa, bb = Vector(a.xy), Vector(b.xy)
            if (aa-bb).length > 1e-8:
                source_segments.append((aa, bb))
    assert source_segments, obj.name
    for vertex in obj.data.vertices:
        point = Vector(vertex.co.xy)
        source, distance = closest(point, source_segments)
        target, _ = closest(source, target_segments)
        weight = max(0, 1-distance/.045)
        shifted = point+(target-source)*weight
        vertex.co.x, vertex.co.y = shifted
        if abs(vertex.co.z-.834) < 1e-5 and distance < 1e-5:
            _, error = closest(shifted, target_segments)
            maximum_nose_error = max(maximum_nose_error, error)
assert maximum_nose_error < .001

# Runtime holes are authoritative for support and capture. Rebuild the cloth shelf
# and slate with those exact polygons, retaining the master materials.
for prefix, bottom, top in [('03 ', .785, .800), ('02 ', .740, .785)]:
    old = next(obj for obj in collection.objects if obj.name.startswith(prefix))
    material, name = old.data.materials[0], old.name
    bpy.data.objects.remove(old, do_unlink=True)
    slab = make_prism(name, [Vector(p) for p in [(-.675,-1.315),(.675,-1.315),(.675,1.315),(-.675,1.315)]], bottom, top, material)
    for index, pocket in enumerate(geometry['pockets']):
        cutter = make_prism('Temporary aperture', [world(p) for p in pocket['outline']], .60, .90, material)
        modifier = slab.modifiers.new('Runtime aperture '+str(index), 'BOOLEAN')
        modifier.operation = 'DIFFERENCE'
        modifier.solver = 'EXACT'
        modifier.object = cutter
        bpy.context.view_layer.objects.active = slab
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(cutter, do_unlink=True)

# The master cups must also reach the authoritative opening, including its shelf.
liner_material = next(obj for obj in collection.objects if obj.name.startswith('08 ')).data.materials[0]
for obj in list(collection.objects):
    if obj.name.startswith('08 '):
        bpy.data.objects.remove(obj, do_unlink=True)
for index, pocket in enumerate(geometry['pockets']):
    points = [world(p) for p in pocket['outline']]
    n = len(points)
    center = sum(points, Vector((0, 0)))/n
    # An open-top receptacle, with solid walls extending outside the aperture.
    inner = [center+(p-center)*.98 for p in points]
    loops = [(inner, .801), (inner, .615),
             ([center+(p-center)*1.04 for p in points], .610),
             ([center+(p-center)*1.04 for p in points], .801)]
    vertices = [(p.x, p.y, z) for ring, z in loops for p in ring]
    faces = []
    for i in range(n):
        j = (i+1)%n
        faces += [(i,j,n+j,n+i), (2*n+i,2*n+j,3*n+j,3*n+i), (3*n+i,3*n+j,j,i)]
    faces += [tuple(range(n,2*n)), tuple(reversed(range(2*n,3*n)))]
    mesh = bpy.data.meshes.new('Runtime pocket cup')
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new('08 Runtime pocket cup '+str(index), mesh)
    collection.objects.link(obj)
    mesh.materials.append(liner_material)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    for face in mesh.polygons:face.use_smooth=len(face.vertices)==4

# Reduce high-density surfaces while retaining the gameplay contact line.
for obj in list(collection.objects):
    if obj.type != 'MESH' or obj.name.startswith(('02 ', '03 ', '08 ')):
        continue
    group = obj.vertex_groups.new(name='Contact preservation')
    for vertex in obj.data.vertices:
        group.add([vertex.index], 0 if abs(vertex.co.z-.834) < 1e-5 and obj.name.startswith(('06 ', '07 ')) else 1, 'REPLACE')
    modifier = obj.modifiers.new('Mobile surface density', 'DECIMATE')
    modifier.ratio = .28
    modifier.vertex_group = group.name
    modifier.vertex_group_factor = 1
    modifier.use_collapse_triangulate = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)

# Audit the derived geometry after decimation, not just the authoring input.
maximum_nose_error = 0
maximum_leg_error = 0
reference = json.loads((MASTER/'leg-profile-reference.json').read_text())
for obj in collection.objects:
    if obj.name.startswith(('06 ', '07 ')):
        for vertex in obj.data.vertices:
            if abs(vertex.co.z-.834) < 1e-5:
                _, error = closest(Vector(vertex.co.xy), target_segments)
                maximum_nose_error = max(maximum_nose_error, error)
    if obj.name.startswith('12 '):
        for fraction, width in reference['bodyWidthSamplesTopToBottom']:
            height = .475-fraction*.400
            crossings = []
            for edge in obj.data.edges:
                a, b = [obj.data.vertices[index].co for index in edge.vertices]
                if abs(a.z-height) < 1e-6:crossings.append(a.x)
                if min(a.z,b.z) < height < max(a.z,b.z):
                    crossings.append(a.x+(b.x-a.x)*(height-a.z)/(b.z-a.z))
            assert crossings, (obj.name,height)
            maximum_leg_error = max(maximum_leg_error, abs((max(crossings)-min(crossings))/.166-width))
assert maximum_nose_error < .001, maximum_nose_error
assert maximum_leg_error < .04, maximum_leg_error

# Batch clip-able timber, cushion and leather groups separately from fixed lower
# surfaces. Runtime clipping retains their local clearance without extra draw calls.
groups = {}
for obj in list(collection.objects):
    if obj.type != 'MESH':
        continue
    prefix = '01 ' if obj.name.startswith('01 ') else '06 ' if obj.name.startswith(('06 ', '07 ')) else '09 ' if obj.name.startswith('09 ') else 'Static '
    key = prefix+obj.data.materials[0].name
    groups.setdefault(key, []).append(obj)
for material, objects in groups.items():
    if len(objects) == 1:
        objects[0].name = material
        continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    objects[0].name = material
for image in bpy.data.images:
    if image.size[0] > 1024 or image.size[1] > 2048:
        scale = min(1024/image.size[0], 2048/image.size[1])
        image.scale(round(image.size[0]*scale), round(image.size[1]*scale))
        image.pack()
    if image.packed_file:
        image.filepath = '//textures/'+Path(image.filepath).name
        for packed in image.packed_files:packed.filepath=image.filepath
bpy.ops.object.select_all(action='DESELECT')
triangles = 0
for obj in collection.objects:
    obj.select_set(True)
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), export_format='GLB', use_selection=True, export_apply=True)
# Blender's glTF exporter does not preserve the scan's Multiply node reliably.
# Apply the same explicit linear stain multiplier as the review GLB.
glb = OUT.read_bytes()
json_length = struct.unpack_from('<I', glb, 12)[0]
document = json.loads(glb[20:20+json_length])
for material in document['materials']:
    if material['name'] in ('Walnut lacquer V2', 'Leg walnut satin V3'):
        material['pbrMetallicRoughness']['baseColorFactor'] = [.62,.32,.18,1]
unsupported = {'KHR_materials_clearcoat','KHR_materials_specular'}
for material in document['materials']:
    extensions = material.get('extensions', {})
    for name in unsupported:extensions.pop(name, None)
    if not extensions:material.pop('extensions', None)
for key in ['extensionsUsed','extensionsRequired']:
    if key in document:
        document[key] = [name for name in document[key] if name not in unsupported]
        if not document[key]:document.pop(key)
encoded = json.dumps(document,separators=(',',':')).encode()
encoded += b' ' * ((-len(encoded))%4)
remaining = glb[20+json_length:]
OUT.write_bytes(struct.pack('<4sII', b'glTF', 2, 20+len(encoded)+len(remaining))
                +struct.pack('<I4s', len(encoded), b'JSON')+encoded+remaining)
report = {'masterRevision':'sketch-matched-legs-v8', 'masterBlendSha256':source_hash,
          'gameGlbSha256':hashlib.sha256(OUT.read_bytes()).hexdigest(),
          'triangles':triangles, 'renderers':len(collection.objects),
          'maximumLegWidthError':maximum_leg_error, 'maximumNoseErrorM':maximum_nose_error, 'openings':'exported runtime polygons',
          'textureLimit':[1024,2048], 'contactPreservation':'decimation vertex group',
          'materialCompatibility':{'clearcoat':'standard PBR approximation','clothSpecularIntensity':.08,'removedUnsupportedExtensions':sorted(unsupported)},
          'runtimeGeometrySha256':hashlib.sha256((ROOT/'assets/scripts/BilliardsTableGeometry.ts').read_bytes()).hexdigest()}
(ROOT/'docs/technical/table-model-asset.json').write_text(json.dumps(report,indent=2)+'\n')
print('GAME_TABLE_EXPORT', json.dumps(report))
