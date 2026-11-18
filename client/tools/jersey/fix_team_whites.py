"""Remove white bleed patches from a team jersey's shoulders and sleeves (generic version of the
Malgund fixes).

    python fix_team_whites.py ratnagiri            # preview selections only (fix_debug/<team>_whites_sel.jpg)
    python fix_team_whites.py ratnagiri --apply    # write the GLB

Two sources of texels are rebuilt from the team's sleeve/raglan colour:
  1. sleeve-edge bleed: whitish texels on sleeve faces within 40 texels of the garment edge, above
     the cuff band and outside the HFPL badge;
  2. shoulder patches seen in QA renders: white regions touching the jersey outline in the shoulder
     band of back-3/4 and high-angle collar renders, mapped through matching UV-pass renders
     (collar band excluded in the back collar views so the collar's own stripes stay).
Requires the QA renders <team>_b*.png / <team>_uv*.png made with render_previews.mjs.
"""
import os
import sys
import cv2
import numpy as np
import fix_glb as F

HERE = os.path.dirname(os.path.abspath(__file__))
PREV = os.path.join(HERE, 'previews')
CFG = {
    # sleeve colour (OpenCV hue range, min saturation, value range) and HFPL badge box in the atlas
    'ratnagiri': dict(hue=(105, 135), sat=60, val=(20, 160), badge=(20, 300, 240, 500)),
    'malgund':   dict(hue=(100, 125), sat=120, val=(40, 255), badge=(40, 320, 210, 480)),
    'kotwade':   dict(hue=(125, 160), sat=80, val=(30, 220), badge=(20, 300, 240, 500)),
}
# (view label, screen ROI rows, excluded screen columns)
VIEWS = [('c125', 200, None), ('c145', 200, None), ('c215', 200, None), ('c235', 200, None),
         ('tm25', 260, None), ('t0', 260, None), ('t25', 260, None),
         ('t155', 260, (320, 600)), ('t180', 260, (320, 600)), ('t205', 260, (320, 600))]


def render_uvs(team):
    pts, sels = [], []
    for v, roi_y, excl in VIEWS:
        bt = cv2.imread(os.path.join(PREV, f'{team}_b{v}.png'))
        uv = cv2.imread(os.path.join(PREV, f'{team}_uv{v}.png'))
        if bt is None or uv is None:
            continue
        hsv = cv2.cvtColor(bt, cv2.COLOR_BGR2HSV)
        white = ((hsv[..., 2] > 150) & (hsv[..., 1] < 60)).astype(np.uint8)
        bg = (hsv[..., 2] < 30).astype(np.uint8)
        roi = np.zeros_like(white); roi[:roi_y] = 1
        if excl:
            roi[:, excl[0]:excl[1]] = 0
        n, lab = cv2.connectedComponents(white * roi)
        near_bg = cv2.dilate(bg, np.ones((5, 5), np.uint8)) > 0
        sel = np.zeros(white.shape, bool)
        for i in range(1, n):
            comp = lab == i
            if comp.sum() > 60 and (comp & near_bg).any():
                sel |= comp
        ys, xs = np.nonzero(sel)
        ok = uv[ys, xs, 0] > 200
        pts.append(np.stack([uv[ys, xs, 2][ok] / 255.0, uv[ys, xs, 1][ok] / 255.0], 1))
        ov = bt.copy(); ov[sel] = (0, 0, 255)
        sels.append(cv2.resize(ov[:450], (300, 150)))
    return (np.concatenate(pts) if pts else np.zeros((0, 2))), sels


