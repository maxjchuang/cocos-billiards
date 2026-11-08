"""Build a metric design-review model and render all views from the same Blender scene.
Run with Blender --background --python scripts/build-table-model.py.
"""
import bpy
import bmesh
import math
import json
import struct
import hashlib
import runpy
import sys
from pathlib import Path
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from array import array

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/design/table-model'
OUT.mkdir(parents=True, exist_ok=True)
RADIUS = .028575
BED = .80
POCKETS = []

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
model = bpy.data.collections.new('Chinese pool table - metres')
studio = bpy.data.collections.new('Review lighting and cameras')
scene.collection.children.link(model)
scene.collection.children.link(studio)


def move_collection(obj, collection):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    collection.objects.link(obj)


def color(hex_color):
    values = [int(hex_color[i:i+2], 16)/255 for i in (1,3,5)]
    return tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in values) + (1,)


def texture(name, kind, size=512):
    image = bpy.data.images.new(name, width=size, height=size)
    pixels = array('f')
    base = {'cloth':(.08,.27,.17), 'leather':(.25,.14,.08)}[kind]
    for y in range(size):
        v = y/size
        for x in range(size):
            u = x/size
            noise = ((x*92837111 ^ y*689287499) % 1024)/1024-.5
            if kind == 'cloth':
                value = 1 + .035*math.sin(x*math.pi/2)*math.sin(y*math.pi/2)+.035*noise
            else:
                value = 1 + .12*noise+.025*math.sin(u*250)*math.sin(v*211)
            pixels.extend((base[0]*value,base[1]*value,base[2]*value,1))
    image.pixels.foreach_set(pixels)
    texture_directory=OUT/'textures'
    texture_directory.mkdir(exist_ok=True)
    image.filepath_raw=str(texture_directory/(kind+'.png'))
    image.file_format='PNG'
    image.save()
    bpy.data.images.remove(image)
    image=bpy.data.images.load(str(texture_directory/(kind+'.png')),check_existing=False)
    image.colorspace_settings.name='sRGB'
    image.pack()
    image.filepath='//textures/'+kind+'.png'
    return image


def material(name, hex_color, roughness, metallic=0, pattern=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color(hex_color)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = metallic
    if pattern:
        node = mat.node_tree.nodes.new('ShaderNodeTexImage')
        node.image = texture(name+' local texture',pattern)
        mat.node_tree.links.new(node.outputs['Color'],shader.inputs['Base Color'])
    return mat


wood = material('Walnut lacquer V2', '#60432E', .25)
wood_shader = wood.node_tree.nodes.get('Principled BSDF')
wood_shader.inputs['Coat Weight'].default_value = .28
wood_shader.inputs['Coat Roughness'].default_value = .18
wood_image=bpy.data.images.load(str(OUT/'textures/american_walnut_veneer_diff_2k.jpg'),check_existing=False)
wood_image.colorspace_settings.name='sRGB'
wood_image.pack();wood_image.filepath='//textures/american_walnut_veneer_diff_2k.jpg'
wood_texture=wood.node_tree.nodes.new('ShaderNodeTexImage');wood_texture.image=wood_image
wood_tint=(.62,.32,.18,1)
stain=wood.node_tree.nodes.new('ShaderNodeMixRGB');stain.blend_type='MULTIPLY'
stain.inputs[0].default_value=1
stain.inputs[2].default_value=wood_tint
wood.node_tree.links.new(wood_texture.outputs['Color'],stain.inputs[1])
wood.node_tree.links.new(stain.outputs[0],wood_shader.inputs['Base Color'])
felt = material('Forest baize', '#235C42', .91, pattern='cloth')
felt.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.08
leather = material('Tobacco leather', '#583927', .62, pattern='leather')
bronze = material('Muted champagne bronze', '#A58B5A', .29, .72)
thread = material('Warm leather stitching', '#BA9F76', .8)
inside = material('Dark pocket liner', '#0B130E', .92)
stone = material('Slate edge', '#394039', .95)
ivory = material('57.15mm cue ball', '#F2EEDD', .19)


def assign_uv(obj, vertical=False):
    mesh = obj.data
    layer = mesh.uv_layers.new(name='Metric UV')
    for face in mesh.polygons:
        normal = face.normal
        for loop_id in face.loop_indices:
            p = mesh.vertices[mesh.loops[loop_id].vertex_index].co
            if vertical:
                uv = (p.z/1.6+.18,(p.x+p.y)/2+.5)
            elif obj.data.materials[0]==wood:
                if abs(normal.z)>.6:
                    long_axis=abs(face.center.x)>.66 and abs(face.center.y)<1.30
                else:
                    long_axis=abs(normal.x)>abs(normal.y)
                across=p.z if abs(normal.z)<.6 else (abs(p.x) if long_axis else abs(p.y))
                along=(p.y+1.41) if long_axis else (p.x+.77)
                uv=(along/3.2,across/2+.35)
            elif abs(normal.z) > .6:
                uv = (p.x*2.5,p.y*.6)
            elif abs(normal.x) > abs(normal.y):
                uv = (p.z*5,p.y*.6)
            else:
                uv = (p.z*5,p.x*.6)
            layer.data[loop_id].uv = uv


def mesh_object(name, vertices, faces, mat, smooth=False, vertical_uv=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    obj = bpy.data.objects.new(name,mesh)
    model.objects.link(obj)
    obj.data.materials.append(mat)
    assign_uv(obj,vertical_uv)
    for face in mesh.polygons:
        face.use_smooth = smooth
    return obj


def bevel(obj, amount=.004, segments=4):
    mod = obj.modifiers.new('Soft manufactured edges','BEVEL')
    mod.width = amount
    mod.segments = segments
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    normals = obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
    normals.keep_sharp = True
    bpy.ops.object.modifier_apply(modifier=normals.name)


def rounded_rectangle(half_x,half_y,radius,steps=12):
    points=[]
    for cx,cy,start in [(half_x-radius,half_y-radius,0),(-half_x+radius,half_y-radius,90),(-half_x+radius,-half_y+radius,180),(half_x-radius,-half_y+radius,270)]:
        for index in range(steps+1):
            angle=math.radians(start+index*90/steps)
            points.append((cx+radius*math.cos(angle),cy+radius*math.sin(angle)))
    return points


def clean_outline(points):
    result=[]
    for point in points:
        if not result or math.dist(result[-1],point)>1e-7:
            result.append(point)
    if len(result)>1 and math.dist(result[0],result[-1])<1e-7:
        result.pop()
    return result


def orient_closed_mesh(obj):
    mesh=bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(mesh,faces=list(mesh.faces))
    mesh.to_mesh(obj.data)
    mesh.free()
    obj.data.update()


def prism(name,outline,bottom,top,mat):
    outline=clean_outline(outline)
    n=len(outline)
    vertices=[(x,y,z) for z in (bottom,top) for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh_object(name,vertices,faces,mat)


def ring(name,outer,inner,bottom,top,mat):
    n=len(outer)
    vertices=[(x,y,z) for z in (bottom,top) for loop in (outer,inner) for x,y in loop]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,2*n+j,2*n+i),(n+j,n+i,3*n+i,3*n+j),
                      (2*n+i,2*n+j,3*n+j,3*n+i),(j,i,n+i,n+j)])
    return mesh_object(name,vertices,faces,mat)


