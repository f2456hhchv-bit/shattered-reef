import bpy, math, os
from mathutils import Vector

# Authored low-poly character asset for Shattered Reef. Blender coordinates follow the game: +Z is forward.
OUT = os.path.join(os.path.dirname(__file__), '../../public/assets/characters/bellwether-player.glb')
OUT = os.path.abspath(OUT)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for block in bpy.data.materials: bpy.data.materials.remove(block)

def material(name, color, metallic=0.0, roughness=.88):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*color,1); p.inputs['Metallic'].default_value=metallic; p.inputs['Roughness'].default_value=roughness
    return m
MAT={
 'skin':material('Warm sunlit skin',(0.56,.32,.20)), 'skinLight':material('Face highlights',(.68,.43,.29)),
 'shirt':material('Salt linen',(.76,.70,.55)), 'teal':material('Harbour blue wool',(.10,.23,.29)),
 'tealLight':material('Blue wool edge',(.18,.34,.38)), 'leather':material('Oiled chestnut leather',(.25,.13,.075)),
 'leatherLight':material('Worn saddle leather',(.48,.29,.15)), 'trouser':material('Deep indigo cloth',(.16,.20,.25)),
 'boot':material('Waxed sea boots',(.17,.10,.065)), 'metal':material('Dull iron',(.31,.34,.34),.36),
 'steel':material('Brushed steel',(.53,.57,.56),.42), 'brass':material('Aged brass',(.61,.42,.16),.52),
 'chitin':material('Mottled olive shell',(.30,.34,.20)), 'chitinLight':material('Shell edge',(.53,.48,.30)),
 'snake':material('Salt-sage hide',(.36,.42,.27)), 'snakeLight':material('Pale hide seam',(.64,.57,.36)),
 'hair':material('Dark chestnut hair',(.105,.055,.032)), 'eye':material('Deep brown eyes',(.035,.022,.016)),
 'cape':material('Reef-red sailcloth',(.39,.12,.095)), 'wood':material('Cutlass grip',(.29,.16,.09)),
}

def mesh_obj(name, verts, faces, mats, smooth=True):
    me=bpy.data.meshes.new(name); me.from_pydata(verts,[],faces); me.materials.clear()
    for m in mats: me.materials.append(m)
    me.update(); ob=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(ob)
    if smooth:
        for p in me.polygons: p.use_smooth=True
    return ob

def loft(name, profile, mat, segments=18, zcenter=0, smooth=True):
    # profile: (y, radius-x, radius-z); clean swept human forms, not assembled stock primitives.
    vs=[]; fs=[]
    for y,rx,rz in profile:
        for i in range(segments):
            a=2*math.pi*i/segments; vs.append((rx*math.cos(a),y,zcenter+rz*math.sin(a)))
    for j in range(len(profile)-1):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments
            fs.append((a,b,b+segments,a+segments))
    fs += [tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))]
    return mesh_obj(name,vs,fs,[mat],smooth)

def sphere_mesh(name, center, scale, mat, rings=12, segments=18):
    vs=[]; fs=[]
    for j in range(rings+1):
        phi=math.pi*j/rings
        for i in range(segments):
            theta=2*math.pi*i/segments
            vs.append((center[0]+scale[0]*math.sin(phi)*math.cos(theta), center[1]+scale[1]*math.cos(phi), center[2]+scale[2]*math.sin(phi)*math.sin(theta)))
    for j in range(rings):
        for i in range(segments):
            a=j*segments+i;b=j*segments+(i+1)%segments
            fs.append((a,b,b+segments,a+segments))
    return mesh_obj(name,vs,fs,[mat],True)

def tube(name, points, radius, mat, steps=12):
    cu=bpy.data.curves.new(name,'CURVE'); cu.dimensions='3D'; cu.resolution_u=2; cu.bevel_depth=radius; cu.bevel_resolution=2
    sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(points)-1)
    for bp,co in zip(sp.bezier_points,points): bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    ob=bpy.data.objects.new(name,cu);bpy.context.collection.objects.link(ob);ob.data.materials.append(mat)
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.convert(target='MESH');ob=bpy.context.object;ob.select_set(False)
    return ob

