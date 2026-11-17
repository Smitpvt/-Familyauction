"""Stage 2: build the 3D jersey mesh from the silhouette and export a GLB (no Blender).

Geometry: front + back panels triangulated over the jersey silhouette, inflated by a
distance-field profile (round torso, tubular sleeves, tapered shoulders), stitched at the
side/shoulder/underarm seams. Hem, cuffs and neck are real openings. An inner shell offset
by the fabric thickness plus rim strips give the cloth actual thickness.
Player name / number are separate conforming meshes with their own textures.
"""
import cv2, numpy as np, json, io, struct, triangle
from scipy.interpolate import RBFInterpolator
from scipy.spatial import cKDTree
from PIL import Image, ImageDraw, ImageFont
import pygltflib as G

P = json.load(open('prep.json'))
S = cv2.imread('mask_canon.png', 0)
# round off the sharp collar-corner points at the top of the silhouette
_top = cv2.morphologyEx(S, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
S = S.copy(); S[:95] = _top[:95]
MB = cv2.imread('mask_back.png', 0)
AX = P['ax_f']
H, W = S.shape
SPACING = 6.0

def mirror(p): return (2 * AX - p[0], p[1])

# ---------------- contours ----------------
def contour_of(m):
    c, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(c, key=cv2.contourArea)[:, 0, :].astype(np.float64)
    # circular smoothing
    k = 9; g = np.exp(-np.linspace(-2, 2, 2 * k + 1) ** 2); g /= g.sum()
    pad = np.concatenate([c[-k:], c, c[:k]])
    c = np.stack([np.convolve(pad[:, i], g, 'valid') for i in range(2)], 1)
    return c

def resample(c, spacing):
    cc = np.vstack([c, c[:1]])
    d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(cc, axis=0), axis=1))]
    n = int(d[-1] / spacing)
    t = np.linspace(0, d[-1], n, endpoint=False)
    return np.stack([np.interp(t, d, cc[:, 0]), np.interp(t, d, cc[:, 1])], 1)

C = resample(contour_of(S), SPACING)
N = len(C)
# make contour orientation counter-clockwise in image coords (y down)
area = 0.5 * np.sum(C[:, 0] * np.roll(C[:, 1], -1) - np.roll(C[:, 0], -1) * C[:, 1])
if area < 0: C = C[::-1].copy()
tree = cKDTree(C)
def near(p): return int(tree.query(p)[1])

# landmarks (canonical / front-image pixels), right side mirrored
L_CUFF_TOP, L_CUFF_BOT = (108, 345), (232, 398)
L_HEM, L_TIP = (240, 698), (350, 72)
lm = dict(lct=near(L_CUFF_TOP), lcb=near(L_CUFF_BOT), rct=near(mirror(L_CUFF_TOP)),
          rcb=near(mirror(L_CUFF_BOT)), lh=near(L_HEM), rh=near(mirror(L_HEM)),
          lt=near(L_TIP), rt=near(mirror(L_TIP)))

def arc(i, j, must):
    """indices from i to j (inclusive) along the direction that passes through `must`."""
    fwd = [(i + s) % N for s in range((j - i) % N + 1)]
    if must in fwd: return fwd
    return [(i - s) % N for s in range((i - j) % N + 1)]

neck = arc(lm['lt'], lm['rt'], int(np.argmin(C[:, 1])))
hem = arc(lm['lh'], lm['rh'], int(np.argmax(C[:, 1])))
lcuff = arc(lm['lct'], lm['lcb'], int(np.argmin(C[:, 0])))
rcuff = arc(lm['rct'], lm['rcb'], int(np.argmax(C[:, 0])))
open_back = {'neck': neck, 'hem': hem, 'lcuff': lcuff, 'rcuff': rcuff}
interior_open = set()
for e in open_back.values(): interior_open.update(e[1:-1])
seam = np.array([i not in interior_open for i in range(N)])   # z == 0 here

# ---------------- front neckline (opening through to the inside) ----------------
NECK_PATH = [C[lm['lt']], (366, 65), (383, 62), (392, 90), (400, 115), (410, 130), (425, 141), (432, 155),
             (440, 182), (447, 212), (449, 226), (458, 205), (468, 172), (485, 150),
             (505, 135), (518, 118), (528, 92), (534, 62), (551, 65), C[lm['rt']]]
