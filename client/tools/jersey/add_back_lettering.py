"""Print "HFPL" above "27" on the back of all four showcase jerseys.

The existing PlayerName / PlayerNumber carrier meshes are hidden by the apps (and off-centre), so the
lettering is added as two new decal meshes, "Back_Name_HFPL" and "Back_Number_27", built from the
jersey's OWN back triangles (lifted 0.8 mm) so the print follows the real fabric shape.  UVs are a
planar projection onto the back (as seen from behind: left = +X), so letters keep true proportions.
Textures are high-resolution transparent PNGs (name 2048 px, number 1536 px wide): heavy slab
lettering with a team-colour outline.  Nothing else in the GLB changes.

    python tools/jersey/add_back_lettering.py            # all four teams
Originals are read from fix_debug/<team>.before-lettering.glb (created on first run).
"""
import json
import os
import shutil
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

import fix_glb as F
from add_crest_patch_decals import add_acc, add_decal, add_texture, pad

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models'))
DEBUG = os.path.join(HERE, 'fix_debug')
FONT = 'C:/Windows/Fonts/ROCKEB.TTF'              # Rockwell Extra Bold: heavy slab sports lettering
NAME, NUMBER = 'HFPL', '27'
NAME_W, NAME_H = 0.27, 0.072                       # metres on the jersey
NUM_W, NUM_H = 0.25, 0.19
LIFT = 0.0008
# lettering colours taken from each kit (fill, outline)
COLORS = {
    'sherle':    ('#141414', '#f06a12'),
    'ratnagiri': ('#1b1f4e', '#ea2f86'),
    'kotwade':   ('#3a1670', '#e9ac1f'),
    'malgund':   ('#14286e', '#f47a1f'),
}