def block(name, center, size, mat, bevel=.04):
    # bevelled custom boxes for plates, buckles, shoes and grips
    bpy.ops.mesh.primitive_cube_add(size=1, location=center); ob=bpy.context.object; ob.name=name
    ob.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=ob.modifiers.new('Soft worn edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.data.materials.append(mat)
    for p in ob.data.polygons:p.use_smooth=True
    return ob

# Proportions: 1.8 m adult, long limbs, compact head, defined hands and feet.
arm=bpy.data.armatures.new('Bellwether Humanoid Skeleton'); rig=bpy.data.objects.new('Bellwether_Player_Rig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
def bone(name, head, tail, parent=None, connected=False):
    b=arm.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm.edit_bones[parent];b.use_connect=connected
    return b
bone('Root',(0,.94,0),(0,1.08,0))
bone('Spine',(0,.94,0),(0,1.43,0),'Root')
bone('Neck',(0,1.43,0),(0,1.55,0),'Spine',True)
bone('Head',(0,1.55,0),(0,1.82,0),'Neck',True)
for side, s in [('L',-1),('R',1)]:
    bone('Clavicle.'+side,(0,1.39,0),(.25*s,1.42,0),'Spine')
    bone('UpperArm.'+side,(.25*s,1.42,0),(.43*s,1.13,0),'Clavicle.'+side)
    bone('Forearm.'+side,(.43*s,1.13,0),(.34*s,.88,0),'UpperArm.'+side,True)
    bone('Hand.'+side,(.34*s,.88,0),(.34*s,.78,.04),'Forearm.'+side,True)
    bone('UpperLeg.'+side,(.12*s,.94,0),(.12*s,.49,0),'Root')
    bone('LowerLeg.'+side,(.12*s,.49,0),(.12*s,.10,.02),'UpperLeg.'+side,True)
    bone('Foot.'+side,(.12*s,.10,.02),(.12*s,.075,.18),'LowerLeg.'+side,True)
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)

# Weighted skin pieces. Upper/lower limb overlap is deliberate at the elbow and knee to keep the joints covered.
def bind(ob, weights):
    ob.parent=rig; mod=ob.modifiers.new('Skeletal deformation','ARMATURE');mod.object=rig
    groups={name:ob.vertex_groups.new(name=name) for name in weights}
    # weight callback returns bone -> weight per vertex
    for i,v in enumerate(ob.data.vertices):
        for name,w in weights.items():
            value=w(v,i)
            if value>0.001:groups[name].add([i],value,'REPLACE')
    return ob

def torso_weight(v,i):
    y=v.co.y
    if y<1.02:return {'Root':.8,'Spine':.2}
    if y<1.18:
        t=(y-1.02)/.16;return {'Root':1-t,'Spine':t}
    if y<1.42:return {'Spine':1}
    t=min(1,(y-1.42)/.12);return {'Spine':1-t,'Neck':t}

base=loft('Body_Linen_Tunic',[(.98,.175,.11),(1.02,.205,.12),(1.10,.205,.12),(1.20,.19,.115),(1.31,.225,.125),(1.42,.255,.13),(1.50,.14,.09)],MAT['shirt'],22)
bind(base,{'Root':lambda v,i:torso_weight(v,i).get('Root',0),'Spine':lambda v,i:torso_weight(v,i).get('Spine',0),'Neck':lambda v,i:torso_weight(v,i).get('Neck',0)})
# Torso shaping darts and shirt collar.
collar=loft('Linen_Collar',[(1.45,.085,.07),(1.48,.12,.08),(1.51,.105,.074)],MAT['shirt'],16)
bind(collar,{'Spine':lambda v,i:1.0})
# Head has a jaw-heavy silhouette, cheeks, brows, ears, nose and legible eyes. Face points north (+Z).
head=sphere_mesh('Face_Sculpt',(0,1.66,.005),(.132,.19,.125),MAT['skin'],16,24);bind(head,{'Head':lambda v,i:1})
for s in [-1,1]:
    ob=sphere_mesh('Ear',(.137*s,1.68,0),(.035,.055,.033),MAT['skinLight'],10,14);bind(ob,{'Head':lambda v,i:1})
    ob=sphere_mesh('Cheek',(.071*s,1.62,.092),(.064,.075,.045),MAT['skinLight'],10,14);bind(ob,{'Head':lambda v,i:1})
    ob=sphere_mesh('Eye',(.047*s,1.70,.119),(.024,.017,.012),MAT['eye'],8,12);bind(ob,{'Head':lambda v,i:1})
    ob=tube('Brow',[(.023*s,1.728,.12),(.052*s,1.738,.124),(.075*s,1.725,.115)],.012,MAT['hair']);bind(ob,{'Head':lambda v,i:1})
nose=sphere_mesh('Nose',(0,1.655,.134),(.031,.046,.033),MAT['skinLight'],10,14);bind(nose,{'Head':lambda v,i:1})
tube('Mouth',[(-.028,1.59,.12),(0,1.584,.131),(.028,1.59,.12)],.006,MAT['hair'])
# Hairline and swept-back tied hair shape.
hair=sphere_mesh('Hair_Cap',(0,1.76,-.008),(.14,.105,.13),MAT['hair'],10,18);bind(hair,{'Head':lambda v,i:1})
queue=loft('Hair_Queue',[(1.56,.025,.03),(1.61,.035,.035),(1.69,.032,.03)],MAT['hair'],10,zcenter=-.12);bind(queue,{'Head':lambda v,i:1})
# Base trousers and legs, each bone weighted to retain readable hips, knees and ankle creases.
for side,s in [('L',-1),('R',1)]:
    leg=loft('Deckhand_Legs_'+side,[(.47,.078,.085),(.53,.085,.09),(.70,.09,.092),(.89,.102,.105),(.99,.11,.11)],MAT['trouser'],14,zcenter=0)
    # offset each loft mesh in local coords before skinning
    for v in leg.data.vertices:v.co.x+=.12*s
    def lw(v,i,s=s):
        y=v.co.y
        if y<.51:return {'LowerLeg.'+('L' if s<0 else 'R'):1}
        if y<.58:
            t=(y-.51)/.07;return {'LowerLeg.'+('L' if s<0 else 'R'):t,'UpperLeg.'+('L' if s<0 else 'R'):1-t}
        return {'UpperLeg.'+('L' if s<0 else 'R'):1}
    bind(leg,{'UpperLeg.'+side:lambda v,i,s=s:lw(v,i,s).get('UpperLeg.'+side,0),'LowerLeg.'+side:lambda v,i,s=s:lw(v,i,s).get('LowerLeg.'+side,0)})
    boot=loft('Sea_Boot_'+side,[(.08,.075,.11),(.13,.078,.13),(.27,.075,.09),(.35,.078,.09),(.41,.082,.09)],MAT['boot'],14,zcenter=.055)
    for v in boot.data.vertices:v.co.x+=.12*s
    bind(boot,{'LowerLeg.'+side:lambda v,i:1})
    toe=block('Boot_Toe_'+side,(.12*s,.12,.17),(.15,.12,.26),MAT['boot'],.045);bind(toe,{'Foot.'+side:lambda v,i:1})
    # Shaped shoulder, sleeve, forearm, palm, thumb and four separated finger forms.
    armprof=[(.91,.045,.052),(1.00,.055,.06),(1.12,.063,.065),(1.22,.075,.075),(1.35,.09,.08),(1.45,.085,.075)]
    upper=loft('Sleeve_'+side,armprof,MAT['teal'],14,zcenter=0)
    for v in upper.data.vertices:v.co.x+=.34*s
    def armw(y, upper=True, side=side):
        if y<1.08:return {'Forearm.'+side:1}
        if y<1.19:
            t=(y-1.08)/.11;return {'Forearm.'+side:1-t,'UpperArm.'+side:t}
        return {'UpperArm.'+side:1}
    bind(upper,{'UpperArm.'+side:lambda v,i:armw(v.co.y,side=side).get('UpperArm.'+side,0),'Forearm.'+side:lambda v,i:armw(v.co.y,side=side).get('Forearm.'+side,0)})
    fore=loft('Forearm_'+side,[(.86,.042,.045),(.92,.052,.05),(1.03,.055,.052),(1.12,.06,.057)],MAT['skin'],12)
    for v in fore.data.vertices:v.co.x+=.34*s
    bind(fore,{'Forearm.'+side:lambda v,i:1})
    palm=sphere_mesh('Palm_'+side,(.34*s,.86,.012),(.055,.072,.045),MAT['skin'],10,14);bind(palm,{'Hand.'+side:lambda v,i:1})
    for f in range(4):
        x=.34*s+(f-1.5)*.025
        finger=loft('Finger_'+side,[(.765,.009,.012),(.79,.011,.014),(.82,.012,.014),(.84,.011,.013)],MAT['skin'],8,zcenter=.02)
        for v in finger.data.vertices:v.co.x+=(x-.34*s)
        bind(finger,{'Hand.'+side:lambda v,i:1})
    thumb=sphere_mesh('Thumb_'+side,(.34*s+(.05 if s>0 else -.05),.83,.015),(.025,.044,.025),MAT['skin'],8,10);bind(thumb,{'Hand.'+side:lambda v,i:1})
# Neck joins jaw and chest without a visible gap.
neck=loft('Neck',[(1.43,.055,.055),(1.50,.06,.06),(1.59,.058,.06)],MAT['skin'],14)
bind(neck,{'Neck':lambda v,i:1})

# Distinct, equipped base deckhand set (cut jacket, asymmetrical leather shoulder strap, split coat tails).
body=loft('Deckhand_Body',[(.88,.205,.12),(.94,.235,.135),(1.05,.225,.13),(1.2,.205,.12),(1.34,.25,.138),(1.46,.265,.14),(1.50,.12,.08)],MAT['teal'],20)
bind(body,{'Root':lambda v,i:max(0,min(1,(1.14-v.co.y)/.2)),'Spine':lambda v,i:1-max(0,min(1,(1.14-v.co.y)/.2))})
# brass piping, cross-body baldric, belt and buckle
for side in [-1,1]:
    tube('Jacket_Piping',[(side*.22,.94,.11),(side*.24,1.1,.12),(side*.22,1.34,.12)],.012,MAT['tealLight'])
    bind(bpy.context.object,{'Spine':lambda v,i:1})
strap=tube('Crossbody_Baldric',[(-.23,1.43,.1),(-.12,1.27,.145),(0,1.12,.155),(.18,.96,.12)],.028,MAT['leatherLight']);bind(strap,{'Spine':lambda v,i:1})
belt=block('Belt',(0,.99,.135),(.42,.065,.04),MAT['leather'],.018);bind(belt,{'Root':lambda v,i:1})
buckle=block('Buckle',(0,.99,.16),(.08,.075,.025),MAT['brass'],.012);bind(buckle,{'Root':lambda v,i:1})

# Optional slots are separate skinned meshes; visibility changes directly from the equipped inventory IDs.
def slot_object(name, ob, bone_name):
    return bind(ob,{bone_name:lambda v,i:1})
# Two armours differ in construction, cut and material, not just recolour.
# Chitin guard: broad overlapping shell cuirass, shoulder caps, edged plates and full greaves.
chest=loft('Harbourguard_Armour',[(1.02,.225,.145),(1.08,.255,.16),(1.2,.235,.148),(1.34,.285,.16),(1.45,.29,.15)],MAT['chitin'],18)
bind(chest,{'Spine':lambda v,i:1})
for s in [-1,1]:
    p=sphere_mesh('Guard_Pauldron',(s*.245,1.39,.005),(.13,.105,.145),MAT['chitinLight'],10,14);bind(p,{'Spine':lambda v,i:1})
    plate=loft('Harbourguard_Legs_'+str(s),[(.43,.085,.095),(.53,.09,.095),(.66,.085,.09),(.74,.08,.09)],MAT['chitin'],12)
    for v in plate.data.vertices:v.co.x+=.12*s
    bind(plate,{'UpperLeg.'+('L' if s<0 else 'R'):lambda v,i:1})
# Snake runner: narrow wrapped vest, offset shoulder scarf and split flexible panels.
snake=loft('Snakeskin_Body',[(.96,.19,.125),(1.05,.22,.13),(1.2,.205,.12),(1.35,.24,.135),(1.43,.205,.11)],MAT['snake'],18)
bind(snake,{'Spine':lambda v,i:1})
for s in [-1,1]:
    tube('Ranger_Seam',[(s*.17,1.02,.13),(s*.21,1.19,.135),(s*.22,1.36,.11)],.018,MAT['snakeLight'])
    bind(bpy.context.object,{'Spine':lambda v,i:1})
for s in [-1,1]:
    panel=loft('Snakeskin_Legwrap_'+str(s),[(.41,.078,.085),(.51,.09,.095),(.68,.092,.092),(.82,.094,.098)],MAT['snake'],12)
    for v in panel.data.vertices:v.co.x+=.12*s
    bind(panel,{'UpperLeg.'+('L' if s<0 else 'R'):lambda v,i:1})
# Visible headwear, gloves, boots, cape. Armour-specific head silhouettes are deliberately distinct.
cap=loft('Gear_Head_Cap',[(1.77,.12,.105),(1.82,.13,.115),(1.86,.11,.1)],MAT['leatherLight'],16);bind(cap,{'Head':lambda v,i:1})
helm=loft('Gear_Head_Helm',[(1.69,.135,.135),(1.75,.145,.14),(1.84,.13,.12),(1.91,.07,.08)],MAT['metal'],16);bind(helm,{'Head':lambda v,i:1})
for s in [-1,1]:
    glove=loft('Gear_Glove_'+str(s),[(.79,.045,.05),(.84,.052,.055),(.89,.047,.047)],MAT['leather'],12,zcenter=.02)
    for v in glove.data.vertices:v.co.x+=.34*s
    bind(glove,{'Hand.'+('L' if s<0 else 'R'):lambda v,i:1})
    boottrim=loft('Gear_Boot_Cuff_'+str(s),[(.23,.081,.095),(.27,.085,.095),(.31,.082,.09)],MAT['leatherLight'],12,zcenter=.055)
    for v in boottrim.data.vertices:v.co.x+=.12*s
    bind(boottrim,{'LowerLeg.'+('L' if s<0 else 'R'):lambda v,i:1})
# split short cape follows shoulders, its lower edge is offset to avoid stiff rectangular silhouette
cape=loft('Gear_Cape',[(.79,.22,.075),(.86,.245,.08),(.99,.25,.09),(1.16,.20,.075)],MAT['cape'],18,zcenter=-.11)
bind(cape,{'Root':lambda v,i:max(0,min(1,(1.02-v.co.y)/.2)),'Spine':lambda v,i:1-max(0,min(1,(1.02-v.co.y)/.2))})

# Sword and shield meshes are bound to hand bones, at real attachment points.
blade=loft('Mainhand_Cutlass',[(.83,.018,.014),(.92,.025,.02),(1.18,.03,.015),(1.28,.006,.005)],MAT['steel'],8,zcenter=.10)
for v in blade.data.vertices:v.co.x+=.34
# orient blade as a forward/upward tapered edge
bind(blade,{'Hand.R':lambda v,i:1})
guard=tube('Cutlass_Guard',[(.275,.92,.09),(.34,.91,.10),(.405,.92,.09)],.018,MAT['brass']);bind(guard,{'Hand.R':lambda v,i:1})
grip=loft('Cutlass_Grip',[(.78,.021,.022),(.83,.023,.023),(.91,.022,.022)],MAT['wood'],8,zcenter=.10);bind(grip,{'Hand.R':lambda v,i:1})
# Round hand shield: shaped boss and three raised bands give it a strong readable face.
for v in grip.data.vertices:v.co.x+=.34
shield=sphere_mesh('Offhand_Shield',(-.34,.94,.055),(.24,.29,.075),MAT['leatherLight'],12,20);bind(shield,{'Hand.L':lambda v,i:1})
boss=sphere_mesh('Shield_Boss',(-.34,.94,.124),(.07,.08,.025),MAT['brass'],8,12);bind(boss,{'Hand.L':lambda v,i:1})
for s in [-1,1]:
    rib=tube('Shield_Rib',[(-.34+s*.03,.73,.11),(-.34+s*.16,.94,.12),(-.34+s*.03,1.15,.11)],.012,MAT['leather']);bind(rib,{'Hand.L':lambda v,i:1})

# Runtime visibility is controlled by equipment IDs. Merge same-material pieces by equipment layer and bone rig to
# keep the skinned model under a mobile-friendly draw-call budget without losing part silhouettes or set swapping.
def layer(name):
    if name.startswith('Deckhand_Body'): return 'Deckhand_Body'
    if name.startswith('Deckhand_Legs'): return 'Deckhand_Legs'
    if name.startswith(('Harbourguard_Armour','Guard_Pauldron')): return 'Harbourguard_Armour'
    if name.startswith('Harbourguard_Legs'): return 'Harbourguard_Legs'
    if name.startswith(('Snakeskin_Body','Ranger_Seam')): return 'Snakeskin_Body'
    if name.startswith('Snakeskin_Legwrap'): return 'Snakeskin_Legwrap'
    if name.startswith('Gear_Head_Cap'): return 'Gear_Head_Cap'
    if name.startswith('Gear_Head_Helm'): return 'Gear_Head_Helm'
    if name.startswith('Gear_Glove'): return 'Gear_Glove'
    if name.startswith('Gear_Boot_Cuff'): return 'Gear_Boot_Cuff'
    if name.startswith('Gear_Cape'): return 'Gear_Cape'
    if name.startswith(('Mainhand_Cutlass','Cutlass_')): return 'Mainhand_Cutlass'
    if name.startswith(('Offhand_Shield','Shield_')): return 'Offhand_Shield'
    return 'Base'

merge_groups={}
for ob in list(bpy.context.scene.objects):
    if ob.type!='MESH': continue
    ob.hide_viewport=False;ob.hide_render=False;ob.hide_set(False)
    material_name=ob.data.materials[0].name if ob.data.materials else 'Unpainted'
    merge_groups.setdefault((layer(ob.name),material_name),[]).append(ob)
for (category,material_name),objects in merge_groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objects: ob.select_set(True)
    active=objects[0];bpy.context.view_layer.objects.active=active
    if len(objects)>1:bpy.ops.object.join()
    active.name=f'{category}_{material_name.replace(" ","_")}'
# Every mesh stays attached to the same articulated armature, grouped only while material and equipment visibility agree.

# Four coherent clips; action blending at runtime is handled by Three.js AnimationMixer.
def action(name, frames):
    bpy.context.scene.frame_end=max(f for f,_ in frames)
    rig.animation_data_create()
    rig.animation_data.action=bpy.data.actions.new(name)
    for b in arm.bones:b.select=False
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='POSE')
    for frame, values in frames:
        bpy.context.scene.frame_set(frame)
        for bone_name, euler in values.items():
            pb=rig.pose.bones[bone_name];pb.rotation_mode='XYZ';pb.rotation_euler=euler;pb.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone_name)
    bpy.ops.object.mode_set(mode='OBJECT'); rig.animation_data.action.use_fake_user=True

