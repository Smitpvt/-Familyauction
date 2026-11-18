"""Repair the HFPL showcase jersey GLBs in place (originals stay untouched in D:/Family/models).

Root cause of the white patches: the side band of each jersey mesh maps (UV) onto the outermost
pixels of the reference-photo silhouette, where the garment edge is anti-aliased into the light
sheet background.  Those few halo pixels get stretched across the whole side panel.

Fix: rasterise the mesh's own UV coverage to get the garment area in the atlas, pull it in by a
few texels, and rebuild everything outside from the garment's interior colours (push-pull
diffusion).  Artwork inside the garment is unchanged.

    python tools/jersey/fix_glb.py            # all four teams
"""
import json
import os
import struct
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'models'))        # originals
OUT_DIR = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models'))
TEAMS = ['ratnagiri', 'malgund', 'kotwade', 'sherle']
ERODE_PX = 7
CTYPE = {5126: np.float32, 5125: np.uint32, 5123: np.uint16, 5121: np.uint8}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


def read_glb(path):
    data = open(path, 'rb').read()
    jlen = struct.unpack_from('<I', data, 12)[0]
    g = json.loads(data[20:20 + jlen])
    blen = struct.unpack_from('<I', data, 20 + jlen)[0]
    return g, bytearray(data[28 + jlen:28 + jlen + blen])


def write_glb(path, g, binc):
    while len(binc) % 4:
        binc.append(0)
    g['buffers'][0]['byteLength'] = len(binc)
    js = json.dumps(g, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, 28 + len(js) + len(binc)))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binc), 0x004E4942)); f.write(binc)


def accessor(g, b, i):
    a = g['accessors'][i]
    bv = g['bufferViews'][a['bufferView']]
    dt = np.dtype(CTYPE[a['componentType']]); n = NCOMP[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', dt.itemsize * n)
    arr = np.frombuffer(bytes(b), dt, a['count'] * (stride // dt.itemsize), off).reshape(a['count'], -1)[:, :n]
    return arr if n > 1 else arr[:, 0]


def replace_view(g, b, view_idx, data):
    """swap a bufferView's bytes, shifting every later view."""
    bv = g['bufferViews'][view_idx]
    start, old = bv.get('byteOffset', 0), bv['byteLength']
    pad = (-len(data)) % 4
    data = bytes(data) + b'\0' * pad
    oldpad = (-old) % 4
    b[start:start + old + oldpad] = data
    delta = len(data) - (old + oldpad)
    bv['byteLength'] = len(data) - pad
    for other in g['bufferViews']:
        if other is not bv and other.get('byteOffset', 0) > start:
            other['byteOffset'] += delta
    return b


def push_pull(img, valid):
    img = img.astype(np.float32)
    pyr, c, w = [], img * valid[..., None], valid.astype(np.float32)
    while True:
        pyr.append((c, w))
        if min(c.shape[:2]) < 4:
            break
        c = cv2.resize(c, (c.shape[1] // 2, c.shape[0] // 2), interpolation=cv2.INTER_AREA)
        w = cv2.resize(w, (w.shape[1] // 2, w.shape[0] // 2), interpolation=cv2.INTER_AREA)
    fill = None
    for c, w in reversed(pyr):
        avg = c / np.maximum(w, 1e-6)[..., None]
        if fill is None:
            fill = avg
        else:
            up = cv2.resize(fill, (c.shape[1], c.shape[0]), interpolation=cv2.INTER_LINEAR)
            a = np.clip(w * 4, 0, 1)[..., None]
            fill = avg * a + up * (1 - a)
    out = img.copy()
    out[~valid] = fill[~valid]
    return out


def fix_team(team):
    g, b = read_glb(os.path.join(SRC_DIR, f'hfpl_jersey_{team}.glb'))
    mi = next(i for i, m in enumerate(g['materials']) if m.get('name') == 'JerseyPrint')
    tex = g['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']
    img_i = g['textures'][tex]['source']
    view_i = g['images'][img_i]['bufferView']
    bv = g['bufferViews'][view_i]
    raw = bytes(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
    atlas = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    H, W = atlas.shape[:2]

    # garment area in the atlas = UV coverage of every textured primitive
    cover = np.zeros((H, W), np.uint8)
    for mesh in g['meshes']:
        for p in mesh['primitives']:
            if p.get('material') != mi or 'TEXCOORD_0' not in p['attributes']:
                continue
            uv = accessor(g, b, p['attributes']['TEXCOORD_0']).astype(np.float64)
            idx = accessor(g, b, p['indices']).astype(np.int64).reshape(-1, 3)
            px = np.round(uv * [W, H] * 4).astype(np.int32)            # 2 bits sub-pixel precision
            cv2.fillPoly(cover, list(px[idx]), 255, lineType=cv2.LINE_8, shift=2)
    cover = cv2.morphologyEx(cover, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    interior = cv2.erode(cover, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * ERODE_PX + 1, 2 * ERODE_PX + 1))) > 0
    fixed = np.clip(push_pull(atlas, interior), 0, 255).astype(np.uint8)
    ok, jpg = cv2.imencode('.jpg', fixed, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b = replace_view(g, b, view_i, jpg.tobytes())
    # the name/number carrier textures ship with sample lettering baked in: make them fully transparent
    # (same size, so the runtime canvas keeps its resolution); the captain name is drawn at runtime
    for im in g['images']:
        if im.get('name') in ('PlayerNameTexture', 'PlayerNumberTexture'):
            v = g['bufferViews'][im['bufferView']]
            old = cv2.imdecode(np.frombuffer(bytes(b[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]), np.uint8), cv2.IMREAD_UNCHANGED)
            blank = np.zeros((old.shape[0], old.shape[1], 4), np.uint8)
            b = replace_view(g, b, im['bufferView'], cv2.imencode('.png', blank)[1].tobytes())
    os.makedirs(OUT_DIR, exist_ok=True)
    out = os.path.join(OUT_DIR, f'hfpl_jersey_{team}.glb')
    write_glb(out, g, b)
    changed = (np.abs(fixed.astype(int) - atlas.astype(int)).sum(2) > 30)
    print(f'{team}: atlas {W}x{H}, garment {cover.mean() / 2.55:.1f}% of atlas, '
          f'{changed[cover > 0].mean() * 100:.2f}% of garment texels rebuilt at the edge, '
          f'{os.path.getsize(out) / 1e6:.2f} MB')
    return fixed, cover


if __name__ == '__main__':
    dbg = os.path.join(HERE, 'fix_debug')
    os.makedirs(dbg, exist_ok=True)
    for t in sys.argv[1:] or TEAMS:
        fixed, cover = fix_team(t)
        cv2.imwrite(os.path.join(dbg, f'{t}_atlas_fixed.jpg'), fixed)
