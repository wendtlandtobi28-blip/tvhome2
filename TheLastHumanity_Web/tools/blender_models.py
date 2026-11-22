"""
THE LAST HUMANITY - 3D-Modelle per Blender-Skript (Blender 5.x als Python-Modul "bpy").

Erzeugt eigene, frei nutzbare Modelle (keine Fremdinhalte):
  assets/models/hero.glb     gepanzerte Spielfigur mit Gelenk-Hierarchie (fuer Animation im Spiel)
  assets/models/shuttle.glb  kleines Raumschiff
  assets/models/cruiser.glb  grosser Kreuzer (Hintergrund)

Aufruf:  <python-mit-bpy> tools/blender_models.py   (aus dem Ordner TheLastHumanity_Web)

Achsen: Blender Z = oben, Figur schaut nach -Y (glTF-Export wandelt in Y-oben, Blick +Z).
"""
import math
import os
import sys

import bpy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "models")
os.makedirs(OUT, exist_ok=True)


# --------------------------------------------------------------------------- Hilfen

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, metallic=0.0, roughness=0.5, emission=None, strength=0.0):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return mat


def mats():
    return {
        "armor": material("Ruestung", (0.045, 0.05, 0.058), metallic=0.85, roughness=0.32),
        "trim": material("Zierkante", (0.55, 0.42, 0.22), metallic=0.95, roughness=0.28),
        "suit": material("Anzug", (0.02, 0.022, 0.026), metallic=0.1, roughness=0.85),
        "accent": material("Akzent", (0.42, 0.03, 0.03), metallic=0.3, roughness=0.45),
        "skin": material("Haut", (0.62, 0.45, 0.36), metallic=0.0, roughness=0.6),
        "hair": material("Haar", (0.03, 0.025, 0.02), metallic=0.0, roughness=0.7),
        "glow": material("Leuchte", (0.3, 0.7, 1.0), emission=(0.3, 0.75, 1.0), strength=6.0),
        "hull": material("Rumpf", (0.16, 0.17, 0.19), metallic=0.8, roughness=0.38),
        "hull_dark": material("RumpfDunkel", (0.06, 0.065, 0.075), metallic=0.8, roughness=0.42),
        "engine": material("Antrieb", (1.0, 0.55, 0.2), emission=(1.0, 0.55, 0.25), strength=12.0),
        "window": material("Fenster", (0.9, 0.75, 0.45), emission=(1.0, 0.8, 0.5), strength=5.0),
    }


def finish(obj, mat, bevel=0.0, segments=3, subsurf=0, smooth=True):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    if bevel > 0:
        m = obj.modifiers.new("Fase", "BEVEL")
        m.width = bevel
        m.segments = segments
        m.limit_method = "ANGLE"
    if subsurf > 0:
        m = obj.modifiers.new("Glaettung", "SUBSURF")
        m.levels = subsurf
        m.render_levels = subsurf
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def box(name, size, loc, mat, bevel=0.015, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat, bevel=bevel, smooth=False)
    if parent:
        set_parent(obj, parent)
    return obj


def plate(name, size, loc, mat, parent=None, taper=1.0, taper_axis="z", subsurf=2, bevel=0.03, rot=(0, 0, 0)):
    """Gerundete Panzerplatte: Box mit Fase + Unterteilung; taper skaliert die obere (+z) bzw. vordere Seite."""
    import bmesh
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if taper != 1.0:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        for v in bm.verts:
            if taper_axis == "z" and v.co.z > 0:
                v.co.x *= taper
                v.co.y *= (1 + (taper - 1) * 0.5)
            elif taper_axis == "-z" and v.co.z < 0:
                v.co.x *= taper
                v.co.y *= (1 + (taper - 1) * 0.5)
        bm.to_mesh(obj.data)
        bm.free()
    finish(obj, mat, bevel=bevel, segments=2, subsurf=subsurf, smooth=True)
    if parent:
        set_parent(obj, parent)
    return obj