np_ = np.array(NECK_PATH, float)
d = np.r_[0, np.cumsum(np.linalg.norm(np.diff(np_, axis=0), axis=1))]
t = np.linspace(0, d[-1], int(d[-1] / SPACING) + 1)
neckline = np.stack([np.interp(t, d, np_[:, 0]), np.interp(t, d, np_[:, 1])], 1)[1:-1]

# Front outline: contour without the neck arc's interior, plus the neckline path.
# The neck arc runs lt -> rt; the remaining contour runs rt -> lt.
rest = arc(lm['rt'], lm['lt'], [i for i in range(N) if i not in neck][0])
front_pts = np.vstack([C[rest], neckline])          # rt ... lt, then neckline lt->rt
front_cidx = rest + [-1] * len(neckline)            # contour index or -1 for neckline pts
front_open = {
    'neck': [len(rest) - 1] + list(range(len(rest), len(front_pts))) + [0],
    'hem': [rest.index(i) for i in hem], 'lcuff': [rest.index(i) for i in lcuff],
    'rcuff': [rest.index(i) for i in rcuff]}
back_open = {k: list(v) for k, v in open_back.items()}

# ---------------- distance field with openings extended outward ----------------
E = S.copy()
def extend(idx, direction, length=160):
    p = C[idx]
    q = p + np.asarray(direction, float) * length
    poly = np.vstack([p, q[::-1]]).astype(np.int32)
    cv2.fillPoly(E, [poly], 255)
    cv2.polylines(E, [p.astype(np.int32)], False, 255, 3)
def outward(idx):
    p = C[idx]; ch = p[-1] - p[0]; nrm = np.array([ch[1], -ch[0]]); nrm /= np.linalg.norm(nrm)
    mid = p.mean(0)
    if np.dot(nrm, mid - np.array([AX, 380])) < 0: nrm = -nrm
    return nrm
extend(hem, (0, 1)); extend(neck, (0, -1)); extend(lcuff, outward(lcuff)); extend(rcuff, outward(rcuff))
DIST = cv2.distanceTransform(E, cv2.DIST_L2, 5)
cv2.imwrite('dist_vis.png', (DIST / DIST.max() * 255).astype(np.uint8))

cy0, cy1 = P['cy0'], int(np.max(C[:, 1]))
SCALE = 0.74 / (cy1 - cy0)           # metres per pixel  (collar top -> hem = 74 cm)
YC = (cy0 + cy1) / 2

def sample(img, pts):
    return cv2.remap(img, pts[:, 0].astype(np.float32).reshape(-1, 1),
                     pts[:, 1].astype(np.float32).reshape(-1, 1), cv2.INTER_LINEAR)[:, 0]

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)

def depth(pts):
    Dm = np.maximum(sample(DIST, pts) - 1.0, 0) * SCALE
    yn = (pts[:, 1] - cy0) / (cy1 - cy0)
    taper = 0.55 + 0.45 * smoothstep(0.06, 0.36, yn)          # thinner shoulders/neck
    belly = 1.0 - 0.06 * smoothstep(0.55, 0.95, yn)            # slight waist drop
    return 0.30 * np.sqrt(Dm) * taper * belly

def to3d(pts, z):
    return np.stack([(pts[:, 0] - AX) * SCALE, (YC - pts[:, 1]) * SCALE, z], 1)

# ---------------- triangulate panels ----------------
def tri(pts):
    n = len(pts)
    segs = np.stack([np.arange(n), (np.arange(n) + 1) % n], 1)
    r = triangle.triangulate({'vertices': pts, 'segments': segs}, 'pq28a55Y')
    assert np.allclose(r['vertices'][:n], pts)
    return r['vertices'], r['triangles']

fv, ft = tri(front_pts)
bv, bt = tri(C)
nf_b, nb_b = len(front_pts), len(C)

zf = depth(fv)
zb = -0.9 * depth(bv)
# seams: exact zero so front and back meet
for k, ci in enumerate(front_cidx):
    if ci >= 0 and seam[ci]: zf[k] = 0.0
