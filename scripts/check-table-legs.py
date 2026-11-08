"""Validate the approved round, outward-convex table leg profile in Blender."""
import bmesh
import bpy
import json
import math
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts = []
for obj in bpy.data.collections['Chinese pool table - metres'].objects:
    if obj.type != 'MESH' or not obj.name.startswith(('12 ', '13 ', '15 ', '16 ')):
        continue
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    assert all(edge.is_manifold for edge in mesh.edges), obj.name
    mesh.free()
    if not obj.name.startswith('12 '):
        continue
    levels = {}
    for vertex in obj.data.vertices:
        levels.setdefault(round(vertex.co.z, 6), []).append(vertex.co)
    profile = []
    maximum_variation = 0
    for height, points in sorted(levels.items()):
        assert len(points) == 64, obj.name
        center_x = sum(point.x for point in points)/len(points)
        center_y = sum(point.y for point in points)/len(points)
        radii = [math.hypot(point.x-center_x, point.y-center_y) for point in points]
        maximum_variation = max(maximum_variation, max(radii)-min(radii))
        if .075 <= height <= .475:
            profile.append((height, sum(radii)/len(radii)))
    assert maximum_variation < 1e-6, 'Leg cross-section must be circular'
    slopes = [(b[1]-a[1])/(b[0]-a[0]) for a, b in zip(profile, profile[1:])]
    assert all(b <= a+1e-3 for a, b in zip(slopes, slopes[1:])), 'Main leg body must remain outward-convex'
    widest = max(profile, key=lambda point: point[1])
    assert abs(widest[0]-.410) < .005, 'Widest point must match the approved lowered shoulder'
    assert abs(widest[1]*2-.166) < 1e-4, 'Maximum diameter must match the design'
    assert (profile[-1][0]-profile[0][0])/(widest[1]*2) > 2.35, 'Main body must retain the approved slender proportion'
    reference = json.loads((root/'docs/design/table-model/leg-profile-reference.json').read_text())
    assert abs(widest[1]*2/.400-reference['bodyWidthToHeight']) < .015, 'Body width-to-height ratio must match the sketch'
    width_errors = []
    for fraction, expected_width in reference['bodyWidthSamplesTopToBottom']:
        height = .475-fraction*.400
        nearest = min(range(len(profile)-1), key=lambda i: abs((profile[i][0]+profile[i+1][0])/2-height))
        a, b = profile[nearest], profile[nearest+1]
        radius = a[1]+(b[1]-a[1])*(height-a[0])/(b[0]-a[0])
        width_errors.append(abs(radius/widest[1]-expected_width))
    assert max(width_errors) < reference['allowedNormalizedWidthError'], 'Main silhouette must match the approved sketch'
    mount = bpy.data.objects[obj.name.replace('12 Sculpted walnut leg', '15 Recessed leg mount')]
    assert abs(mount.dimensions.x-.150) < 1e-5
    assert abs(min(vertex.co.z for vertex in mount.data.vertices)-.515) < 1e-5
    assert abs(mount.dimensions.x/(widest[1]*2)-reference['mountWidthToMaximumBodyWidth']) < .025
    foot = bpy.data.objects[obj.name.replace('12 Sculpted walnut leg', '13 Fitted bronze foot')]
    assert abs(foot.dimensions.x/(widest[1]*2)-reference['footWidthToMaximumBodyWidth']) < .025
    parts.append({'name': obj.name, 'radialSegments': 64, 'profileLevels': len(levels),
                  'maxRadiusVariationM': maximum_variation, 'widestHeightM': widest[0],
                  'maximumDiameterM': widest[1]*2, 'outwardConvexMainBody': True, 'maximumSketchWidthError': max(width_errors), 'visibleMountHeightM': .085})
assert len(parts) == 6, 'The table must have six round legs'
report = {'revision': 'sketch-matched-legs-v8', 'circularLegs': 6,
          'closedLegFootMountSoleMeshes': 24, 'parts': parts}
(root/'docs/design/table-model/round-leg-validation.json').write_text(json.dumps(report, indent=2)+'\n')
print('ROUND_LEG_AUDIT', json.dumps(report))