def cyl(name, radius, depth, loc, mat, parent=None, rot=(0, 0, 0), verts=24, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    finish(obj, mat, bevel=bevel)
    if parent:
        set_parent(obj, parent)
    return obj


def sphere(name, radius, loc, mat, scale=(1, 1, 1), parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    finish(obj, mat)
    if parent:
        set_parent(obj, parent)
    return obj


def joint(name, loc, parent=None):
    """Leeres Objekt als Gelenk (Drehpunkt) - wird im Spiel animiert."""
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=loc)
    e = bpy.context.active_object
    e.name = name
    if parent:
        set_parent(e, parent)
    return e


def set_parent(child, parent):
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = mw


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_extras=False,
    )
    print("geschrieben:", os.path.relpath(path), os.path.getsize(path), "Bytes")


# --------------------------------------------------------------------------- Spielfigur

def build_hero():
    reset()
    M = mats()
    root = joint("Root", (0, 0, 0))
    pelvis = joint("Pelvis", (0, 0, 0.98), root)

    # Becken, Guertel, Beintaschen
    plate("Becken", (0.34, 0.22, 0.17), (0, 0, 0.98), M["suit"], parent=pelvis, subsurf=1)
    plate("Guertel", (0.38, 0.26, 0.06), (0, 0, 1.045), M["trim"], parent=pelvis, subsurf=1, bevel=0.01)
    box("Guertelschnalle", (0.09, 0.03, 0.07), (0, -0.14, 1.045), M["accent"], bevel=0.008, parent=pelvis)
    for sx in (-1, 1):
        plate(f"Beintasche.{'L' if sx > 0 else 'R'}", (0.16, 0.05, 0.24), (sx * 0.12, -0.12, 0.88), M["armor"], parent=pelvis,
              taper=1.15, taper_axis="-z", rot=(math.radians(10), 0, math.radians(sx * -8)))
        plate(f"Seitentasche.{sx}", (0.05, 0.16, 0.22), (sx * 0.2, 0, 0.9), M["armor"], parent=pelvis, rot=(0, math.radians(sx * 12), 0))

    # Oberkoerper: verjuengter Brustpanzer
    torso = joint("Torso", (0, 0, 1.06), pelvis)
    plate("Bauch", (0.3, 0.21, 0.2), (0, 0, 1.15), M["suit"], parent=torso, subsurf=1)
    for i in range(3):
        plate(f"Bauchplatte.{i}", (0.24 - i * 0.02, 0.04, 0.055), (0, -0.11, 1.1 + i * 0.065), M["armor"], parent=torso, subsurf=1, bevel=0.01)
    plate("Brustpanzer", (0.42, 0.28, 0.32), (0, -0.01, 1.38), M["armor"], parent=torso, taper=1.22)
    plate("Brustplatte", (0.26, 0.04, 0.2), (0, -0.15, 1.4), M["armor"], parent=torso, taper=1.15, subsurf=1)
    box("Brustkante", (0.48, 0.02, 0.025), (0, -0.155, 1.275), M["trim"], bevel=0.006, parent=torso)
    box("Kernlicht", (0.045, 0.012, 0.045), (0, -0.172, 1.42), M["glow"], bevel=0.0, parent=torso)
    plate("Rueckenmodul", (0.34, 0.13, 0.32), (0, 0.18, 1.37), M["armor"], parent=torso, taper=1.1)
    for sx in (-1, 1):
        box(f"Rueckenlicht.{sx}", (0.025, 0.01, 0.22), (sx * 0.1, 0.25, 1.37), M["glow"], bevel=0.0, parent=torso)
    plate("Kragen", (0.34, 0.3, 0.12), (0, 0.02, 1.56), M["armor"], parent=torso, taper=1.15)
    plate("Kragenkante", (0.36, 0.32, 0.025), (0, 0.02, 1.62), M["trim"], parent=torso, subsurf=1, bevel=0.008)

    # Kopf (ohne Helm), Hals
    neck = joint("Neck", (0, 0, 1.6), torso)
    cyl("Hals", 0.058, 0.1, (0, 0, 1.62), M["skin"], parent=neck)
    head = joint("Head", (0, 0, 1.66), neck)
    sphere("Kopf", 0.112, (0, -0.005, 1.755), M["skin"], scale=(0.86, 0.98, 1.12), parent=head)
    sphere("Haar", 0.116, (0, 0.016, 1.79), M["hair"], scale=(0.9, 1.0, 0.86), parent=head)
    plate("Kinn", (0.09, 0.075, 0.06), (0, -0.045, 1.675), M["skin"], parent=head, subsurf=2, bevel=0.02)
    for sx in (-1, 1):
        box(f"Auge.{sx}", (0.022, 0.006, 0.01), (sx * 0.035, -0.1, 1.76), M["hair"], bevel=0.0, parent=head)
        sphere(f"Ohr.{sx}", 0.022, (sx * 0.098, 0.0, 1.75), M["skin"], scale=(0.5, 0.9, 1.2), parent=head)

    # Arme mit geschichteten Schulterpanzern
    for side, sx in (("L", 1), ("R", -1)):
        sh = joint(f"Shoulder.{side}", (sx * 0.27, 0, 1.48), torso)
        sphere(f"Schulter.{side}", 0.15, (sx * 0.3, 0, 1.52), M["armor"], scale=(1.15, 1.1, 0.72), parent=sh)
        sphere(f"Schulter2.{side}", 0.135, (sx * 0.33, 0, 1.46), M["armor"], scale=(1.1, 1.08, 0.6), parent=sh)
        sphere(f"Schulterrand.{side}", 0.152, (sx * 0.31, 0, 1.495), M["trim"], scale=(1.17, 1.12, 0.12), parent=sh)
        cyl(f"Oberarm.{side}", 0.062, 0.28, (sx * 0.31, 0, 1.3), M["suit"], parent=sh)
        plate(f"Oberarmplatte.{side}", (0.11, 0.12, 0.17), (sx * 0.32, 0, 1.3), M["armor"], parent=sh)
        el = joint(f"Elbow.{side}", (sx * 0.31, 0, 1.15), sh)
        sphere(f"Ellbogen.{side}", 0.06, (sx * 0.31, 0.01, 1.15), M["trim"], parent=el)
        plate(f"Unterarm.{side}", (0.105, 0.115, 0.25), (sx * 0.31, -0.005, 1.01), M["armor"], parent=el, taper=1.2)
        box(f"Armlicht.{side}", (0.012, 0.006, 0.13), (sx * 0.31, -0.07, 1.02), M["glow"], bevel=0.0, parent=el)
        plate(f"Hand.{side}", (0.075, 0.1, 0.11), (sx * 0.31, -0.01, 0.84), M["suit"], parent=el, subsurf=2, bevel=0.02)

    # Beine
    for side, sx in (("L", 1), ("R", -1)):
        hip = joint(f"Hip.{side}", (sx * 0.1, 0, 0.94), pelvis)
        cyl(f"Oberschenkel.{side}", 0.082, 0.42, (sx * 0.1, 0, 0.72), M["suit"], parent=hip)
        plate(f"Oberschenkelplatte.{side}", (0.15, 0.15, 0.3), (sx * 0.1, -0.025, 0.74), M["armor"], parent=hip, taper=1.12)
        knee = joint(f"Knee.{side}", (sx * 0.1, 0, 0.5), hip)
        plate(f"Knieschutz.{side}", (0.12, 0.08, 0.13), (sx * 0.1, -0.075, 0.5), M["trim"], parent=knee)
        plate(f"Schienbein.{side}", (0.14, 0.16, 0.36), (sx * 0.1, -0.01, 0.28), M["armor"], parent=knee, taper=1.15)
        box(f"Beinlicht.{side}", (0.012, 0.006, 0.16), (sx * 0.1, -0.095, 0.3), M["glow"], bevel=0.0, parent=knee)
        plate(f"Stiefel.{side}", (0.14, 0.28, 0.12), (sx * 0.1, -0.05, 0.06), M["armor"], parent=knee, subsurf=1)
        box(f"Sohle.{side}", (0.145, 0.29, 0.025), (sx * 0.1, -0.05, 0.012), M["trim"], bevel=0.005, parent=knee)

    export(os.path.join(OUT, "hero.glb"))