def main():
    team = sys.argv[1]
    apply = '--apply' in sys.argv
    cfg = CFG[team]
    glb = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', f'hfpl_jersey_{team}.glb'))
    g, b = F.read_glb(glb)
    mi = next(i for i, m in enumerate(g['materials']) if m.get('name') == 'JerseyPrint')
    img_i = g['textures'][g['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
    view_i = g['images'][img_i]['bufferView']
    bv = g['bufferViews'][view_i]
    atlas = cv2.imdecode(np.frombuffer(bytes(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]), np.uint8), 1)
    H, W = atlas.shape[:2]
    hsv = cv2.cvtColor(atlas, cv2.COLOR_BGR2HSV)
    whitish = (hsv[..., 1] < 70) & (hsv[..., 2] > 140)

    # 1. sleeve-edge bleed
    p = next(p for m in g['meshes'] for p in m['primitives'] if p.get('material') == mi)
    P = F.accessor(g, b, p['attributes']['POSITION']).astype(float)
    UV = F.accessor(g, b, p['attributes']['TEXCOORD_0']).astype(float)
    I = F.accessor(g, b, p['indices']).astype(int).reshape(-1, 3)
    c = P[I].mean(1)
    sleeve = np.zeros((H, W), np.uint8); cover = np.zeros((H, W), np.uint8)
    for t in range(len(I)):
        poly = np.round(UV[I[t]] * [W, H] * 4).astype(np.int32)
        cv2.fillPoly(cover, [poly], 255, shift=2)
        if abs(c[t, 0]) > 0.185 and c[t, 1] > -0.05:
            cv2.fillPoly(sleeve, [poly], 255, shift=2)
    dist = cv2.distanceTransform((cover > 0).astype(np.uint8), cv2.DIST_L2, 5)
    t1 = (sleeve > 0) & whitish & (dist < 40)
    t1[int(0.43 * H):] = False
    x0, y0, x1, y1 = cfg['badge']
    t1[y0:y1, x0:x1] = False

    # 2. shoulder patches located in renders
    uv, sels = render_uvs(team)
    area = np.zeros((H, W), np.uint8)
    px = np.clip((uv * [W, H]).astype(int), 0, [W - 1, H - 1])
    area[px[:, 1], px[:, 0]] = 255
    area = cv2.morphologyEx(area, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    area = cv2.dilate(area, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(area)
    area = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 600])
    area[y0:y1, x0:x1] = False
    t2 = area & whitish
    if team != 'malgund':
        # this kit's white body panels and white raglan stripes reach the collar, so render hits there
        # are real artwork: only the sleeve-edge pass is used
        t2[:] = False

    target = cv2.morphologyEx((t1 | t2).astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0
    lo, hi = cfg['hue']; vlo, vhi = cfg['val']
    src = (cover > 0) & (hsv[..., 0] >= lo) & (hsv[..., 0] <= hi) & (hsv[..., 1] > cfg['sat']) & \
          (hsv[..., 2] >= vlo) & (hsv[..., 2] <= vhi) & ~target
    src &= cv2.dilate(target.astype(np.uint8), np.ones((61, 61), np.uint8)) > 0
    print(f'{team}: texels to recolour {target.sum()} (sleeve edges {t1.sum()}, shoulders {t2.sum()}); '
          f'colour source texels {src.sum()}, median BGR {np.median(atlas[src], 0).astype(int).tolist()}')
    dbg = atlas.copy(); dbg[target] = (0, 255, 0)
    os.makedirs(os.path.join(HERE, 'fix_debug'), exist_ok=True)
    cv2.imwrite(os.path.join(HERE, 'fix_debug', f'{team}_whites_sel.jpg'),
                np.vstack([cv2.resize(dbg, (1200, 600))] + ([] if not sels else [np.vstack([np.hstack(sels[i:i + 4] + [np.zeros_like(sels[0])] * (4 - len(sels[i:i + 4]))) for i in range(0, len(sels), 4)])])))
    if not apply:
        return
    filled = F.push_pull(atlas, src)
    out = atlas.copy()
    out[target] = np.clip(filled[target], 0, 255).astype(np.uint8)
    ok, jpg = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b = F.replace_view(g, b, view_i, jpg.tobytes())
    F.write_glb(glb, g, b)
    cv2.imwrite(os.path.join(HERE, 'fix_debug', f'{team}_whites_after.jpg'), cv2.resize(out, (1200, 600)))
    print('wrote', glb)


if __name__ == '__main__':
    main()
