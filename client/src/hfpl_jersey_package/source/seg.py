import cv2, numpy as np
im=cv2.imread('src.png')
H,W=im.shape[:2]
SEEDS={'front':[(365,60),(520,70),(180,230),(720,230),(150,345),(735,345),(300,700),(560,700)],'back':[]}
def seg(x0,x1,name):
    sub=im[0:740,x0:x1].copy()
    mask=np.full(sub.shape[:2],cv2.GC_BGD,np.uint8)
    # rough probable fg rect
    cv2.rectangle(mask,(15,25),(sub.shape[1]-15,730),cv2.GC_PR_BGD,-1)
    cx=sub.shape[1]//2
    cv2.rectangle(mask,(cx-110,150),(cx+110,640),cv2.GC_FGD,-1)
    for (px,py) in SEEDS[name]:
        cv2.rectangle(mask,(px-x0-6,py-6),(px-x0+6,py+6),cv2.GC_FGD,-1)   # torso surely fg
    bg=np.zeros((1,65)); fg=np.zeros((1,65))
    cv2.grabCut(sub,mask,None,bg,fg,8,cv2.GC_INIT_WITH_MASK)
    m=np.where((mask==1)|(mask==3),255,0).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_OPEN,np.ones((5,5),np.uint8))
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((9,9),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(m)
    k=1+np.argmax(st[1:,4]); m=np.where(lab==k,255,0).astype(np.uint8)
    full=np.zeros((H,W),np.uint8); full[0:740,x0:x1]=m
    cv2.imwrite(f'mask_{name}.png',full)
    vis=im.copy(); vis[full==0]=(vis[full==0]*0.25).astype(np.uint8)
    cnts,_=cv2.findContours(full,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    cv2.drawContours(vis,cnts,-1,(0,255,0),2)
    cv2.imwrite(f'segvis_{name}.png',vis[0:760,x0:x1])
seg(0,790,'front'); seg(745,1536,'back')