# --------------------------------------------------------------------------- Raumschiffe

def build_shuttle():
    reset()
    M = mats()
    root = joint("Shuttle", (0, 0, 0))
    box("Rumpf", (1.4, 4.2, 0.7), (0, 0, 0), M["hull"], bevel=0.12, parent=root)
    box("Cockpit", (0.9, 1.2, 0.45), (0, -1.9, 0.35), M["hull_dark"], bevel=0.15, parent=root)
    box("Cockpitfenster", (0.7, 0.4, 0.12), (0, -2.35, 0.5), M["window"], bevel=0.04, parent=root, rot=(math.radians(-25), 0, 0))
    box("Ruecken", (0.6, 2.4, 0.3), (0, 0.4, 0.45), M["hull_dark"], bevel=0.08, parent=root)
    for sx in (-1, 1):
        box(f"Fluegel.{sx}", (1.6, 1.6, 0.12), (sx * 1.3, 0.6, -0.1), M["hull"], bevel=0.05, parent=root,
            rot=(0, math.radians(sx * -8), 0))
        cyl(f"Gondel.{sx}", 0.3, 1.8, (sx * 1.9, 0.8, -0.1), M["hull_dark"], parent=root, rot=(math.radians(90), 0, 0), bevel=0.04)
        cyl(f"Duese.{sx}", 0.22, 0.12, (sx * 1.9, 1.72, -0.1), M["engine"], parent=root, rot=(math.radians(90), 0, 0))
        box(f"Positionslicht.{sx}", (0.08, 0.08, 0.08), (sx * 2.05, -0.1, -0.1), M["glow"], bevel=0.0, parent=root)
    cyl("Hauptduese", 0.35, 0.12, (0, 2.12, 0), M["engine"], parent=root, rot=(math.radians(90), 0, 0))
    export(os.path.join(OUT, "shuttle.glb"))


