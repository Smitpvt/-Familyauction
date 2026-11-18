"""Malgund Maha Giants: remove pale/white bleed on the outer-top edges of both sleeves.

In the reference kit the sleeves are solid royal blue apart from the cuff stripes and the HFPL
badge.  On the model, the sleeve faces that wrap over the top/outer edge sample the pale band just
outside the photographed garment, so they render as white patches.

Only texels that are (a) on sleeve faces, (b) whitish, (c) within 40 texels of the garment edge,
(d) above the cuff band and (e) outside the HFPL badge are rebuilt from the surrounding sleeve blue.
Run after fix_mmg_shoulder.py (it edits the current public GLB).
"""
import os
import cv2
import numpy as np
import fix_glb as F

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'hfpl_jersey_malgund.glb'))
CUFF_V = 0.43                       # atlas rows below this fraction are the cuff bands (kept as-is)
BADGE = (40, 320, 210, 480)         # x0, y0, x1, y1 of the HFPL badge in the front half of the atlas


def main():
    g, b = F.read_glb(GLB)
    mi = next(i for i, m in enumerate(g['materials']) if m.get('name') == 'JerseyPrint')
    img_i = g['textures'][g['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
    view_i = g['images'][img_i]['bufferView']
    bv = g['bufferViews'][view_i]
    raw = bytes(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
    atlas = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    H, W = atlas.shape[:2]

    p = next(p for m in g['meshes'] for p in m['primitives'] if p.get('material') == mi)
    P = F.accessor(g, b, p['attributes']['POSITION']).astype(float)
    UV = F.accessor(g, b, p['attributes']['TEXCOORD_0']).astype(float)
    I = F.accessor(g, b, p['indices']).astype(int).reshape(-1, 3)
    c = P[I].mean(1)
    sleeve = np.zeros((H, W), np.uint8)
    cover = np.zeros((H, W), np.uint8)
    for t in range(len(I)):
        poly = np.round(UV[I[t]] * [W, H] * 4).astype(np.int32)
        cv2.fillPoly(cover, [poly], 255, shift=2)
        if abs(c[t, 0]) > 0.185 and c[t, 1] > -0.05:          # faces outside the torso = sleeves
            cv2.fillPoly(sleeve, [poly], 255, shift=2)

    hsv = cv2.cvtColor(atlas, cv2.COLOR_BGR2HSV)
    whitish = (hsv[..., 1] < 70) & (hsv[..., 2] > 150)
    dist = cv2.distanceTransform((cover > 0).astype(np.uint8), cv2.DIST_L2, 5)
    target = (sleeve > 0) & whitish & (dist < 40)
    target[int(CUFF_V * H):] = False
    x0, y0, x1, y1 = BADGE
    target[y0:y1, x0:x1] = False
    target = cv2.morphologyEx(target.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)) > 0

    blue = (sleeve > 0) & (hsv[..., 0] >= 100) & (hsv[..., 0] <= 125) & (hsv[..., 1] > 120) & ~target
    print(f'sleeve edge texels recoloured: {target.sum()}  blue source texels: {blue.sum()}  '
          f'median sleeve blue (BGR): {np.median(atlas[blue], 0).astype(int).tolist()}')
    filled = F.push_pull(atlas, blue)
    out = atlas.copy()
    out[target] = np.clip(filled[target], 0, 255).astype(np.uint8)
    ok, jpg = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b = F.replace_view(g, b, view_i, jpg.tobytes())
    F.write_glb(GLB, g, b)
    dbg = atlas.copy(); dbg[target] = (0, 0, 255)
    cv2.imwrite(os.path.join(HERE, 'fix_debug', 'mmg_sleeve_patch.jpg'), np.vstack([dbg, out]))
    print('wrote', GLB)


if __name__ == '__main__':
    main()
