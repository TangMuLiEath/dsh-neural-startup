# 用法: python tools/trace.py <角色图.png>
import sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
import cv2, numpy as np, json, sys
im = cv2.imread(sys.argv[1])
H,W = im.shape[:2]
g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
gb = cv2.bilateralFilter(g, 9, 40, 9)
e = cv2.Canny(gb, 80, 200, L2gradient=True)
# finer detail in face/eyes
ef = cv2.Canny(cv2.bilateralFilter(g,5,30,5), 40, 110, L2gradient=True)
mask=np.zeros_like(e)
cv2.ellipse(mask,(562,302),(72,40),0,0,360,255,-1)
cv2.ellipse(mask,(775,302),(72,40),0,0,360,255,-1)
cv2.ellipse(mask,(660,420),(60,16),0,0,360,255,-1)
e = np.maximum(e, ef & mask)
# thin: canny already thin; ensure 8-connected skeleton-ish
E = (e>0)
nb = [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]
ys,xs = np.nonzero(E)
pix = set(zip(ys.tolist(),xs.tolist()))
def neigh(p):
    y,x=p
    return [(y+dy,x+dx) for dy,dx in nb if (y+dy,x+dx) in pix]
deg = {p:len(neigh(p)) for p in pix}
visited=set()
chains=[]
def walk(start):
    ch=[start]; visited.add(start); cur=start
    while True:
        nx=[q for q in neigh(cur) if q not in visited]
        if not nx: break
        # prefer 4-neighbours then continuing direction
        if len(ch)>1:
            dy=cur[0]-ch[-2][0]; dx=cur[1]-ch[-2][1]
            nx.sort(key=lambda q: -((q[0]-cur[0])*dy+(q[1]-cur[1])*dx))
        q=nx[0]; visited.add(q); ch.append(q); cur=q
    return ch
for p in sorted(pix, key=lambda p: deg[p]):
    if p in visited: continue
    if deg[p]<=1 or True:
        c=walk(p)
        chains.append(c)
# merge: try to extend short pieces? skip. filter
out=[]
for c in chains:
    if len(c)<10: continue
    a=np.array([[x,y] for y,x in c],dtype=np.float32).reshape(-1,1,2)
    s=cv2.approxPolyDP(a,0.9,False).reshape(-1,2)
    if len(s)<2: continue
    L=float(np.sum(np.linalg.norm(np.diff(a.reshape(-1,2),axis=0),axis=1)))
    out.append((s,L))
print('chains',len(chains),'kept',len(out),'pts',sum(len(s) for s,_ in out))
# color sampling: mean darkness along stroke, hue
hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
res=[]
for s,L in out:
    m=s.mean(axis=0)
    v = float(np.mean([g[int(min(H-1,y)),int(min(W-1,x))] for x,y in s]))
    res.append(dict(p=s.astype(int).tolist(),L=L,v=v))
json.dump(dict(W=W,H=H,strokes=res),open(HERE/'strokes.json','w'))
# render check
canvas=np.full((H,W,3),10,np.uint8)
for r in res:
    pts=np.array(r['p'],np.int32).reshape(-1,1,2)
    cv2.polylines(canvas,[pts],False,(255,230,120),1,cv2.LINE_AA)
cv2.imwrite(str(HERE/'trace_check.png'),canvas)