zb[:nb_b][seam] = 0.0
Vf, Vb = to3d(fv, zf), to3d(bv, zb)

# ---------------- UVs ----------------
fx0, fy0, fx1, fy1 = P['front_box']
uvf = np.stack([(fv[:, 0] - fx0) / (fx1 - fx0) * 0.5, (fv[:, 1] - fy0) / (fy1 - fy0)], 1)

# back mapping: similarity, then refined by a smooth thin-plate warp fitted on contours
def sim(p):
    return np.stack([P['ax_b'] - (p[:, 0] - AX) * P['sx'], P['by0'] + (p[:, 1] - cy0) * P['sy']], 1)
Bc = resample(contour_of(MB), 3.0)
btree = cKDTree(Bc)
src_pts = C.copy(); tgt = sim(src_pts)
warp = None
for it in range(4):
    cur = sim(src_pts) if warp is None else warp(src_pts)
    tgt = Bc[btree.query(cur)[1]]
    # interior anchors keep the centre stable
    anc = np.array([[AX + dx, y] for dx in (-120, 0, 120) for y in (200, 350, 500, 620)], float)
    warp = RBFInterpolator(np.vstack([src_pts, anc]),
                           np.vstack([tgt, sim(anc) if it == 0 else warp(anc)]),
                           kernel='thin_plate_spline', smoothing=40.0)
res = np.linalg.norm(warp(src_pts) - Bc[btree.query(warp(src_pts))[1]], axis=1)
print('back warp contour residual px: mean %.2f max %.2f' % (res.mean(), res.max()))
inv_warp = RBFInterpolator(warp(np.vstack([src_pts, anc])), np.vstack([src_pts, anc]),
                           kernel='thin_plate_spline', smoothing=40.0)
ub0, vb0, ub1, vb1 = P['back_box']
bq = warp(bv)
uvb = np.stack([0.5 + (bq[:, 0] - ub0) / (ub1 - ub0) * 0.5, (bq[:, 1] - vb0) / (vb1 - vb0)], 1)

# ---------------- assemble outer surface ----------------
V = np.vstack([Vf, Vb]); UV = np.vstack([uvf, uvb])
F_front = ft.copy(); F_back = bt + len(Vf)

def face_normals(V, F):
    return np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
# orient: front faces +z, back faces -z
if face_normals(V, F_front)[:, 2].sum() < 0: F_front = F_front[:, ::-1]
if face_normals(V, F_back)[:, 2].sum() > 0: F_back = F_back[:, ::-1]
F_out = np.vstack([F_front, F_back])

def vertex_normals(V, F, weld=True):
    fn = face_normals(V, F)
    vn = np.zeros_like(V)
    for k in range(3): np.add.at(vn, F[:, k], fn)
    if weld:  # share normals across UV seams (same position)
        key = np.round(V * 1e5).astype(np.int64)
        _, inv = np.unique(key, axis=0, return_inverse=True)
        acc = np.zeros((inv.max() + 1, 3)); np.add.at(acc, inv.ravel(), vn); vn = acc[inv.ravel()]
    return vn / np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12)

N_out = vertex_normals(V, F_out)

# ---------------- thickness: inner shell + rims ----------------
THICK = 0.004
V_in = V - N_out * THICK
F_in = F_out[:, ::-1]
N_in = -N_out

rimV, rimUV, rimF = [], [], []
def add_rim(edge_idx):
    base = len(rimV)
    for i in edge_idx:
        rimV.append(V[i]); rimUV.append(UV[i])
        rimV.append(V_in[i]); rimUV.append(UV[i])
    for k in range(len(edge_idx) - 1):
        a, b = base + 2 * k, base + 2 * (k + 1)
        rimF.append([a, b, a + 1]); rimF.append([b, b + 1, a + 1])
for e in front_open.values(): add_rim(e)
for e in back_open.values(): add_rim([i + len(Vf) for i in e])
rimV, rimUV, rimF = np.array(rimV), np.array(rimUV), np.array(rimF)
# orient rim faces outward (away from the inner shell side): test against the outer edge normal
fn = face_normals(rimV, rimF)
outdir = rimV[rimF[:, 0]] - rimV[rimF[:, 0] + (rimF[:, 0] % 2 == 0)]  # outer - inner (approx)
centroid = V.mean(0)
mid = rimV[rimF].mean(1)
flip = np.einsum('ij,ij->i', fn, mid - centroid) < 0
rimF[flip] = rimF[flip][:, ::-1]
rimN = vertex_normals(rimV, rimF, weld=False)

