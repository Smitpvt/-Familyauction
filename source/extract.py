import cv2, numpy as np, json, os, sys
BOX = {  # generous crop boxes (x0,y0,x1,y1) in sheet px for front and back views
 'malgund':  dict(front=(8,30,355,432), back=(345,30,672,432)),
 'sherle':   dict(front=(5,30,358,432), back=(350,30,665,432)),
 'ratnagiri':dict(front=(10,30,355,432), back=(345,30,675,432)),
 'kotwade':  dict(front=(2,30,370,445), back=(355,30,690,445)),
}
def segment(img):
    h, w = img.shape[:2]
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    mask[:4, :] = mask[-4:, :] = cv2.GC_BGD; mask[:, :4] = mask[:, -4:] = cv2.GC_BGD
    cx = w // 2
    cv2.rectangle(mask, (cx - int(w*.17), int(h*.25)), (cx + int(w*.17), int(h*.85)), cv2.GC_FGD, -1)
    bg = np.zeros((1, 65)); fg = np.zeros((1, 65))
    cv2.grabCut(img, mask, None, bg, fg, 10, cv2.GC_INIT_WITH_MASK)
    m = np.where((mask == 1) | (mask == 3), 255, 0).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    n, lab, st, _ = cv2.connectedComponentsWithStats(m)
    k = 1 + np.argmax(st[1:, 4]); m = np.where(lab == k, 255, 0).astype(np.uint8)
    c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    out = np.zeros_like(m); cv2.drawContours(out, [max(c, key=cv2.contourArea)], -1, 255, -1)
    return out
for t, b in BOX.items():
    sheet = cv2.imread(f'teams/{t}.png')
    os.makedirs(f'teams/{t}', exist_ok=True)
    vis = []
    for v in ('front', 'back'):
        x0, y0, x1, y1 = b[v]
        crop = sheet[y0:y1, x0:x1]
        m = segment(crop)
        cv2.imwrite(f'teams/{t}/raw_{v}.png', crop); cv2.imwrite(f'teams/{t}/rawmask_{v}.png', m)
        d = crop.copy(); d[m == 0] = (d[m == 0] * 0.35).astype(np.uint8)
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        cv2.drawContours(d, cs, -1, (0, 200, 0), 1)
        vis.append(cv2.resize(d, None, fx=1.4, fy=1.4))
    hh = max(a.shape[0] for a in vis)
    vis = [cv2.copyMakeBorder(a, 0, hh - a.shape[0], 0, 4, cv2.BORDER_CONSTANT) for a in vis]
    cv2.imwrite(f'teams/{t}/segvis.png', np.hstack(vis))
