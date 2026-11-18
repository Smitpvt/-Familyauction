"""Malgund Maha Giants: white patches on top of the shoulders beside the collar.

    python fix_mmg_front_shoulders.py          # front-side collar views
    python fix_mmg_front_shoulders.py back     # back-side collar views (collar band excluded)

Same method as fix_mmg_shoulder.py: white regions touching the jersey outline in high-angle collar
renders are mapped through matching UV-pass renders to atlas texels; only whitish texels there are
rebuilt from the neighbouring raglan blue.  Edits the current public GLB.
"""
import os
import cv2
import numpy as np
import fix_glb as F

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'hfpl_jersey_malgund.glb'))
PREV = os.path.join(HERE, 'previews')
import sys
BACK = len(sys.argv) > 1 and sys.argv[1] == 'back'
VIEWS = ('155', '180', '205') if BACK else ('m25', '0', '25')
ROI_Y = 260                        # only the shoulder/collar band of the 900x900 QA render
COLLAR_X = (320, 600) if BACK else None   # back views: keep the collar's own white tipping stripe


def patch_uvs():
    pts = []
    for a in VIEWS:
        bt = cv2.imread(os.path.join(PREV, f'malgund_bt{a}.png'))
        uv = cv2.imread(os.path.join(PREV, f'malgund_uvt{a}.png'))
        hsv = cv2.cvtColor(bt, cv2.COLOR_BGR2HSV)
        white = ((hsv[..., 2] > 150) & (hsv[..., 1] < 60)).astype(np.uint8)
        bg = (hsv[..., 2] < 30).astype(np.uint8)
        roi = np.zeros_like(white); roi[:ROI_Y] = 1
        if COLLAR_X:
            roi[:, COLLAR_X[0]:COLLAR_X[1]] = 0
        n, lab = cv2.connectedComponents(white * roi)
        near_bg = cv2.dilate(bg, np.ones((5, 5), np.uint8)) > 0
        for i in range(1, n):
            comp = lab == i
            if comp.sum() > (60 if BACK else 150) and (comp & near_bg).any():
                ys, xs = np.nonzero(comp)
                ok = uv[ys, xs, 0] > 200                       # jersey print only (uv pass blue = 1)
                pts.append(np.stack([uv[ys, xs, 2][ok] / 255.0, uv[ys, xs, 1][ok] / 255.0], 1))
    return np.concatenate(pts)


def main():
    g, b = F.read_glb(GLB)
    mi = next(i for i, m in enumerate(g['materials']) if m.get('name') == 'JerseyPrint')
    img_i = g['textures'][g['materials'][mi]['pbrMetallicRoughness']['baseColorTexture']['index']]['source']
    view_i = g['images'][img_i]['bufferView']
    bv = g['bufferViews'][view_i]
    raw = bytes(b[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
    atlas = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    H, W = atlas.shape[:2]

    uv = patch_uvs()
    area = np.zeros((H, W), np.uint8)
    px = np.clip((uv * [W, H]).astype(int), 0, [W - 1, H - 1])
    area[px[:, 1], px[:, 0]] = 255
    area = cv2.morphologyEx(area, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
    area = cv2.dilate(area, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(area)
    area = np.isin(lab, [i for i in range(1, n) if st[i, 4] > (600 if BACK else 1500)]).astype(np.uint8) * 255
    hsv = cv2.cvtColor(atlas, cv2.COLOR_BGR2HSV)
    target = (area > 0) & (hsv[..., 1] < 70) & (hsv[..., 2] > 140)
    ring = cv2.dilate(area, np.ones((41, 41), np.uint8)) > 0
    blue = ring & (hsv[..., 0] >= 100) & (hsv[..., 0] <= 125) & (hsv[..., 1] > 120) & ~target
    print(f'shoulder-top texels recoloured: {target.sum()}  blue source texels: {blue.sum()}')
    filled = F.push_pull(atlas, blue)
    out = atlas.copy()
    out[target] = np.clip(filled[target], 0, 255).astype(np.uint8)
    ok, jpg = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b = F.replace_view(g, b, view_i, jpg.tobytes())
    F.write_glb(GLB, g, b)
    dbg = atlas.copy(); dbg[target] = (0, 0, 255)
    cv2.imwrite(os.path.join(HERE, 'fix_debug', 'mmg_back_shoulders.jpg' if BACK else 'mmg_front_shoulders.jpg'), np.vstack([dbg[0:500], out[0:500]]))
    print('wrote', GLB)


if __name__ == '__main__':
    main()
