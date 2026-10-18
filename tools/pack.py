# 用法: python tools/pack.py <角色图.png>
import sys, pathlib
HERE = pathlib.Path(__file__).resolve().parent
import json, cv2, numpy as np
d=json.load(open(HERE/'strokes.json'))
S=[]
for r in d['strokes']:
    p=r['p']; flat=[]
    px,py=0,0
    for i,(x,y) in enumerate(p):
        flat += [x-px, y-py] if i else [x,y]
        px,py=x,y
    t=int(max(0,min(9,r['v']/256*10)))
    S.append([t]+flat)
im=cv2.imread(sys.argv[1])
g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(float)
g=cv2.GaussianBlur(g,(0,0),3)
hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
sat=cv2.GaussianBlur(hsv[:,:,1].astype(float),(0,0),3)
step=9
D=[]
rng=np.random.default_rng(3)
for y in range(0,d['H'],step):
    for x in range(0,d['W'],step):
        jx=int(x+rng.integers(0,step)); jy=int(y+rng.integers(0,step))
        if jx>=d['W'] or jy>=d['H']: continue
        dark=(255-g[jy,jx])/255
        val=dark*1.3+sat[jy,jx]/255*0.6-0.35
        if val>0.12 and rng.random()<min(1,val*1.6):
            D.append([jx,jy,int(min(3,max(1,val*4)))])
print(len(S),len(D))
flatD=[]
for x,y,l in D: flatD+= [x,y,l]
out=dict(W=d['W'],H=d['H'],S=S,D=flatD)
s=json.dumps(out,separators=(',',':'))
open(HERE/'art.json','w').write(s); print(len(s))
c=np.zeros((d['H'],d['W'],3),np.uint8)
for x,y,l in D: cv2.circle(c,(x,y),l,(255,180,90),-1)
cv2.imwrite(str(HERE/'dots_check.png'),c)
