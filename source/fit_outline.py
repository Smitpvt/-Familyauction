"""Fit a clean jersey template outline to each view (robust where white fabric meets light bg)."""
import cv2, numpy as np, json, sys
from scipy.optimize import minimize
from scipy.ndimage import median_filter, gaussian_filter1d

TEAMS = sys.argv[1:] or ['malgund', 'sherle', 'ratnagiri', 'kotwade']
J = '/home/claude/jersey/'

def contour_of(m, smooth=5):
    c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(c, key=cv2.contourArea)[:, 0, :].astype(np.float64)
    if smooth:
        c = np.stack([gaussian_filter1d(c[:, i], smooth, mode='wrap') for i in range(2)], 1)
    return c

def resample(c, n):
    cc = np.vstack([c, c[:1]])
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(cc, axis=0), axis=1))]
    t = np.linspace(0, d[-1], n, endpoint=False)
    return np.stack([np.interp(t, d, cc[:, 0]), np.interp(t, d, cc[:, 1])], 1)

def symmetric_template(mask):
    ys, xs = np.nonzero(mask)
    rows = range(int(np.percentile(ys, 60)), int(np.percentile(ys, 90)))
    ax = np.median([(np.nonzero(mask[y])[0].min() + np.nonzero(mask[y])[0].max()) / 2 for y in rows])
    left = mask.copy(); left[:, np.arange(mask.shape[1]) > ax] = 0
    right = cv2.warpAffine(left, np.float32([[-1, 0, 2 * ax], [0, 1, 0]]), mask.shape[::-1], flags=cv2.INTER_NEAREST)
    return cv2.bitwise_or(left, right)

TPL = {'front': symmetric_template(cv2.imread(J + 'mask_canon.png', 0)),
       'back': symmetric_template(cv2.imread(J + 'mask_back.png', 0))}
TC = {k: resample(contour_of(v), 360) for k, v in TPL.items()}

def normals(c):
    t = np.roll(c, -1, 0) - np.roll(c, 1, 0)
    n = np.stack([t[:, 1], -t[:, 0]], 1); n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
    # outward = away from centroid on average
    if np.mean(np.einsum('ij,ij->i', n, c - c.mean(0))) < 0: n = -n
    return n

def bilinear(img, pts):
    return cv2.remap(img, pts[..., 0].astype(np.float32), pts[..., 1].astype(np.float32),
                     cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

BBOX = {('sherle','front'):(15,12,345,393), ('sherle','back'):(14,11,303,391),
        ('ratnagiri','front'):(14,20,336,390), ('ratnagiri','back'):(12,21,321,390),
        ('kotwade','front'):(14,17,356,415), ('kotwade','back'):(4,16,323,417)}

def fit(img, kind, dark_bg, bbox=None):
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    lab = cv2.cvtColor(cv2.GaussianBlur(img, (0, 0), 1.0), cv2.COLOR_BGR2LAB).astype(np.float32)
    g = np.zeros((h, w), np.float32)
    for c in range(3):
        gx = cv2.Sobel(lab[..., c], cv2.CV_32F, 1, 0, ksize=3); gy = cv2.Sobel(lab[..., c], cv2.CV_32F, 0, 1, ksize=3)
        g += gx * gx + gy * gy
    g = np.sqrt(g)
    # confident fabric for initial bbox
    conf = (hsv[..., 1] > 80) & (hsv[..., 2] > 50)
    conf |= (hsv[..., 2] > 150) & (hsv[..., 1] < 40) if dark_bg else (hsv[..., 2] < 90)
    n, lab_, st, _ = cv2.connectedComponentsWithStats(conf.astype(np.uint8))
    keep = [k for k in range(1, n) if st[k, 4] > 60 and not (st[k, 2] > 0.9 * w and st[k, 3] > 0.9 * h)
            and st[k, 1] > 2 and st[k, 1] + st[k, 3] < h - 2]
    ys, xs = np.nonzero(np.isin(lab_, keep))
    tb = np.array([xs.min(), ys.min(), xs.max(), ys.max()], float)
    if bbox is not None: tb = np.array(bbox, float)
    T = TC[kind]
    sb = np.r_[T.min(0), T.max(0)]
    a0 = (tb[2] - tb[0]) / (sb[2] - sb[0]); b0 = (tb[3] - tb[1]) / (sb[3] - sb[1])
    p0 = np.array([a0, b0, tb[0] - sb[0] * a0, tb[1] - sb[1] * b0])
    edges = (g > np.percentile(g, 88)).astype(np.uint8)
    dt = cv2.distanceTransform(1 - edges, cv2.DIST_L2, 3)
    def apply(p, P=T): return np.stack([P[:, 0] * p[0] + p[2], P[:, 1] * p[1] + p[3]], 1)
    def cost(p):
        q = apply(p); return np.mean(np.minimum(bilinear(dt, q[None])[0], 8.0))
    p = p0
    c = apply(p)
    # snap: nearest strong edge along the normal (small window), smoothed along the outline
    for R in (5, 3, 2):
        nr = normals(c)
        offs = np.arange(-R, R + 0.25, 0.25)
        prof = bilinear(g, (c[:, None, :] + offs[None, :, None] * nr[:, None, :]))
        score = prof - 2.5 * np.abs(offs)[None, :]
        d = offs[np.argmax(score, 1)]
        d[prof.max(1) < 18] = 0
        d = median_filter(d, size=9, mode='wrap')
        d = np.clip(gaussian_filter1d(d, 2.0, mode='wrap'), -R, R)
        c = c + d[:, None] * nr
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.round(c).astype(np.int32)], 255)
    return m, c, tb

if __name__ == '__main__':
    DARK = {'sherle': True}
    for t in TEAMS:
        vis = []
        for v in ('front', 'back'):
            img = cv2.imread(f'{J}teams/{t}/raw_{v}.png')
            m, c, p = fit(img, v, DARK.get(t, False), BBOX.get((t, v)))
            cv2.imwrite(f'{J}teams/{t}/rawmask_{v}.png', m)
            big = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            mm = cv2.resize(m, None, fx=2, fy=2, interpolation=cv2.INTER_NEAREST)
            big[mm == 0] = (big[mm == 0] * 0.35).astype(np.uint8)
            cv2.polylines(big, [np.round(c * 2).astype(np.int32)], True, (0, 255, 0), 1)
            cv2.rectangle(big, (int(p[0]*2), int(p[1]*2)), (int(p[2]*2), int(p[3]*2)), (255, 0, 255), 1)
            vis.append(big)
        hh = max(a.shape[0] for a in vis)
        vis = [cv2.copyMakeBorder(a, 0, hh - a.shape[0], 0, 6, cv2.BORDER_CONSTANT) for a in vis]
        cv2.imwrite(f'{J}teams/{t}/segvis.png', np.hstack(vis))
        print(t, 'ok')
