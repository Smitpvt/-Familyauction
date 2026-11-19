"""Sharp chest crests and HFPL sleeve patches for the four showcase jerseys.

Diagnosis: in every GLB the crest (~130-190 px) and the HFPL patch (~130x120 px) exist only as pixels
of the 2048x1024 JPEG body texture, so they can never be sharp in close-ups.

Fix (geometry of the jersey untouched):
  * two decal meshes per jersey ("Crest_Decal", "HFPL_Patch_Decal") built from the jersey's OWN
    surface triangles under the crest / patch (lifted 0.6 mm), so they follow the fabric exactly;
  * their UVs map the baked crest / patch footprint in the body texture onto high-resolution
    artwork: the original team logo (src/team_logo/*-Photoroom.png) and the supplied HFPL patch
    artwork (src/team_logo/patch/hfpl-sleeve-patch-source.png);
  * the low-resolution baked copies in the body texture are filled with the surrounding fabric so
    nothing blurry shows around the sharp artwork.

    python tools/jersey/add_crest_patch_decals.py            # all four teams
Originals are read from fix_debug/<team>.before-decals.glb (created on first run), so re-runs are safe.
"""
import json
import os
import shutil
import sys

import cv2
import numpy as np

import fix_glb as F

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
MODELS = os.path.join(ROOT, 'public', 'models')
DEBUG = os.path.join(HERE, 'fix_debug')
LOGO = {'sherle': 'SS', 'ratnagiri': 'RR', 'kotwade': 'KKR', 'malgund': 'MMG'}
PATCH_SRC = os.path.join(ROOT, 'src', 'team_logo', 'patch', 'hfpl-sleeve-patch-source.png')
LIFT = 0.0006
DECAL_MAX = 1024                        # px, long side of a decal texture (~10 px/mm on the jersey)


# ─── artwork ──────────────────────────────────────────────────────────────────
def load_logo(code):
    im = cv2.imread(os.path.join(ROOT, 'src', 'team_logo', f'{code}-Photoroom.png'), cv2.IMREAD_UNCHANGED)
    ys, xs = np.nonzero(im[..., 3] > 10)
    im = im[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    s = min(1.0, DECAL_MAX / max(im.shape[:2]))
    if s < 1:
        im = cv2.resize(im, None, fx=s, fy=s, interpolation=cv2.INTER_AREA)
    return im


def load_patch():
    """rectify the supplied patch artwork: the white rounded rectangle, with its own rounded-corner alpha."""
    src = cv2.imread(PATCH_SRC, cv2.IMREAD_COLOR)
    hsv = cv2.cvtColor(src, cv2.COLOR_BGR2HSV)
    white = ((hsv[..., 2] > 150) & (hsv[..., 1] < 70)).astype(np.uint8) * 255
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
    cnts, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(max(cnts, key=cv2.contourArea))
    mask = np.zeros(src.shape[:2], np.uint8)
    cv2.drawContours(mask, [hull], -1, 255, -1)
    x, y, w, h = cv2.boundingRect(hull)
    rgba = np.dstack([src, mask])[y:y + h, x:x + w]
    # the photo is cropped tight: a thin strip of sleeve fabric shows along the top edge -> trim it
    hsv2 = cv2.cvtColor(rgba[..., :3], cv2.COLOR_BGR2HSV)
    fabric_row = ((hsv2[..., 1] > 45) & (hsv2[..., 0] > 115) & (hsv2[..., 0] < 165)).mean(1) > 0.25
    top = 0
    while top < len(fabric_row) // 6 and fabric_row[top]:
        top += 1
    rgba = rgba[top + 2:]
    # rounded corners like the physical patch (and the baked one)
    h, w = rgba.shape[:2]
    r = int(0.09 * h)
    a = np.zeros((h, w), np.uint8)
    cv2.rectangle(a, (r, 0), (w - 1 - r, h - 1), 255, -1)
    cv2.rectangle(a, (0, r), (w - 1, h - 1 - r), 255, -1)
    for cx, cy in ((r, r), (w - 1 - r, r), (r, h - 1 - r), (w - 1 - r, h - 1 - r)):
        cv2.circle(a, (cx, cy), r, 255, -1, lineType=cv2.LINE_AA)
    rgba[..., 3] = cv2.GaussianBlur(a, (0, 0), 1.0)
    return rgba


def pad(rgba, p=6):
    return cv2.copyMakeBorder(rgba, p, p, p, p, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0)), p