def cubic(points,steps=32):
    result=[]
    for i in range(steps+1):
        t=i/steps
        result.append(tuple((1-t)**3*points[0][axis]+3*(1-t)**2*t*points[1][axis]+3*(1-t)*t*t*points[2][axis]+t**3*points[3][axis] for axis in range(2)))
    return result


jaw_radius=RADIUS*.5
cut=.085/math.sqrt(2)+jaw_radius*(math.sqrt(2)-1)
shift=(cut-jaw_radius)/2
for sx in (-1,1):
    for sy in (-1,0,1):
        corner=sy!=0
        mouth=.085 if corner else .082
        normal=(sx/math.sqrt(2),sy/math.sqrt(2)) if corner else (sx,0)
        tangent=(-normal[1],normal[0])
        lip=(sx*(.63-shift),sy*(1.27-shift)) if corner else (sx*(.63+jaw_radius),0)
        half=mouth/2
        if corner:
            u=-half-.0225
            v=u+math.sqrt(2)*shift
            controls=[(u,v),(u+.014,v+.014),(-half,.004),(-half,.018)]
        else:
            controls=[(-half-.034,-jaw_radius),(-half-.012,-jaw_radius),(-half,-.004),(-half,.018)]
        back=[(-half*math.cos(i*math.pi/48),.018+half*math.sin(i*math.pi/48)) for i in range(49)]
        front=[(half*math.cos(i*math.pi/48),.018-.026*math.sin(i*math.pi/48)) for i in range(1,49)]
        POCKETS.append({'sx':sx,'sy':sy,'corner':corner,'mouth':mouth,'normal':normal,'tangent':tangent,'lip':lip,'curve':cubic(controls),'opening':clean_outline(back+front)})


def world(pocket,u,v):
    return (pocket['lip'][0]+pocket['tangent'][0]*u+pocket['normal'][0]*v,
            pocket['lip'][1]+pocket['tangent'][1]*u+pocket['normal'][1]*v)


def jaw(pocket,sign):
    return [world(pocket,u*sign,v) for u,v in pocket['curve']]+[world(pocket,pocket['curve'][-1][0]*sign,.026)]


