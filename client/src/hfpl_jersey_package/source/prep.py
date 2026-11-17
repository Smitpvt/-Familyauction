"""Stage 1: silhouettes, front/back registration, texture atlas, name/number removal."""
import cv2, numpy as np, json

src = cv2.imread('src.png')
mf = cv2.imread('mask_front.png', 0)
mb = cv2.imread('mask_back.png', 0)

def fill_holes(m):
    cnts, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(m)
    cv2.drawContours(out, [max(cnts, key=cv2.contourArea)], -1, 255, -1)
    return out

mf, mb = fill_holes(mf), fill_holes(mb)

def axis_of(m, rows=range(420, 660)):
    xs = []
    for y in rows:
        c = np.nonzero(m[y])[0]
        if len(c): xs.append((c.min() + c.max()) / 2)
    return float(np.median(xs))

ax_f, ax_b = axis_of(mf), axis_of(mb)

# ---- canonical silhouette: the clean LEFT half of the front, mirrored ----
H, W = mf.shape
xs = np.arange(W)
left = mf.copy(); left[:, xs > ax_f] = 0
M = np.float32([[-1, 0, 2 * ax_f], [0, 1, 0]])
right = cv2.warpAffine(left, M, (W, H), flags=cv2.INTER_NEAREST)
S = cv2.bitwise_or(left, right)
S = cv2.morphologyEx(S, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
S = fill_holes(S)
cv2.imwrite('mask_canon.png', S)

# ---- register back image to canonical frame (mirror + similarity) ----
# Mirror the back mask about its axis, then fit scale/translation by bbox.
def bbox(m):
    ys, xs_ = np.nonzero(m); return xs_.min(), ys.min(), xs_.max(), ys.max()
cx0, cy0, cx1, cy1 = bbox(S)
bx0, by0, bx1, by1 = bbox(mb)
# Use shoulder-to-hem height for vertical scale (collar heights differ slightly)
sy = (by1 - by0) / (cy1 - cy0)
sx = (bx1 - bx0) / (cx1 - cx0)
# canonical (x,y) -> back image (u,v): mirrored horizontally
def canon_to_back(x, y):
    u = ax_b - (np.asarray(x) - ax_f) * sx
    v = by0 + (np.asarray(y) - cy0) * sy
    return u, v
# IoU check
gy, gx = np.mgrid[0:H, 0:W]
u, v = canon_to_back(gx, gy)
mb_in_canon = cv2.remap(mb, u.astype(np.float32), v.astype(np.float32), cv2.INTER_NEAREST)
iou = (np.logical_and(mb_in_canon > 0, S > 0).sum() / np.logical_or(mb_in_canon > 0, S > 0).sum())

# ---- remove baked name/number from the back ----
back = src.copy()
region = np.zeros((H, W), np.uint8)
cv2.rectangle(region, (955, 180), (1180, 480), 255, -1)
hsv = cv2.cvtColor(back, cv2.COLOR_BGR2HSV)
nonwhite = ((hsv[..., 2] < 185) | (hsv[..., 1] > 70)).astype(np.uint8) * 255
txt = cv2.bitwise_and(nonwhite, region)
# keep only letter components: drop anything touching the box border (stripe graphics)
n, lab, st, _ = cv2.connectedComponentsWithStats(txt)
keep = np.zeros_like(txt)
for k in range(1, n):
    x, y, w, h, a = st[k]
    if a < 30 or x <= 956 or x + w >= 1180 or y + h >= 480: continue
    keep[lab == k] = 255
txt = keep
txt = cv2.dilate(txt, np.ones((7, 7), np.uint8), iterations=2)
cv2.imwrite('text_mask.png', txt)
inp = cv2.inpaint(back, txt, 9, cv2.INPAINT_TELEA)
# restore fabric micro-texture: high-pass detail tiled from a clean white patch
patch = src[500:620, 1010:1130].astype(np.float32)        # clean back fabric below the number
hp = patch - cv2.GaussianBlur(patch, (0, 0), 6)
tile = np.tile(hp, (H // hp.shape[0] + 1, W // hp.shape[1] + 1, 1))[:H, :W]
soft = cv2.GaussianBlur(txt, (0, 0), 3).astype(np.float32)[..., None] / 255
low = cv2.GaussianBlur(inp.astype(np.float32), (0, 0), 4)
filled = np.clip(low + tile, 0, 255)
back = (inp.astype(np.float32) * (1 - soft) + filled * soft).astype(np.uint8)
cv2.imwrite('back_clean_preview.png', back[150:520, 900:1240])

# ---- push-pull fill outside masks so UV edges never sample background ----
def bleed(img, mask, iters=60):
    img = img.astype(np.float32); m = (mask > 0).astype(np.float32)
    known = m.copy(); out = img * known[..., None]
    k = np.ones((5, 5), np.float32)
    for _ in range(iters):
        s = cv2.filter2D(out, -1, k); c = cv2.filter2D(known, -1, k)
        newk = (c > 0) & (known == 0)
        out[newk] = s[newk] / c[newk][..., None]
        known[newk] = 1
    rest = known == 0
    out[rest] = out[known > 0].mean(0)
    return out.astype(np.uint8)

# ---- atlas: 2048x1024, front left, back right ----
pad = 24
fx0, fy0, fx1, fy1 = cx0 - pad, cy0 - pad, cx1 + pad, cy1 + pad
front_crop = bleed(src, cv2.erode(mf, np.ones((3, 3), np.uint8)))[fy0:fy1, fx0:fx1]
ub0, vb0 = canon_to_back(fx1, fy0)   # mirrored: canonical right edge -> back left
ub1, vb1 = canon_to_back(fx0, fy1)
ub0, vb0, ub1, vb1 = int(np.floor(ub0)), int(np.floor(vb0)), int(np.ceil(ub1)), int(np.ceil(vb1))
back_crop = bleed(back, cv2.erode(mb, np.ones((3, 3), np.uint8)))[vb0:vb1, ub0:ub1]
TS = 1024
atlas = np.zeros((TS, 2 * TS, 3), np.uint8)
atlas[:, :TS] = cv2.resize(front_crop, (TS, TS), interpolation=cv2.INTER_LANCZOS4)
atlas[:, TS:] = cv2.resize(back_crop, (TS, TS), interpolation=cv2.INTER_LANCZOS4)
cv2.imwrite('atlas.jpg', atlas, [cv2.IMWRITE_JPEG_QUALITY, 90])

json.dump(dict(ax_f=ax_f, ax_b=ax_b, sx=sx, sy=sy, by0=int(by0), cy0=int(cy0),
               front_box=[int(fx0), int(fy0), int(fx1), int(fy1)],
               back_box=[ub0, vb0, ub1, vb1], iou=float(iou), H=H, W=W),
          open('prep.json', 'w'), indent=1)
print('axis front/back', ax_f, ax_b, 'scale', sx, sy, 'IoU back->canon', round(iou, 3))
