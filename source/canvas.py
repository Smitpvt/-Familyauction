import cv2, numpy as np, json, sys
J='/home/claude/jersey/'
TEAMS = sys.argv[1:] or ['malgund','sherle','ratnagiri','kotwade']
W, H = 1536, 1024
TOP, HEIGHT = 35, 693          # jersey top y and collar->hem height in canvas px (matches first build)
AXF, AXB = 458.5, 1062.0
for t in TEAMS:
    src = np.zeros((H, W, 3), np.uint8); mf = np.zeros((H, W), np.uint8); mb = np.zeros((H, W), np.uint8)
    info = {}
    for v, ax, M in (('front', AXF, mf), ('back', AXB, mb)):
        img = cv2.imread(f'{J}teams/{t}/raw_{v}.png'); m = cv2.imread(f'{J}teams/{t}/rawmask_{v}.png', 0)
        ys, xs = np.nonzero(m)
        y0, y1 = ys.min(), ys.max()
        rows = range(int(y0 + 0.6 * (y1 - y0)), int(y0 + 0.9 * (y1 - y0)))
        axr = np.median([(np.nonzero(m[y])[0].min() + np.nonzero(m[y])[0].max()) / 2 for y in rows])
        s = HEIGHT / (y1 - y0)
        A = np.float32([[s, 0, ax - axr * s], [0, s, TOP - y0 * s]])
        warped = cv2.warpAffine(img, A, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REPLICATE)
        wm = cv2.warpAffine(m, A, (W, H), flags=cv2.INTER_LINEAR)
        wm = (wm > 127).astype(np.uint8) * 255
        half = np.zeros((H, W), bool); half[:, :int((AXF + AXB) / 2)] = (v == 'front'); half[:, int((AXF + AXB) / 2):] = (v == 'back')
        src[half] = warped[half]; M[half & (wm > 0)] = 255
        info[v] = dict(scale=float(s), A=A.tolist())
    cv2.imwrite(f'{J}teams/{t}/src.png', src); cv2.imwrite(f'{J}teams/{t}/mask_front.png', mf); cv2.imwrite(f'{J}teams/{t}/mask_back.png', mb)
    json.dump(info, open(f'{J}teams/{t}/canvas.json', 'w'), indent=1)
    print(t, 'scale front %.2f back %.2f' % (info['front']['scale'], info['back']['scale']))