def resample_line(points, count=49):
    lengths=[0]
    for a,b in zip(points,points[1:]):lengths.append(lengths[-1]+math.dist(a,b))
    result=[];segment=0
    for i in range(count):
        target=lengths[-1]*i/(count-1)
        while segment<len(points)-2 and lengths[segment+1]<target:segment+=1
        t=(target-lengths[segment])/(lengths[segment+1]-lengths[segment])
        result.append(tuple(points[segment][axis]*(1-t)+points[segment+1][axis]*t for axis in range(2)))
    return result


def pocket_cap_outer(pocket):
    if pocket['corner']:
        sx,sy=pocket['sx'],pocket['sy']
        points=[(.77,1.20),(.77,1.35)]
        points += [(.71+.06*math.cos(i*math.pi/48),1.35+.06*math.sin(i*math.pi/48)) for i in range(1,25)]
        points.append((.56,1.41))
        points=[(x*sx,y*sy) for x,y in points]
        if sx*sy<0:points.reverse()
    else:
        depth=.77-(.63+jaw_radius)
        local=[(-.075,.025),(-.075,depth-.015)]
        local += [(-.060-.015*math.cos(i*math.pi/32),depth-.015+.015*math.sin(i*math.pi/32)) for i in range(1,17)]
        local.append((.060,depth))
        local += [(.060+.015*math.sin(i*math.pi/32),depth-.015+.015*math.cos(i*math.pi/32)) for i in range(1,17)]
        local.append((.075,.025))
        points=[world(pocket,u,v) for u,v in local]
    return resample_line(points)


def cut_pockets(obj, clearance=0, cap_opening=False):
    for index,pocket in enumerate(POCKETS):
        factor=(pocket['mouth']/2+clearance)/(pocket['mouth']/2)
        outline=[world(pocket,u*factor,.018+(v-.018)*factor) for u,v in pocket['opening']]
        if cap_opening:
            nx,ny=pocket['normal']
            outer=[(x+nx*.002*math.sin(i*math.pi/48)**2,y+ny*.002*math.sin(i*math.pi/48)**2) for i,(x,y) in enumerate(pocket_cap_outer(pocket))]
            half=pocket['mouth']/2
            front=[world(pocket,half*math.cos(i*math.pi/48),.018-.026*math.sin(i*math.pi/48)) for i in range(49)]
            outline=outer+front
        cutter=prism('Temporary pocket cut '+str(index),outline,.52,.96,inside)
        mod=obj.modifiers.new('Pocket aperture '+str(index),'BOOLEAN')
        mod.operation='DIFFERENCE'
        mod.solver='EXACT'
        mod.object=cutter
        bpy.context.view_layer.objects.active=obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter,do_unlink=True)


outer=rounded_rectangle(.77,1.41,.060)
inner_loop=rounded_rectangle(.675,1.315,.010)
handrail=ring('01 Walnut handrail',outer,inner_loop,.774,.850,wood)
cut_pockets(handrail,cap_opening=True)
bevel(handrail,.004,5)
# Each of the six timber caps ends at a separate fitted leather pocket plate.
bpy.ops.object.select_all(action='DESELECT');handrail.select_set(True)
bpy.context.view_layer.objects.active=handrail
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE');bpy.ops.object.mode_set(mode='OBJECT')
caps=list(bpy.context.selected_objects)
assert len(caps)==6, ('wood cap count',len(caps))
for index,cap in enumerate(sorted(caps,key=lambda obj:sum(v.co.y for v in obj.data.vertices)/len(obj.data.vertices))):
    long_axis=1 if cap.dimensions.y>cap.dimensions.x else 0
    cap.name='01 Timber cap '+str(index+1)
    layer=cap.data.uv_layers.active
    minimum=min(v.co[long_axis] for v in cap.data.vertices)
    # Each cap is one physical board. The short caps rotate their UV direction by 90 degrees.
    for face in cap.data.polygons:
        for loop_id in face.loop_indices:
            point=cap.data.vertices[cap.data.loops[loop_id].vertex_index].co
            across=point.x if long_axis==1 else point.y
            transverse=(abs(across)-(.675 if long_axis==1 else 1.315))/2+.08+index*.105
            along=(point[long_axis]-minimum)/1.6+.035*(index%3)
            layer.data[loop_id].uv=(along,transverse)
handrail=caps[0]

slate=prism('02 Slate support',rounded_rectangle(.70,1.34,.035),.750,.794,stone)
cut_pockets(slate)
cloth=prism('03 Baize bed and cloth shelf',rounded_rectangle(.70,1.34,.035),.794,.800,felt)
cut_pockets(cloth)
bevel(cloth,.0008,2)
apron=ring('04 Layered walnut apron',rounded_rectangle(.754,1.394,.075),rounded_rectangle(.660,1.300,.04),.610,.773,wood)
cut_pockets(apron,.025)
bevel(apron,.009,5)
trim=ring('05 Lower apron moulding',rounded_rectangle(.750,1.390,.075),rounded_rectangle(.662,1.302,.035),.607,.628,wood)
cut_pockets(trim,.025)
bevel(trim,.005,3)