idle={}
walk0={};walk1={};run0={};run1={}
for side,sgn in [('L',1),('R',-1)]:
    idle['UpperLeg.'+side]=(0,0,0); idle['UpperArm.'+side]=(0,0,0)
    walk0['UpperLeg.'+side]=(.48*sgn,0,0);walk1['UpperLeg.'+side]=(-.48*sgn,0,0)
    walk0['LowerLeg.'+side]=(0 if sgn>0 else .38,0,0);walk1['LowerLeg.'+side]=(.38 if sgn>0 else 0,0,0)
    walk0['UpperArm.'+side]=(-.32*sgn,0,0);walk1['UpperArm.'+side]=(.32*sgn,0,0)
    run0['UpperLeg.'+side]=(.78*sgn,0,0);run1['UpperLeg.'+side]=(-.78*sgn,0,0)
    run0['LowerLeg.'+side]=(0 if sgn>0 else .7,0,0);run1['LowerLeg.'+side]=(.7 if sgn>0 else 0,0,0)
    run0['UpperArm.'+side]=(-.56*sgn,0,0);run1['UpperArm.'+side]=(.56*sgn,0,0)
action('Idle',[(1,idle),(13,{**idle,'Spine':(.015,0,0)}),(25,idle)])
action('Walk',[(1,walk0),(9,walk1),(17,walk0)])
action('Run',[(1,run0),(7,run1),(13,run0)])
slash0={'UpperArm.R':(-.65,0,-.35),'Forearm.R':(-.45,0,0),'Spine':(0,-.18,0)}
slash1={'UpperArm.R':(1.05,0,.75),'Forearm.R':(-.12,0,-.18),'Spine':(0,.35,0)}
slash2={'UpperArm.R':(-.1,0,.12),'Forearm.R':(-.3,0,0),'Spine':(0,-.04,0)}
action('MeleeSlash',[(1,slash0),(5,slash1),(10,slash2),(14,{})])
action('Work',[(1,{'UpperArm.R':(-1.1,0,0),'UpperArm.L':(-.85,0,0),'Forearm.R':(-.3,0,0),'Forearm.L':(-.25,0,0)}),(8,{'UpperArm.R':(-.1,0,0),'UpperArm.L':(-.2,0,0),'Forearm.R':(-.8,0,0),'Forearm.L':(-.6,0,0)}),(15,{'UpperArm.R':(-1.1,0,0),'UpperArm.L':(-.85,0,0),'Forearm.R':(-.3,0,0),'Forearm.L':(-.25,0,0)})])
action('Fishing',[(1,{'UpperArm.R':(-1.15,0,-.1),'Forearm.R':(-.5,0,0),'UpperArm.L':(-.72,0,0),'Forearm.L':(-.25,0,0)}),(12,{'UpperArm.R':(-.75,0,.22),'Forearm.R':(-.25,0,0),'UpperArm.L':(-.62,0,0),'Forearm.L':(-.2,0,0)}),(24,{'UpperArm.R':(-1.15,0,-.1),'Forearm.R':(-.5,0,0),'UpperArm.L':(-.72,0,0),'Forearm.L':(-.25,0,0)})])
action('RangedShot',[(1,{'UpperArm.R':(-.82,0,-.18),'Forearm.R':(-.38,0,0),'UpperArm.L':(-.52,0,.12),'Forearm.L':(-.36,0,0),'Spine':(0,-.08,0)}),(4,{'UpperArm.R':(-.48,0,.08),'Forearm.R':(-.18,0,0),'UpperArm.L':(-.48,0,.05),'Forearm.L':(-.16,0,0),'Spine':(0,.08,0)}),(9,{})])
action('Spellcast',[(1,{'UpperArm.R':(-1.1,0,-.36),'Forearm.R':(-.35,0,0),'UpperArm.L':(-1.0,0,.3),'Forearm.L':(-.3,0,0),'Spine':(0,-.12,0)}),(8,{'UpperArm.R':(-.75,0,-.18),'Forearm.R':(-.18,0,0),'UpperArm.L':(-.8,0,.18),'Forearm.L':(-.22,0,0),'Spine':(0,.1,0)}),(16,{})])
action('HitReact',[(1,{'Spine':(-.08,0,0),'UpperArm.R':(-.28,0,-.16),'UpperArm.L':(-.28,0,.16)}),(4,{'Spine':(.10,0,0),'UpperArm.R':(-.12,0,-.08),'UpperArm.L':(-.12,0,.08)}),(9,{})])
# Restore bind pose/action then export selected character rig and all skinned meshes.
for ob in bpy.context.scene.objects:ob.select_set(False)
rig.select_set(True);bpy.context.view_layer.objects.active=rig
# Geometry and rig are authored with Y as their up axis to match Three.js. Keep that basis
# intact; the Blender default Z-up conversion would turn the model sideways when the runtime
# applies player yaw.
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',use_selection=False,export_animations=True,export_animation_mode='ACTIONS',export_nla_strips=False,export_skins=True,export_materials='EXPORT',export_apply=True,export_yup=False)
print('Wrote',OUT,os.path.getsize(OUT))
