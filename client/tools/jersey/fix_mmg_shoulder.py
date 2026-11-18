"""One-off repair: Malgund Maha Giants, white patch on top of the wearer's right shoulder (back side).

The patch is located from QA renders, not guessed: for each back-right view, white pixels on the
shoulder top that touch the jersey's outer silhouette are mapped through a matching UV-pass render
(R = u, G = v) to atlas texels.  Only whitish texels inside that area are rebuilt, from the
neighbouring shoulder-panel blue, so stripes, logos and every other texel stay byte-for-byte as they
were (apart from JPEG re-encoding of the atlas).

    python tools/jersey/fix_mmg_shoulder.py
"""
import os
import cv2
import numpy as np
import fix_glb as F

HERE = os.path.dirname(os.path.abspath(__file__))
GLB = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'models', 'hfpl_jersey_malgund.glb'))
PREV = os.path.join(HERE, 'previews')
VIEWS = (125, 145)
ROI = (420, 0, 760, 200)          # x0, y0, x1, y1 in the 900x900 QA render


def patch_uvs():
    pts = []
    for a in VIEWS:
        bt = cv2.imread(os.path.join(PREV, f'malgund_beauty{a}.png'))
        uv = cv2.imread(os.path.join(PREV, f'malgund_uv{a}.png'))
        hsv = cv2.cvtColor(bt, cv2.COLOR_BGR2HSV)
        white = ((hsv[..., 2] > 150) & (hsv[..., 1] < 60)).astype(np.uint8)
        bg = (hsv[..., 2] < 30).astype(np.uint8)
        x0, y0, x1, y1 = ROI
        roi = np.zeros_like(white); roi[y0:y1, x0:x1] = 1
        n, lab = cv2.connectedComponents(white * roi)
        near_bg = cv2.dilate(bg, np.ones((5, 5), np.uint8)) > 0
        for i in range(1, n):
            comp = lab == i
            if comp.sum() > 200 and (comp & near_bg).any():        # outer shoulder top, not the back panel
                ys, xs = np.nonzero(comp)
                u = uv[ys, xs, 2] / 255.0                           # BGR image: red = u
                v = uv[ys, xs, 1] / 255.0                           # green = v
                ok = uv[ys, xs, 0] > 200                            # blue channel = 1 on the jersey print
                pts.append(np.stack([u[ok], v[ok]], 1))
    return np.concatenate(pts)


BACKUP = os.path.join(HERE, 'fix_debug', 'hfpl_jersey_malgund.before-shoulder.glb')


def main():
    g, b = F.read_glb(BACKUP if os.path.exists(BACKUP) else GLB)    # always start from the pre-fix model
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
    area = cv2.morphologyEx(area, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))   # UV pass is 8-bit: close the gaps
    area = cv2.dilate(area, np.ones((7, 7), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(area)           # drop stray UV-quantisation specks
    area = np.isin(lab, [i for i in range(1, n) if st[i, 4] > 2000]).astype(np.uint8) * 255
    hsv = cv2.cvtColor(atlas, cv2.COLOR_BGR2HSV)
    whitish = (hsv[..., 1] < 70) & (hsv[..., 2] > 140)
    target = (area > 0) & whitish
    # the shoulder-panel blue around the patch (hue of the raglan blue, well saturated)
    ring = cv2.dilate(area, np.ones((41, 41), np.uint8)) > 0
    blue = ring & (hsv[..., 0] >= 100) & (hsv[..., 0] <= 125) & (hsv[..., 1] > 120) & ~target
    print(f'patch texels: {target.sum()}  blue reference texels: {blue.sum()}  '
          f'median blue (BGR): {np.median(atlas[blue], 0).astype(int).tolist()}')
    filled = F.push_pull(atlas, blue)
    out = atlas.copy()
    out[target] = np.clip(filled[target], 0, 255).astype(np.uint8)
    ok, jpg = cv2.imencode('.jpg', out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    b = F.replace_view(g, b, view_i, jpg.tobytes())
    F.write_glb(GLB, g, b)
    dbg = atlas.copy(); dbg[target] = (0, 0, 255)
    cv2.imwrite(os.path.join(HERE, 'fix_debug', 'mmg_shoulder_patch.jpg'),
                np.vstack([dbg[0:420], out[0:420]]))
    print('wrote', GLB, f'{os.path.getsize(GLB) / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