def cushion_path(path):
    result=[path[0]]
    for a,b in zip(path,path[1:]):
        count=max(1,math.ceil(math.dist(a,b)/.006))
        for i in range(1,count+1):
            point=tuple(a[axis]+(b[axis]-a[axis])*i/count for axis in range(2))
            if math.dist(result[-1],point)>1e-8:
                result.append(point)
    return result


def cushion_back_widths(path):
    distances=[0]
    for a,b in zip(path,path[1:]):
        distances.append(distances[-1]+math.dist(a,b))
    curvature=[0]*len(path)
    for i in range(1,len(path)-1):
        a,b,c=path[i-1:i+2]
        cross=abs((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]))
        denominator=math.dist(a,b)*math.dist(b,c)*math.dist(a,c)
        curvature[i]=2*cross/denominator if denominator>1e-14 else 0
    curvature[0]=curvature[1]
    curvature[-1]=curvature[-2]
    widths=[]
    for position in distances:
        strongest=0
        for other,k in zip(distances,curvature):
            proximity=max(0,abs(other-position)-.065)/.035
            if proximity<1:
                strongest=max(strongest,k*(1-proximity)**2)
        widths.append(min(.051,.60/strongest) if strongest>1e-8 else .051)
    return widths


def sweep_cushion(name,path,back_axis,back_coordinate):
    path=cushion_path(path)
    widths=cushion_back_widths(path)
    section=[(.012,-.004),(.004,.018),(0,.028),(0,.034),(.004,.039),(.015,.043),(.045,.045),(.051,.030),(.045,-.004)]
    vertices=[]
    shoulder=[]
    count=len(section)
    previous_normal=None
    for i,p in enumerate(path):
        a=path[max(0,i-1)]
        b=path[min(len(path)-1,i+1)]
        dx,dy=b[0]-a[0],b[1]-a[1]
        length=math.hypot(dx,dy)
        nx,ny=-dy/length,dx/length
        if previous_normal is None:
            flip=nx*p[0]+ny*p[1]<0
        else:
            flip=nx*previous_normal[0]+ny*previous_normal[1]<0
        if flip:
            nx,ny=-nx,-ny
        previous_normal=(nx,ny)
        for j,(distance,z) in enumerate(section):
            front=min(.008,widths[i])
            adjusted=min(distance,front)+max(0,distance-front)*(widths[i]-front)/(.051-front)
            point=(p[0]+nx*adjusted,p[1]+ny*adjusted,BED+z)
            vertices.append(point)
            if j==5:
                shoulder.append(point[:2])
    faces=[]
    for i in range(len(path)-1):
        for j in range(count):
            k=(j+1)%count
            faces.append((i*count+j,(i+1)*count+j,(i+1)*count+k,i*count+k))
    faces.extend([tuple(reversed(range(count))),tuple(range((len(path)-1)*count,len(path)*count))])
    obj=mesh_object(name,vertices,faces,felt,True)
    obj.data.polygons[-2].use_smooth=False
    obj.data.polygons[-1].use_smooth=False
    orient_closed_mesh(obj)
    # A separately triangulated rear body fills the timber seat without folding a swept section.
    back_last=list(shoulder[-1])
    back_first=list(shoulder[0])
    back_last[back_axis]=back_coordinate
    back_first[back_axis]=back_coordinate
    outline=shoulder+[tuple(back_last),tuple(back_first)]
    n=len(outline)
    heights=[BED+.043]*len(shoulder)+[BED+.045,BED+.045]
    rear_vertices=[(x,y,BED-.004) for x,y in outline]
    rear_vertices += [(x,y,z) for (x,y),z in zip(outline,heights)]
    projected=[Vector((x,y,0)) for x,y in outline]
    rear_faces=[tuple(reversed(range(n)))]
    for triangle in tessellate_polygon([projected]):
        rear_faces.append(tuple(n+index for index in triangle))
    for i in range(n):
        j=(i+1)%n
        rear_faces.append((i,j,n+j,n+i))
    rear=mesh_object('Temporary cloth-covered cushion rear',rear_vertices,rear_faces,felt)
    orient_closed_mesh(rear)
    join=obj.modifiers.new('Continuous rear body and rounded nose','BOOLEAN')
    join.operation='UNION'
    join.solver='EXACT'
    join.object=rear
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=join.name)
    bpy.data.objects.remove(rear,do_unlink=True)
    orient_closed_mesh(obj)
    return obj


for sx in (-1,1):
    middle=next(p for p in POCKETS if p['sx']==sx and p['sy']==0)
    for sy in (-1,1):
        corner=next(p for p in POCKETS if p['sx']==sx and p['sy']==sy)
        middle_sign=1 if sx*sy<0 else -1
        corner_sign=1 if sx*sy>0 else -1
        path=list(reversed(jaw(middle,middle_sign)))+jaw(corner,corner_sign)
        sweep_cushion(f'06 Long cushion {sx} {sy}',path,0,sx*.680)