# Body print primitive = outer + rims ; inner primitive separate (dark fabric)
bodyV = np.vstack([V, rimV]); bodyUV = np.vstack([UV, rimUV]); bodyN = np.vstack([N_out, rimN])
bodyF = np.vstack([F_out, rimF + len(V)])

# ---------------- player name / number decals ----------------
tm = cv2.imread('text_mask.png', 0)
rows = np.nonzero(tm.sum(1))[0]
gap = np.argmax(np.diff(rows)); name_y = (rows[0], rows[gap]); num_y = (rows[gap + 1], rows[-1])
NAME_BOX = (925, name_y[0] - 6, 1199, name_y[1] + 2)     # back-image px, widened for long names
NUM_BOX = (940, num_y[0] - 2, 1184, num_y[1] + 4)
print('name box', NAME_BOX, 'number box', NUM_BOX)

DECAL_OFF = 0.0035
def decal(box, nx=28, ny=14):
    x0, y0, x1, y1 = box
    gx, gy = np.meshgrid(np.linspace(x0, x1, nx), np.linspace(y0, y1, ny))
    bpts = np.stack([gx.ravel(), gy.ravel()], 1)
    cpts = inv_warp(bpts)                                  # back image -> canonical
    z = -0.9 * depth(cpts) - DECAL_OFF
    Vd = to3d(cpts, z)
    uv = np.stack([(gx.ravel() - x0) / (x1 - x0), (gy.ravel() - y0) / (y1 - y0)], 1)
    F = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i; F += [[a, a + nx, a + 1], [a + 1, a + nx, a + nx + 1]]
    F = np.array(F)
    if face_normals(Vd, F)[:, 2].sum() > 0: F = F[:, ::-1]
    return Vd, uv, F, vertex_normals(Vd, F, weld=False)