# ─── locate the baked crest / patch in the body texture ──────────────────────
def find_crest(atlas, logo):
    roi_x0, roi_y0 = 520, 190
    roi = atlas[roi_y0:520, roi_x0:840].astype(np.float32)
    best = (-2,)
    for w in range(100, 270, 2):
        h = round(w * logo.shape[0] / logo.shape[1])
        if h >= roi.shape[0] - 2 or w >= roi.shape[1] - 2:
            break
        s = cv2.resize(logo, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32)
        al = s[..., 3:] / 255.0
        comp = s[..., :3] * al + 255 * (1 - al)
        r = cv2.matchTemplate(roi, comp, cv2.TM_CCOEFF_NORMED)
        _, mx, _, loc = cv2.minMaxLoc(r)
        if mx > best[0]:
            best = (mx, w, h, loc)
    mx, w, h, (x, y) = best
    return dict(score=float(mx), x=roi_x0 + x, y=roi_y0 + y, w=w, h=h)


def find_patch(atlas):
    hsv = cv2.cvtColor(atlas, cv2.COLOR_BGR2HSV)
    wm = ((hsv[..., 2] > 185) & (hsv[..., 1] < 60)).astype(np.uint8)
    wm[:, 300:] = 0; wm[:250] = 0; wm[520:] = 0
    wm = cv2.morphologyEx(wm, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(wm)
    cand = [i for i in range(1, n) if 3000 < st[i, 4] < 40000 and st[i, 2] < 250 and st[i, 3] < 220]
    i = max(cand, key=lambda k: st[k, 4])
    cnts, _ = cv2.findContours((lab == i).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    hull = cv2.convexHull(cnts[0])
    return cv2.minAreaRect(hull), hull


def order_box(box):
    s = box.sum(1); d = np.diff(box, axis=1).ravel()
    return box[np.argmin(s)], box[np.argmin(d)], box[np.argmax(d)]          # tl, tr, bl


# ─── decal geometry from the jersey's own triangles ──────────────────────────
def decal_prim(g, b, body, atlas_wh, inside, to_decal_uv):
    W, H = atlas_wh
    P = F.accessor(g, b, body['attributes']['POSITION']).astype(np.float64)
    N = F.accessor(g, b, body['attributes']['NORMAL']).astype(np.float64)
    UV = F.accessor(g, b, body['attributes']['TEXCOORD_0']).astype(np.float64)
    I = F.accessor(g, b, body['indices']).astype(np.int64).reshape(-1, 3)
    px = UV * [W, H]
    keep = inside(px[I].mean(1)) | inside(px[I[:, 0]]) | inside(px[I[:, 1]]) | inside(px[I[:, 2]])
    tri = I[keep]
    used = np.unique(tri)
    remap = -np.ones(len(P), np.int64); remap[used] = np.arange(len(used))
    n = N[used] / np.maximum(np.linalg.norm(N[used], axis=1, keepdims=True), 1e-9)
    pos = P[used] + n * LIFT
    uv = to_decal_uv(px[used])
    return pos.astype(np.float32), n.astype(np.float32), uv.astype(np.float32), remap[tri].astype(np.uint32), int(keep.sum())


# ─── glTF append helpers ──────────────────────────────────────────────────────
def add_view(g, b, data, target=None):
    while len(b) % 4:
        b.append(0)
    bv = {'buffer': 0, 'byteOffset': len(b), 'byteLength': len(data)}
    if target:
        bv['target'] = target
    b += data
    g['bufferViews'].append(bv)
    return len(g['bufferViews']) - 1


def add_acc(g, b, arr, kind, ctype, target, minmax=False):
    v = add_view(g, b, np.ascontiguousarray(arr).tobytes(), target)
    a = {'bufferView': v, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': kind}
    if minmax:
        a['min'] = [float(x) for x in arr.min(0)]; a['max'] = [float(x) for x in arr.max(0)]
    g['accessors'].append(a)
    return len(g['accessors']) - 1


def add_texture(g, b, rgba, name):
    ok, png = cv2.imencode('.png', rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    v = add_view(g, b, png.tobytes())
    g['images'].append({'bufferView': v, 'mimeType': 'image/png', 'name': name})
    g.setdefault('samplers', []).append({'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071})
    g['textures'].append({'source': len(g['images']) - 1, 'sampler': len(g['samplers']) - 1, 'name': name})
    return len(g['textures']) - 1


def add_decal(g, b, parent, name, prim, tex, rough):
    pos, nrm, uv, idx, _ = prim
    g['materials'].append({'name': name + 'Material', 'alphaMode': 'BLEND', 'doubleSided': False,
                           'pbrMetallicRoughness': {'baseColorTexture': {'index': tex}, 'metallicFactor': 0.0,
                                                    'roughnessFactor': rough}})
    attrs = {'POSITION': add_acc(g, b, pos, 'VEC3', 5126, 34962, True),
             'NORMAL': add_acc(g, b, nrm, 'VEC3', 5126, 34962),
             'TEXCOORD_0': add_acc(g, b, uv, 'VEC2', 5126, 34962)}
    ia = add_acc(g, b, idx.reshape(-1), 'SCALAR', 5125, 34963)
    g['meshes'].append({'name': name, 'primitives': [{'attributes': attrs, 'indices': ia,
                                                      'material': len(g['materials']) - 1, 'mode': 4}]})
    g['nodes'].append({'name': name, 'mesh': len(g['meshes']) - 1})
    g['nodes'][parent].setdefault('children', []).append(len(g['nodes']) - 1)


# ─── per team ─────────────────────────────────────────────────────────────────
def process(team, patch_rgba):
    out = os.path.join(MODELS, f'hfpl_jersey_{team}.glb')
    orig = os.path.join(DEBUG, f'hfpl_jersey_{team}.before-decals.glb')
    if not os.path.exists(orig):
        shutil.copyfile(out, orig)
    g, b = F.read_glb(orig)
    mi = next(i for i, m in enumerate(g['materials']) if m.get('name') == 'JerseyPrint')
    body_mesh = next(k for k, m in enumerate(g['meshes']) if m['primitives'][0].get('material') == mi)
    body = g['meshes'][body_mesh]['primitives'][0]
    body_node = next(k for k, n in enumerate(g['nodes']) if n.get('mesh') == body_mesh)
    parent = next(k for k, n in enumerate(g['nodes']) if body_node in n.get('children', []))
    img_i = g['textures'][g['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
    view_i = g['images'][img_i]['bufferView']
    bv = g['bufferViews'][view_i]
    atlas = cv2.imdecode(np.frombuffer(bytes(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]), np.uint8), 1)
    H, W = atlas.shape[:2]

    # crest: original logo placed exactly on the baked crest footprint
    logo = load_logo(LOGO[team])
    c = find_crest(atlas, logo)
    lp, p = pad(logo)
    cx0, cy0, cw, ch = c['x'], c['y'], c['w'], c['h']
    inside_c = lambda q: (q[:, 0] > cx0 - 0.06 * cw) & (q[:, 0] < cx0 + 1.06 * cw) & (q[:, 1] > cy0 - 0.06 * ch) & (q[:, 1] < cy0 + 1.06 * ch)
    to_c = lambda q: np.stack([(p + (q[:, 0] - cx0) / cw * logo.shape[1]) / lp.shape[1],
                               (p + (q[:, 1] - cy0) / ch * logo.shape[0]) / lp.shape[0]], 1)
    crest_prim = decal_prim(g, b, body, (W, H), inside_c, to_c)

    # patch: supplied HFPL patch artwork on the baked patch footprint (rotated rectangle)
    rect, hull = find_patch(atlas)
    box = cv2.boxPoints(rect)
    tl, tr, bl = order_box(box)
    pp, pq = pad(patch_rgba)
    ph, pw = patch_rgba.shape[:2]
    A = cv2.getAffineTransform(np.float32([tl, tr, bl]),
                               np.float32([[pq / pp.shape[1], pq / pp.shape[0]],
                                           [(pq + pw) / pp.shape[1], pq / pp.shape[0]],
                                           [pq / pp.shape[1], (pq + ph) / pp.shape[0]]]))
    (rx, ry), (rw, rh), _ = rect
    rr = 0.6 * max(rw, rh) + 6
    inside_p = lambda q: (np.abs(q[:, 0] - rx) < rr) & (np.abs(q[:, 1] - ry) < rr)
    to_p = lambda q: (np.c_[q, np.ones(len(q))] @ A.T)
    patch_prim = decal_prim(g, b, body, (W, H), inside_p, to_p)

    # fill the low-resolution baked copies with the surrounding fabric
    hsv = cv2.cvtColor(atlas, cv2.COLOR_BGR2HSV)
    crest_px = ((hsv[..., 1] > 60) | (hsv[..., 2] < 150)).astype(np.uint8)
    # every baked crest fragment near the logo (the baked crest can be wider than the original logo),
    # but not the sweep stripes, which run in from the zone edges
    zx0, zx1 = int(cx0 - 0.3 * cw), int(cx0 + 1.3 * cw)
    zy0, zy1 = int(cy0 - 0.12 * ch), int(cy0 + 1.12 * ch)
    zone = np.zeros((H, W), np.uint8)
    cv2.rectangle(zone, (zx0, zy0), (zx1, zy1), 1, -1)
    n, lab, st, _ = cv2.connectedComponentsWithStats(crest_px * zone)
    keep = [i for i in range(1, n) if st[i, 0] > zx0 + 1 and st[i, 0] + st[i, 2] < zx1 - 1
            and st[i, 1] > zy0 + 1 and st[i, 1] + st[i, 3] < zy1 - 1]
    crest_mask = np.isin(lab, keep).astype(np.uint8)
    crest_mask = cv2.dilate(crest_mask, np.ones((11, 11), np.uint8)) * zone
    patch_mask = np.zeros((H, W), np.uint8)
    cv2.drawContours(patch_mask, [hull], -1, 1, -1)
    patch_mask = cv2.dilate(patch_mask, np.ones((9, 9), np.uint8))
    cleaned = cv2.inpaint(atlas, (patch_mask * 255).astype(np.uint8), 9, cv2.INPAINT_TELEA)   # solid sleeve colour
    # the front panel is symmetric white fabric: take the mirror image of the wearer's right chest
    Pp = F.accessor(g, b, body['attributes']['POSITION']).astype(np.float64)
    Nv = F.accessor(g, b, body['attributes']['NORMAL']).astype(np.float64)
    UVv = F.accessor(g, b, body['attributes']['TEXCOORD_0']).astype(np.float64) * [W, H]
    centre = (np.abs(Pp[:, 0]) < 0.01) & (Nv[:, 2] > 0.6) & (UVv[:, 0] < W / 2)   # front centre line in 3D
    axis = float(np.median(UVv[centre, 0]))
    mirror = cleaned[:, ::-1]                                   # column x  <-  column (W-1-x)
    shift = int(round(2 * axis - (W - 1)))                      # so that column x maps to 2*axis - x
    mirror = np.roll(mirror, shift, axis=1)
    soft = cv2.GaussianBlur(crest_mask.astype(np.float32), (0, 0), 3)[..., None]
    cleaned = np.clip(cleaned * (1 - soft) + mirror * soft, 0, 255).astype(np.uint8)
    ok, jpg = cv2.imencode('.jpg', cleaned, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b = F.replace_view(g, b, view_i, jpg.tobytes())

    t_crest = add_texture(g, b, lp, f'{LOGO[team]}_crest_original')
    t_patch = add_texture(g, b, pp, 'HFPL_sleeve_patch_original')
    add_decal(g, b, parent, 'Crest_Decal', crest_prim, t_crest, 0.6)
    add_decal(g, b, parent, 'HFPL_Patch_Decal', patch_prim, t_patch, 0.5)
    F.write_glb(out, g, b)

    dbg = atlas.copy()
    cv2.rectangle(dbg, (cx0, cy0), (cx0 + cw, cy0 + ch), (0, 255, 0), 2)
    cv2.drawContours(dbg, [np.int32(box)], -1, (0, 0, 255), 2)
    cv2.imwrite(os.path.join(DEBUG, f'{team}_decals.jpg'), np.vstack([dbg[150:560, :1024], cleaned[150:560, :1024]]))
    info = dict(mirror_axis=round(float(axis), 1), crest=dict(match=round(c['score'], 3), atlas_px=[cx0, cy0, cw, ch], tris=crest_prim[4], tex=list(lp.shape[:2])),
                patch=dict(atlas_rect=[round(rx), round(ry), round(rw), round(rh), round(rect[2], 1)], tris=patch_prim[4], tex=list(pp.shape[:2])),
                size_mb=round(os.path.getsize(out) / 1e6, 2))
    print(team, json.dumps(info))


if __name__ == '__main__':
    os.makedirs(DEBUG, exist_ok=True)
    patch = load_patch()
    cv2.imwrite(os.path.join(DEBUG, 'hfpl_patch_rectified.png'), patch)
    for t in sys.argv[1:] or list(LOGO):
        process(t, patch)