def render_text(text, box_w, box_h, px_w, fill, outline, tracking):
    """heavy lettering with outline, fitted (not stretched) into a box of the given aspect."""
    px_h = int(round(px_w * box_h / box_w))
    big = 600
    font = ImageFont.truetype(FONT, big)
    stroke = int(big * 0.075)
    # lay out glyph by glyph so letter-spacing can be set
    widths = [font.getbbox(c, stroke_width=stroke)[2] - font.getbbox(c, stroke_width=stroke)[0] for c in text]
    total = sum(widths) + int(tracking * big) * (len(text) - 1)
    canvas = Image.new('RGBA', (total + 4 * stroke, int(big * 1.6)), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    x = 2 * stroke
    for c, w in zip(text, widths):
        l = font.getbbox(c, stroke_width=stroke)[0]
        d.text((x - l, int(big * 0.2)), c, font=font, fill=fill, stroke_width=stroke, stroke_fill=outline)
        x += w + int(tracking * big)
    ink = canvas.getbbox()
    canvas = canvas.crop(ink)
    # fit inside the target box keeping the glyph proportions, centred
    s = min(px_w / canvas.width, px_h / canvas.height)
    fitted = canvas.resize((max(1, int(canvas.width * s)), max(1, int(canvas.height * s))), Image.LANCZOS)
    out = Image.new('RGBA', (px_w, px_h), (0, 0, 0, 0))
    out.paste(fitted, ((px_w - fitted.width) // 2, (px_h - fitted.height) // 2), fitted)
    rgba = cv2.cvtColor(np.array(out), cv2.COLOR_RGBA2BGRA)
    return rgba


def back_decal(P, N, I, cx, cy, w, h, tex_shape, p):
    """jersey triangles under the box on the back, with planar UVs (left = +X as seen from behind)."""
    c = P[I].mean(1)
    n = N[I].mean(1)
    keep = (n[:, 2] < -0.2) & (np.abs(c[:, 0] - cx) < w / 2 + 0.01) & (np.abs(c[:, 1] - cy) < h / 2 + 0.01)
    tri = I[keep]
    used = np.unique(tri)
    remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
    nn = N[used] / np.maximum(np.linalg.norm(N[used], axis=1, keepdims=True), 1e-9)
    pos = P[used] + nn * LIFT
    th, tw = tex_shape
    s = (cx + w / 2 - P[used, 0]) / w                      # 0 at the viewer's left (+X) when seen from behind
    t = (cy + h / 2 - P[used, 1]) / h                      # 0 at the top
    uv = np.stack([(p + s * (tw - 2 * p)) / tw, (p + t * (th - 2 * p)) / th], 1)
    return pos.astype(np.float32), nn.astype(np.float32), uv.astype(np.float32), remap[tri].astype(np.uint32), int(keep.sum())


def process(team):
    out = os.path.join(MODELS, f'hfpl_jersey_{team}.glb')
    orig = os.path.join(DEBUG, f'hfpl_jersey_{team}.before-lettering.glb')
    if not os.path.exists(orig):
        shutil.copyfile(out, orig)
    g, b = F.read_glb(orig)
    mi = next(i for i, m in enumerate(g['materials']) if m.get('name') == 'JerseyPrint')
    body_mesh = next(k for k, m in enumerate(g['meshes']) if m['primitives'][0].get('material') == mi)
    body = g['meshes'][body_mesh]['primitives'][0]
    body_node = next(k for k, n in enumerate(g['nodes']) if n.get('mesh') == body_mesh)
    parent = next(k for k, n in enumerate(g['nodes']) if body_node in n.get('children', []))
    P = F.accessor(g, b, body['attributes']['POSITION']).astype(np.float64)
    N = F.accessor(g, b, body['attributes']['NORMAL']).astype(np.float64)
    I = F.accessor(g, b, body['indices']).astype(np.int64).reshape(-1, 3)

    # vertical lines from the kit's own name/number carriers; horizontally centred on the spine
    def centre_y(name):
        m = next(m for m in g['meshes'] if m['name'] == name)
        q = F.accessor(g, b, m['primitives'][0]['attributes']['POSITION']).astype(np.float64)
        return float((q[:, 1].min() + q[:, 1].max()) / 2)
    name_y, num_y = centre_y('PlayerName'), centre_y('PlayerNumber')
    num_y = min(num_y, name_y - NAME_H / 2 - NUM_H / 2 - 0.018)          # keep a clean gap under the name

    fill, outline = COLORS[team]
    name_tex, p = pad(render_text(NAME, NAME_W, NAME_H, 2048, fill, outline, 0.06), 8)
    num_tex, p2 = pad(render_text(NUMBER, NUM_W, NUM_H, 1536, fill, outline, 0.02), 8)
    name_prim = back_decal(P, N, I, 0.0, name_y, NAME_W, NAME_H, name_tex.shape[:2], p)
    num_prim = back_decal(P, N, I, 0.0, num_y, NUM_W, NUM_H, num_tex.shape[:2], p2)

    t_name = add_texture(g, b, name_tex, 'Back_Name_HFPL')
    t_num = add_texture(g, b, num_tex, 'Back_Number_27')
    add_decal(g, b, parent, 'Back_Name_HFPL', name_prim, t_name, 0.55)
    add_decal(g, b, parent, 'Back_Number_27', num_prim, t_num, 0.55)
    F.write_glb(out, g, b)
    cv2.imwrite(os.path.join(DEBUG, f'{team}_back_lettering.png'),
                np.vstack([cv2.resize(name_tex, (1024, int(1024 * name_tex.shape[0] / name_tex.shape[1]))),
                           cv2.resize(num_tex, (1024, int(1024 * num_tex.shape[0] / num_tex.shape[1])))]))
    print(team, json.dumps(dict(name_y=round(name_y, 3), number_y=round(num_y, 3), name_tris=name_prim[4],
                                number_tris=num_prim[4], size_mb=round(os.path.getsize(out) / 1e6, 2))))


if __name__ == '__main__':
    os.makedirs(DEBUG, exist_ok=True)
    for t in sys.argv[1:] or list(COLORS):
        process(t)