FONT = 'fonts/Graduate-Regular.ttf'
def text_texture(text, w, h, path):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    size = h
    while True:
        f = ImageFont.truetype(FONT, size); stroke = max(4, size // 14)
        bb = d.textbbox((0, 0), text, font=f, stroke_width=stroke)
        if bb[2] - bb[0] <= w * 0.96 and bb[3] - bb[1] <= h * 0.94: break
        size -= 4
    x = (w - (bb[2] - bb[0])) / 2 - bb[0]; y = (h - (bb[3] - bb[1])) / 2 - bb[1]
    d.text((x, y), text, font=f, fill=(17, 17, 17, 255), stroke_width=stroke, stroke_fill=(255, 98, 20, 255))
    img.save(path, optimize=True)
    return open(path, 'rb').read()

def tex_size(box, base):
    a = (box[2] - box[0]) / (box[3] - box[1]); return base, int(round(base / a / 8) * 8)
nw, nh = tex_size(NAME_BOX, 1024); mw, mh = tex_size(NUM_BOX, 768)
name_png = text_texture('SHRI', nw, nh, 'tex_name.png')
num_png = text_texture('21', mw, mh, 'tex_number.png')
dn, dm = decal(NAME_BOX), decal(NUM_BOX, 24, 22)

# ---------------- GLB writer ----------------
gl = G.GLTF2(asset=G.Asset(generator='HFPL jersey builder (python, trimesh-free)', version='2.0'))
blob = bytearray()
def add_view(data, target=None):
    global blob
    while len(blob) % 4: blob += b'\0'
    off = len(blob); blob += data
    gl.bufferViews.append(G.BufferView(buffer=0, byteOffset=off, byteLength=len(data), target=target))
    return len(gl.bufferViews) - 1
def add_acc(arr, kind, comp, target, minmax=False):
    v = add_view(arr.tobytes(), target)
    acc = G.Accessor(bufferView=v, componentType=comp, count=len(arr), type=kind)
    if minmax: acc.min = arr.min(0).tolist(); acc.max = arr.max(0).tolist()
    gl.accessors.append(acc); return len(gl.accessors) - 1
def prim(Vx, Nx, UVx, Fx, mat):
    Vx = Vx.astype(np.float32); Nx = Nx.astype(np.float32)
    idx = Fx.astype(np.uint16 if len(Vx) < 65535 else np.uint32).ravel()
    a = {'POSITION': add_acc(Vx, 'VEC3', G.FLOAT, G.ARRAY_BUFFER, True),
         'NORMAL': add_acc(Nx, 'VEC3', G.FLOAT, G.ARRAY_BUFFER)}
    if UVx is not None: a['TEXCOORD_0'] = add_acc(UVx.astype(np.float32), 'VEC2', G.FLOAT, G.ARRAY_BUFFER)
    i = add_acc(idx, 'SCALAR', G.UNSIGNED_SHORT if idx.dtype == np.uint16 else G.UNSIGNED_INT, G.ELEMENT_ARRAY_BUFFER)
    return G.Primitive(attributes=G.Attributes(**a), indices=i, material=mat)
def add_image(data, mime, name):
    gl.images.append(G.Image(bufferView=add_view(data), mimeType=mime, name=name))
    gl.textures.append(G.Texture(source=len(gl.images) - 1, sampler=0))
    return len(gl.textures) - 1

gl.samplers.append(G.Sampler(magFilter=G.LINEAR, minFilter=G.LINEAR_MIPMAP_LINEAR, wrapS=G.CLAMP_TO_EDGE, wrapT=G.CLAMP_TO_EDGE))
t_print = add_image(open('atlas.jpg', 'rb').read(), 'image/jpeg', 'JerseyPrint')
t_name = add_image(name_png, 'image/png', 'PlayerNameTexture')
t_num = add_image(num_png, 'image/png', 'PlayerNumberTexture')

def mat(name, tex=None, color=(1, 1, 1, 1), blend=False, rough=0.78):
    pbr = G.PbrMetallicRoughness(baseColorFactor=list(color), metallicFactor=0.0, roughnessFactor=rough)
    if tex is not None: pbr.baseColorTexture = G.TextureInfo(index=tex)
    gl.materials.append(G.Material(name=name, pbrMetallicRoughness=pbr,
                                   alphaMode='BLEND' if blend else 'OPAQUE', doubleSided=False))
    return len(gl.materials) - 1
m_print = mat('JerseyPrint', t_print)
m_inner = mat('JerseyInner', None, (0.06, 0.06, 0.065, 1), rough=0.9)
m_name = mat('PlayerNameMaterial', t_name, blend=True, rough=0.6)
m_num = mat('PlayerNumberMaterial', t_num, blend=True, rough=0.6)

gl.meshes.append(G.Mesh(name='JerseyBody', primitives=[
    prim(bodyV, bodyN, bodyUV, bodyF, m_print), prim(V_in, N_in, None, F_in, m_inner)]))
gl.meshes.append(G.Mesh(name='PlayerName', primitives=[prim(dn[0], dn[3], dn[1], dn[2], m_name)]))
gl.meshes.append(G.Mesh(name='PlayerNumber', primitives=[prim(dm[0], dm[3], dm[1], dm[2], m_num)]))
gl.nodes += [G.Node(name='JerseyBody', mesh=0), G.Node(name='PlayerName', mesh=1),
             G.Node(name='PlayerNumber', mesh=2),
             G.Node(name='HFPL_Jersey', children=[0, 1, 2],
                    extras={'playerName': 'SHRI', 'playerNumber': '21',
                            'note': 'Swap PlayerNameMaterial / PlayerNumberMaterial maps at runtime'})]
gl.scenes.append(G.Scene(name='Scene', nodes=[3])); gl.scene = 0
while len(blob) % 4: blob += b'\0'
gl.buffers.append(G.Buffer(byteLength=len(blob)))
gl.set_binary_blob(bytes(blob))
gl.save_binary('hfpl_jersey.glb')

tris = len(bodyF) + len(F_in) + len(dn[2]) + len(dm[2])
print('verts', len(bodyV) + len(V_in) + len(dn[0]) + len(dm[0]), 'tris', tris)
print('bbox m', V.min(0).round(3), V.max(0).round(3))