for sy in (-1,1):
    left=next(p for p in POCKETS if p['sx']==-1 and p['sy']==sy)
    right=next(p for p in POCKETS if p['sx']==1 and p['sy']==sy)
    left_sign=1 if sy>0 else -1
    right_sign=-1 if sy>0 else 1
    path=list(reversed(jaw(left,left_sign)))+jaw(right,right_sign)
    sweep_cushion(f'07 End cushion {sy}',path,1,sy*1.320)


def tube(name,points,radius,mat):
    curve=bpy.data.curves.new(name,'CURVE')
    curve.dimensions='3D'
    curve.resolution_u=1
    curve.bevel_depth=radius
    curve.bevel_resolution=3
    spline=curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for point,value in zip(spline.points,points):point.co=(*value,1)
    obj=bpy.data.objects.new(name,curve)
    model.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def rounded_rectangle_distance(point,half_x,half_y,radius):
    x=abs(point[0])-(half_x-radius)
    y=abs(point[1])-(half_y-radius)
    return math.hypot(max(x,0),max(y,0))+min(max(x,y),0)-radius


def apron_seat(point):
    cx=max(-.679,min(.679,point[0]))
    cy=max(-1.319,min(1.319,point[1]))
    dx,dy=point[0]-cx,point[1]-cy
    length=math.hypot(dx,dy)
    return cx+dx/length*.0756,cy+dy/length*.0756


def solid_leather(name,vertices,faces):
    obj=mesh_object(name,vertices,faces,leather,True)
    thickness=obj.modifiers.new('Leather thickness and closed end faces','SOLIDIFY')
    thickness.thickness=.003
    thickness.offset=-1
    thickness.use_even_offset=False
    thickness.use_rim=True
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=thickness.name)
    orient_closed_mesh(obj)
    return obj


