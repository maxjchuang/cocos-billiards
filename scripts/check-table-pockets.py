"""Check model defects that a manifold-edge check cannot detect.
Run Blender --background <model.blend> --python scripts/check-table-pockets.py.
Use -- --baseline to record an unfixed model without failing the process.
"""
import bpy
import bmesh
import json
import math
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

baseline = '--baseline' in sys.argv
root = Path(__file__).resolve().parents[1]
collection = bpy.data.collections['Chinese pool table - metres']


def triangles(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    positions = [obj.matrix_world @ vertex.co for vertex in mesh.vertices]
    indices = [tuple(triangle.vertices) for triangle in mesh.loop_triangles]
    keys = [tuple(round(c, 7) for c in point) for point in positions]
    tree = BVHTree.FromPolygons(positions, indices, all_triangles=True)
    return positions, indices, keys, tree


PLANE_TOLERANCE=1e-6
AREA_TOLERANCE=1e-10


def plane_interval(points,distances,direction):
    values=[]
    for i,point in enumerate(points):
        following=(i+1)%3
        if abs(distances[i])<=PLANE_TOLERANCE:
            values.append(point.dot(direction))
        if distances[i]*distances[following]<0:
            t=distances[i]/(distances[i]-distances[following])
            values.append(point.lerp(points[following],t).dot(direction))
    return min(values),max(values)


def overlap_area(a,b,normal):
    drop=max(range(3),key=lambda axis:abs(normal[axis]))
    axes=[axis for axis in range(3) if axis!=drop]
    subject=[(p[axes[0]],p[axes[1]]) for p in a]
    clip=[(p[axes[0]],p[axes[1]]) for p in b]
    def cross(p,q,r):
        return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    sign=1 if cross(*clip)>0 else -1
    for edge,next_edge in zip(clip,clip[1:]+clip[:1]):
        output=[]
        for p,q in zip(subject,subject[1:]+subject[:1]):
            dp=cross(edge,next_edge,p)*sign
            dq=cross(edge,next_edge,q)*sign
            if dp>=0:
                output.append(p)
            if (dp>=0)!=(dq>=0):
                t=dp/(dp-dq)
                output.append((p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t))
        subject=output
        if not subject:
            return 0
    return abs(sum(p[0]*q[1]-q[0]*p[1] for p,q in zip(subject,subject[1:]+subject[:1])))/2


def triangles_cross(a,b):
    an=(a[1]-a[0]).cross(a[2]-a[0]).normalized()
    bn=(b[1]-b[0]).cross(b[2]-b[0]).normalized()
    ad=[(p-b[0]).dot(bn) for p in a]
    bd=[(p-a[0]).dot(an) for p in b]
    if max(abs(d) for d in ad)<=PLANE_TOLERANCE and abs(an.dot(bn))>.999999:
        return overlap_area(a,b,an)>AREA_TOLERANCE
    # A shared boundary is valid. A penetration passes through both face interiors.
    if not (min(ad)<-PLANE_TOLERANCE and max(ad)>PLANE_TOLERANCE and
            min(bd)<-PLANE_TOLERANCE and max(bd)>PLANE_TOLERANCE):
        return False
    direction=an.cross(bn).normalized()
    alo,ahi=plane_interval(a,ad,direction)
    blo,bhi=plane_interval(b,bd,direction)
    return min(ahi,bhi)-max(alo,blo)>PLANE_TOLERANCE


def self_crossings(obj):
    positions,indices,_,tree=triangles(obj)
    count=0
    for a,b in tree.overlap(tree):
        if a<b and triangles_cross([positions[i] for i in indices[a]],[positions[i] for i in indices[b]]):
            count+=1
    return count


def verify_intersection_classifier():
    def vectors(points):
        return [Vector(p) for p in points]
    a=vectors([(0,0,0),(1,0,0),(0,1,0)])
    assert triangles_cross(a,vectors([(.25,.25,-.5),(.25,.25,.5),(.75,.25,0)]))
    assert triangles_cross(a,vectors([(.1,.1,0),(.6,.1,0),(.1,.6,0)]))
    assert triangles_cross(a,vectors([(0,0,0),(.4,.1,1),(.4,.1,-1)]))
    assert not triangles_cross(a,vectors([(0,0,0),(0,1,0),(-1,0,0)]))
    assert not triangles_cross(a,vectors([(1,1,0),(2,1,0),(1,2,0)]))
    assert not triangles_cross(a,vectors([(0,0,.001),(1,0,.001),(0,1,.001)]))


verify_intersection_classifier()

def coplanar_overlaps(a, b):
    av, ai, _, at = triangles(a)
    bv, bi, _, bt = triangles(b)
    count = 0
    for x, y in at.overlap(bt):
        aa, ab, ac = [av[i] for i in ai[x]]
        ba, bb, bc = [bv[i] for i in bi[y]]
        an = (ab-aa).cross(ac-aa).normalized()
        bn = (bb-ba).cross(bc-ba).normalized()
        if abs(an.dot(bn)) > .999999 and abs((ba-aa).dot(an)) < 1e-6:
            count += 1
    return count


def apron_distance(point):
    x = abs(point.x) - (.754-.075)
    y = abs(point.y) - (1.394-.075)
    return math.hypot(max(x, 0), max(y, 0)) + min(max(x, y), 0) - .075


results = []
for obj in collection.objects:
    if obj.type != 'MESH' or not obj.name.startswith(('06 ', '07 ', '08 ', '09 ', '17 ')):
        continue
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    open_edges = sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    result = {'part': obj.name, 'openEdges': open_edges, 'selfCrossings': self_crossings(obj)}
    if obj.name.startswith('08 '):
        result['linerTopM'] = max(vertex.co.z for vertex in obj.data.vertices)
        result['clothCoplanarOverlaps'] = coplanar_overlaps(obj, bpy.data.objects['03 Baize bed and cloth shelf'])
        result['slateCoplanarOverlaps'] = coplanar_overlaps(obj, bpy.data.objects['02 Slate support'])
    if obj.name.startswith(('09 ','17 ')):
        lower = [vertex.co for vertex in obj.data.vertices if abs(vertex.co.z-.685) < 1e-5]
        result['maximumSkirtGapM'] = max((apron_distance(p) for p in lower), default=0)
    results.append(result)

report = {'mode': 'baseline' if baseline else 'fixed', 'parts': results,
          'selfCrossings': sum(p['selfCrossings'] for p in results),
          'openEdges': sum(p['openEdges'] for p in results),
          'coplanarLinerOverlaps': sum(p.get('clothCoplanarOverlaps', 0)+p.get('slateCoplanarOverlaps', 0) for p in results),
          'maximumSkirtGapM': max((p.get('maximumSkirtGapM', 0) for p in results), default=0),
          'minimumLinerTopM': min(p['linerTopM'] for p in results if 'linerTopM' in p)}
path = root/'tmp/model-tools/pocket-before.json' if baseline else root/'docs/design/table-model/pocket-validation.json'
path.write_text(json.dumps(report, indent=2)+'\n')
print('POCKET_SURFACE_AUDIT', json.dumps({k:v for k,v in report.items() if k != 'parts'}))
if not baseline:
    assert report['openEdges'] == 0, 'Pocket and cushion surfaces must be closed'
    assert report['selfCrossings'] == 0, 'Pocket and cushion meshes must not cross themselves'
    assert report['coplanarLinerOverlaps'] == 0, 'Pocket liner must clear cloth and slate walls'
    assert report['maximumSkirtGapM'] <= .001, 'Leather skirt must follow the apron within 1mm'

    assert report['minimumLinerTopM'] >= .8005, 'Pocket wall must reach the leather lip without an open vertical seam'
