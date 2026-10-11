# Génère les LOD « lointains » (≈20 % des triangles) à partir des GLB lo
# du parc : python3 tools/blender/far_lod.py
import bpy, os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'fleet')
ULTRA = '--ultra' in sys.argv
IDS = [a for a in sys.argv[1:] if not a.startswith('--')] or ['mistral', 'aurore', 'concorde', 'taxi', 'riviera', 'atlas', 'odyssee', 'cargo', 'furia', 'lutece']
DROP = ('Seat', 'Dash', 'Steer', 'Interior', 'Wiper', 'Antenna', 'Handle', 'Repeater')


def tris():
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')


for vid in IDS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, f'{vid}.glb'))
    t0 = tris()
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and any(o.name.startswith(d) for d in DROP):
            bpy.data.objects.remove(o, do_unlink=True)
    for o in list(bpy.data.objects):
        if o.type != 'MESH':
            continue
        n = sum(len(p.vertices) - 2 for p in o.data.polygons)
        if n < 60:
            if n < (60 if ULTRA else 24) and not any(k in o.name for k in ('Lamp', 'Tail', 'Head', 'Plate')):
                bpy.data.objects.remove(o, do_unlink=True)
            continue
        bpy.context.view_layer.objects.active = o
        m = o.modifiers.new('dec', 'DECIMATE')
        m.ratio = (0.03 if n > 2000 else 0.08) if ULTRA else (0.1 if n > 2000 else 0.22)
        m.use_collapse_triangulate = True
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier='dec')
    for o in bpy.data.objects:
        o.select_set(o.type == 'MESH')
    out = os.path.join(ROOT, f'{vid}_{"ufar" if ULTRA else "far"}.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_materials='EXPORT', export_animations=False)
    print('FAR', vid, t0, '->', tris(), os.path.getsize(out))