def build_cruiser():
    reset()
    M = mats()
    root = joint("Kreuzer", (0, 0, 0))
    box("Kiel", (6, 60, 4), (0, 0, 0), M["hull"], bevel=0.6, parent=root)
    box("Bug", (4, 16, 3), (0, -36, -0.3), M["hull_dark"], bevel=0.8, parent=root)
    box("Ruecken", (4, 40, 3), (0, 4, 3), M["hull_dark"], bevel=0.5, parent=root)
    box("Bruecke", (3, 6, 6), (0, 16, 7), M["hull"], bevel=0.4, parent=root)
    box("Turm", (1.4, 2, 8), (0, 18, 12), M["hull_dark"], bevel=0.2, parent=root)
    for i in range(10):
        y = -24 + i * 5
        for sx in (-1, 1):
            box(f"Fensterreihe.{i}.{sx}", (0.1, 3.2, 0.3), (sx * 3.02, y, 0.6), M["window"], bevel=0.0, parent=root)
    for sx in (-1, 1):
        box(f"Seitenmodul.{sx}", (3, 30, 2.5), (sx * 4.5, 8, -1), M["hull"], bevel=0.4, parent=root)
        box(f"Antenne.{sx}", (0.3, 12, 0.3), (sx * 2, -10, 5), M["hull_dark"], bevel=0.05, parent=root)
    for i, (x, z) in enumerate([(-2, 0), (2, 0), (0, 2.5), (-4.5, -1), (4.5, -1)]):
        cyl(f"Triebwerk.{i}", 1.1, 2.5, (x, 31, z), M["hull_dark"], parent=root, rot=(math.radians(90), 0, 0), bevel=0.1)
        cyl(f"Glut.{i}", 0.85, 0.2, (x, 32.3, z), M["engine"], parent=root, rot=(math.radians(90), 0, 0))
    export(os.path.join(OUT, "cruiser.glb"))


if __name__ == "__main__":
    print("Blender", bpy.app.version_string)
    build_hero()
    build_shuttle()
    build_cruiser()
    sys.exit(0)