for index,pocket in enumerate(POCKETS):
    half=pocket['mouth']/2
    # A hollow well supplies depth and a leather collar follows the rear half.
    outline=[world(pocket,u,v) for u,v in pocket['opening']]
    center=Vector(world(pocket,0,.018))
    inner_wall=[center+(Vector(point)-center)*.975 for point in outline]
    outer_wall=[center+(Vector(point)-center)*1.03 for point in outline]
    n=len(outline)
    vertices=[]
    for points,z in [(inner_wall,.801),(inner_wall,.615),(outer_wall,.610),(outer_wall,.801)]:
        vertices.extend((point.x,point.y,z) for point in points)
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces.extend([(i,j,n+j,n+i),(2*n+i,2*n+j,3*n+j,3*n+i),(3*n+i,3*n+j,j,i)])
    faces.extend([tuple(range(n,2*n)),tuple(reversed(range(2*n,3*n)))])
    liner=mesh_object('08 Solid pocket cup '+str(index),vertices,faces,inside,True)
    liner.data.polygons[-2].use_smooth=False
    liner.data.polygons[-1].use_smooth=False
    orient_closed_mesh(liner)
    outer=pocket_cap_outer(pocket)
    inner=[world(pocket,-half*math.cos(i*math.pi/48),.018+half*math.sin(i*math.pi/48)) for i in range(49)]
    collar=[]
    for a,b in zip(inner,outer):
        collar.extend([
            (a[0],a[1],.8005),
            (a[0]*.91+b[0]*.09,a[1]*.91+b[1]*.09,.832),
            (a[0]*.80+b[0]*.20,a[1]*.80+b[1]*.20,.850),
            (b[0],b[1],.846),
        ])
    rows=4
    faces=[]
    for i in range(48):
        for j in range(rows-1):
            faces.append((i*rows+j,(i+1)*rows+j,(i+1)*rows+j+1,i*rows+j+1))
    sample=faces[24*(rows-1)+1]
    top_normal=(Vector(collar[sample[1]])-Vector(collar[sample[0]])).cross(Vector(collar[sample[3]])-Vector(collar[sample[0]]))
    if top_normal.z<0:
        faces=[tuple(reversed(face)) for face in faces]
    solid_leather('09 Solid fitted leather plate '+str(index),collar,faces)
    # The apron skirt follows only the outer table edge; inner cap ends stay at timber depth.
    perimeter=[]
    for point in outer:
        if rounded_rectangle_distance(point,.77,1.41,.06)<-.015:
            continue
        seat=apron_seat(point)
        if perimeter and math.dist(perimeter[-1][1],seat)<1e-6:
            perimeter[-1]=(point,seat)
        else:
            perimeter.append((point,seat))
    skirt=[]
    for point,seat in perimeter:
        skirt.extend([(point[0],point[1],.846),(seat[0],seat[1],.772),(seat[0],seat[1],.685)])
    faces=[]
    for i in range(len(perimeter)-1):
        for j in range(2):
            faces.append((i*3+j,(i+1)*3+j,(i+1)*3+j+1,i*3+j+1))
    sample=faces[(len(perimeter)//2)*2]
    outward=(Vector(skirt[sample[1]])-Vector(skirt[sample[0]])).cross(Vector(skirt[sample[3]])-Vector(skirt[sample[0]]))
    radial=Vector((perimeter[len(perimeter)//2][0][0],perimeter[len(perimeter)//2][0][1],0))
    if outward.dot(radial)<0:
        faces=[tuple(reversed(face)) for face in faces]
    solid_leather('17 Seated leather apron skirt '+str(index),skirt,faces)
    seam=[(a[0]*.02+b[0]*.98,a[1]*.02+b[1]*.98,.846) for a,b in zip(inner,outer)]
    tube('10 Fine collar seam '+str(index),seam,.0008,bronze)
    for j in range(18):
        points=[]
        for sample in (j*48/18,(j+.35)*48/18):
            left=int(sample);fraction=sample-left
            a=Vector(inner[left]).lerp(Vector(inner[min(left+1,48)]),fraction)
            b=Vector(outer[left]).lerp(Vector(outer[min(left+1,48)]),fraction)
            point=a.lerp(b,.25)
            points.append((point.x,point.y,.8494))
        tube(f'11 Stitch {index} {j}',points,.00055,thread)


# A shoulder, a long tapered body and a fitted foot form one consistent leg silhouette.
leg_wood=wood.copy();leg_wood.name='Leg walnut satin V3'
leg_shader=leg_wood.node_tree.nodes.get('Principled BSDF')
leg_shader.inputs['Roughness'].default_value=.34
leg_shader.inputs['Coat Weight'].default_value=.18
leg_shader.inputs['Coat Roughness'].default_value=.23
sole_material=material('Matte foot sole','#111814',.92)
# The main-body radius is concave in height, so the silhouette stays outward-convex.
leg_body_bottom=.075
leg_body_widest=.410
leg_body_top=.475
leg_body_profile=[]
for step in range(65):
    z=leg_body_bottom+(leg_body_top-leg_body_bottom)*step/64
    if z <= leg_body_widest:
        radius=.083-.051*((leg_body_widest-z)/(leg_body_widest-leg_body_bottom))**1.02
    else:
        radius=.083-.024*((z-leg_body_widest)/(leg_body_top-leg_body_widest))**2
    leg_body_profile.append((z,2*radius))
leg_profile=[
    (.030,.092),
    (.037,.090),
    (.045,.074),
    (.052,.070),
    (.058,.082),
    (.064,.090),
    (.070,.084),
]+leg_body_profile+[
    (.479,.128),
    (.484,.136),
    (.490,.132),
    (.495,.120),
    (.503,.112),
    (.512,.132),
    (.520,.150),
]
leg_segments=64
leg_circle=[(math.cos(i*math.tau/leg_segments),math.sin(i*math.tau/leg_segments))
            for i in range(leg_segments)]


for row,y in enumerate((-1.10,0,1.10)):
    for side,x in enumerate((-.565,.565)):
        sx=1 if x>0 else -1
        sy=0 if y==0 else (1 if y>0 else -1)
        def center_at(z):
            amount=max(0,1-z/.65)
            return x+sx*.018*amount,y+sy*.012*amount
        loops=[]
        for z,diameter in leg_profile:
            cx,cy=center_at(z)
            loops.append([(cx+diameter/2*u,cy+diameter/2*v,z) for u,v in leg_circle])
        count=len(loops[0])
        vertices=sum(loops,[])
        faces=[]
        for layer in range(len(loops)-1):
            for i in range(count):
                j=(i+1)%count
                faces.append((layer*count+i,layer*count+j,(layer+1)*count+j,(layer+1)*count+i))
        faces += [tuple(reversed(range(count))),tuple(range(count*(len(loops)-1),count*len(loops)))]
        leg=mesh_object(f'12 Sculpted walnut leg {row} {side}',vertices,faces,leg_wood,True,True)
        leg['partType']='sculpted_leg'
        leg['profile']='continuous outward-convex turned body with wooden collars and foot'
        leg.data.polygons[-2].use_smooth=False
        leg.data.polygons[-1].use_smooth=False
        mount_outline=[(x+u,y+v) for u,v in rounded_rectangle(.075,.075,.003,4)]
        mount=prism(f'15 Recessed leg mount {row} {side}',mount_outline,.515,.675,leg_wood)
        bevel(mount,.0015,3)
        foot_x,foot_y=center_at(.02)
        foot_outline=[(foot_x+.046*u,foot_y+.046*v) for u,v in leg_circle]
        foot=prism(f'13 Fitted bronze foot {row} {side}',foot_outline,.006,.031,leg_wood)
        foot['partType']='turned_wooden_foot'
        bevel(foot,.002,3)
        sole_outline=[(foot_x+.043*u,foot_y+.043*v) for u,v in leg_circle]
        sole=prism(f'16 Foot contact sole {row} {side}',sole_outline,0,.007,sole_material)
        bevel(sole,.0015,2)

bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=RADIUS,location=(0,.57,BED+RADIUS))
ball=bpy.context.object;ball.name='14 Reference cue ball 57.15mm'
move_collection(ball,model);ball.data.materials.append(ivory)
for face in ball.data.polygons:face.use_smooth=True

# Reject self-crossings and open pocket surfaces before publishing the review asset.
runpy.run_path(str(ROOT/'scripts/check-table-pockets.py'),run_name='__main__')
runpy.run_path(str(ROOT/'scripts/check-table-legs.py'),run_name='__main__')

# Validate and export the actual table, excluding the studio setup.
bpy.ops.object.select_all(action='DESELECT')
for obj in model.objects:obj.select_set(True)
scene['Model scope']='Design review; rounded jaws and vertical details are calibrated visual choices'
scene['Dimensions source']='JOY Q8 Pro public outer and playing-bed dimensions'
scene['Candidate pocket mouths mm']='corner 85, side 82; model throat at nose level'
bpy.ops.export_scene.gltf(filepath=str(OUT/'chinese-pool-table.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
# Store the exact linear stain multiplier in the portable glTF material as well.
glb_path=OUT/'chinese-pool-table.glb'
raw=glb_path.read_bytes();json_length=struct.unpack_from('<I',raw,12)[0]
gltf=json.loads(raw[20:20+json_length]);binary_chunks=raw[20+json_length:]
gltf['asset']['extras']={'woodTexture':'American Walnut Veneer by Jenelle van Heerden','woodLicense':'CC0-1.0','woodSource':'https://polyhaven.com/a/american_walnut_veneer'}
for mat in gltf['materials']:
    if mat['name'] in ('Walnut lacquer V2','Leg walnut satin V3'):
        assert 'baseColorTexture' in mat['pbrMetallicRoughness']
        mat['pbrMetallicRoughness']['baseColorFactor']=list(wood_tint)
json_bytes=json.dumps(gltf,separators=(',',':')).encode()
json_bytes+=b' '*((-len(json_bytes))%4)
header=struct.pack('<4sII',b'glTF',2,20+len(json_bytes)+len(binary_chunks))
glb_path.write_bytes(header+struct.pack('<I4s',len(json_bytes),b'JSON')+json_bytes+binary_chunks)


# A shared studio and fixed cameras render the same model.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.002))
ground=bpy.context.object;ground.name='Studio floor';move_collection(ground,studio)
ground.data.materials.append(material('Warm charcoal floor','#46453E',.89))
world_nodes=scene.world.node_tree.nodes if scene.world and scene.world.use_nodes else None
if scene.world is None:scene.world=bpy.data.worlds.new('Studio world')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.10,.12,.105,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.25


def area_light(name,position,power,size,target):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);studio.objects.link(obj);obj.location=position
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()


area_light('Broad overhead',(0,0,3.4),450,3.4,(0,0,.8))
area_light('Warm rail reflection',(-2.4,.5,2.2),180,2.7,(0,0,.6))
area_light('Rim fill',(2,-2,1.9),140,2.0,(0,0,.7))
area_light('Soft leg fill',(2.6,3.1,1.15),170,2.8,(0,.5,.3))
camera_data=bpy.data.cameras.new('Review camera')
camera=bpy.data.objects.new('Review camera',camera_data);studio.objects.link(camera);scene.camera=camera
camera_data.clip_start=.008;camera_data.clip_end=250
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.render.resolution_x=1400
scene.render.resolution_y=950
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=-1.5
bpy.context.preferences.filepaths.save_version=0
views={
    'overview':{'position':(3.6,4.1,2.9),'target':(0,0,.45),'lens':52},
    'aiming':{'position':(0,1.17,.99),'target':(0,-.55,.81),'lens':30},
    'corner':{'position':(.38,1.02,1.05),'target':(.65,1.30,.815),'lens':36},
    'side':{'position':(.35,0,.99),'target':(.68,0,.80),'lens':40},
    'wood':{'position':(1.05,.82,1.19),'target':(.715,.44,.835),'lens':52},
    'legs':{'position':(1.48,2.02,.82),'target':(.58,1.11,.35),'lens':45},
    'skirt':{'position':(1.07,1.54,.79),'target':(.73,1.33,.73),'lens':55},
}
report={'units':'metres','outerDimensionsM':[1.54,2.82,.85],'playingBedM':[1.26,2.54],'clothHeightM':BED,'ballDiameterM':2*RADIUS,'cornerMouthCandidateM':.085,'sideMouthCandidateM':.082,'legs':6,'pockets':6,'views':views,'status':'metric design review model; unmeasured details are visual calibration','revision':'sketch-matched-legs-v8','woodCaps':6,'woodFaceWidthM':.095,'grainTextureResolution':[2048,4096],'grainSource':'Poly Haven American Walnut Veneer, Jenelle van Heerden, CC0','grainMetricSizeM':[1.6,2.0],'timberJoint':'six separate caps fitted to pocket plates','objectCount':len(model.objects),'designChoices':{'clothHeightM':BED,'noseHeightAboveClothM':.034,'railBackHeightM':.045,'pocketDropM':.185,'pocketPlate':'variable-width cover fitted to table-edge corner or side','cornerCurveControls':'parametric cubic; not manufacturer measured','verticalLevels':'design fitting'},'materials':{'woodRoughness':.25,'woodLinearStain':list(wood_tint),'woodCoatWeight':.28,'woodCoatRoughness':.18,'clothRoughness':.91,'clothSpecularIORLevel':.08,'leatherRoughness':.62,'bronzeRoughness':.29,'bronzeMetalness':.72}}
report['designChoices']['railBackWidthM']=.045
report['pocketSurfaceFix']={'leatherThicknessM':.003,'linerTopM':.801,'linerInsetRatio':.975,'cushionBaseM':.796,'rearOffsetRadiusLimit':.60,'skirtSeatClearanceM':.0006}
report['legDesign']={
    'profileLevelsHeightDiameterM':leg_profile,
    'crossSection':'circle',
    'radialSegments':leg_segments,
    'shoulderDiameterM':.166,
    'widestHeightM':leg_body_widest,
    'mainBodyHeightRangeM':[leg_body_bottom,leg_body_top],
    'mainBodyProfile':'continuous outward-convex, no inward waist',
    'mountDimensionsM':[.150,.150,.160],
    'visibleMountHeightBelowApronM':.085,
    'footDiameterHeightM':[.092,.025],
    'footShape':'compact round stepped wooden foot',
    'outwardSplayM':[.018,.012],
    'material':'satin walnut body, collars and foot with dark contact sole',
    'status':'fitted to the approved concept sketch; dimensions are design choices',
    'approvedSketch':'turned-leg-approved.png',
    'reference':'https://www.joybilliard.com/billiards-table/golden-leg-billiards-tables.html',
}
report['materials']['legWoodRoughness']=.34
report['materials']['legWoodCoatWeight']=.18
report['materials']['legWoodCoatRoughness']=.23
report['sources']={'shapeReference':'https://www.knbb.nl/chinese-pool-komt-naar-nederland/','brandReference':'https://www.joybilliard.com/billiards-table/golden-leg-billiards-tables.html','woodAsset':'https://polyhaven.com/a/american_walnut_veneer','woodLicense':'CC0-1.0','woodAssetSha256':hashlib.sha256((OUT/'textures/american_walnut_veneer_diff_2k.jpg').read_bytes()).hexdigest()}
(OUT/'model-spec.json').write_text(json.dumps(report,indent=2)+'\n')
for name,view in views.items():
    camera.location=view['position']
    camera.rotation_euler=(Vector(view['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.lens=view['lens']
    scene.render.filepath='//'+name+'.png'
    if name=='overview':
        for image in bpy.data.images:
            for packed in image.packed_files:
                if image.filepath.startswith('//'):
                    packed.filepath=image.filepath
        for screen in bpy.data.screens:
            for area in screen.areas:
                for space in area.spaces:
                    if space.type=='FILE_BROWSER' and space.params:
                        # Clear stale bytes in the fixed-size directory buffer before making it relative.
                        space.params.directory=b' '*1023
                        space.params.directory=b'//'
        bpy.ops.object.select_all(action='DESELECT')
        handrail.select_set(True)
        bpy.context.view_layer.objects.active=handrail
        for screen in bpy.data.screens:
            for area in screen.areas:
                if area.type=='VIEW_3D':
                    area.spaces.active.region_3d.view_perspective='CAMERA'
        bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'chinese-pool-table.blend'))
    if '--geometry-only' not in sys.argv:
        bpy.ops.render.render(write_still=True)
        # Keep pixel data intact while removing render metadata that can contain local file paths.
        image_path=Path(bpy.path.abspath(scene.render.filepath))
        png=image_path.read_bytes();clean=bytearray(png[:8]);offset=8
        while offset<len(png):
            length=struct.unpack_from('>I',png,offset)[0];kind=png[offset+4:offset+8]
            if kind not in (b'tEXt',b'zTXt',b'iTXt',b'eXIf'):
                clean.extend(png[offset:offset+12+length])
            offset+=12+length
        image_path.write_bytes(clean)
print('Metric table and GLB export checks complete' if '--geometry-only' in sys.argv else 'Metric table, GLB and shared-model renders completed')
