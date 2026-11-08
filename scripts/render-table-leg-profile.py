"""Render a single model leg without perspective distortion for proportion review.
Run Blender --background <model.blend> --python scripts/render-table-leg-profile.py.
"""
import bpy
import bmesh
import struct
from pathlib import Path
from mathutils import Vector

scene = bpy.context.scene
camera = scene.camera
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 1.1
camera.location = (.565, -2.1, .335)
camera.rotation_euler = (Vector((.565, -1.1, .335))-camera.location).to_track_quat('-Z', 'Y').to_euler()
visible = {'12 Sculpted walnut leg 0 1', '13 Fitted bronze foot 0 1',
           '15 Recessed leg mount 0 1', '16 Foot contact sole 0 1'}
for obj in bpy.data.collections['Chinese pool table - metres'].objects:
    obj.hide_render = obj.name not in visible
# Show the connector portion exposed below the apron, matching the sketch.
mount = bpy.data.objects['15 Recessed leg mount 0 1']
mesh = bmesh.new()
mesh.from_mesh(mount.data)
bmesh.ops.bisect_plane(mesh, geom=list(mesh.verts)+list(mesh.edges)+list(mesh.faces),
                      plane_co=(0, 0, .600), plane_no=(0, 0, 1), clear_outer=True)
bmesh.ops.holes_fill(mesh, edges=[edge for edge in mesh.edges if edge.is_boundary])
mesh.to_mesh(mount.data)
mesh.free()
path = Path(__file__).resolve().parents[1]/'docs/design/table-model/leg-profile.png'
scene.render.filepath = str(path)
bpy.ops.render.render(write_still=True)
# Preserve pixels and color information while removing workstation render metadata.
png = path.read_bytes()
clean = bytearray(png[:8])
offset = 8
while offset < len(png):
    length = struct.unpack_from('>I', png, offset)[0]
    kind = png[offset+4:offset+8]
    if kind not in (b'tEXt', b'zTXt', b'iTXt', b'eXIf'):
        clean.extend(png[offset:offset+12+length])
    offset += 12+length
path.write_bytes(clean)
