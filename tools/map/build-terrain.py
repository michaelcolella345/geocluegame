# Builds assets/map/terrain.jpg: the borderless, cartoon-style terrain image behind the live map.
# Inputs (equirectangular world images, from NASA Blue Marble, as packaged in the three-globe npm
# package's example/img folder): earth-topology.png (elevation), earth-water.png (water mask) and
# earth-day.jpg (used to find deserts and ice). Put them in a folder and run:
#   python3 build-terrain.py path/to/img ../../assets/map/terrain.jpg
# Needs numpy and Pillow. The output covers 84°N to 60°S, matching tools/map/build-shapes.mjs.
import sys
import numpy as np
IMG = sys.argv[1].rstrip('/') + '/' if len(sys.argv) > 1 else 'img/'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'terrain.jpg'
from PIL import Image, ImageFilter
src=Image.open(IMG+'earth-topology.png').convert('L')
W,H=src.size
water=Image.open(IMG+'earth-water.png').convert('L').resize((W,H),Image.BILINEAR)
landm=water.point(lambda v: 255-v).filter(ImageFilter.GaussianBlur(1.2)).point(lambda v: 255 if v>128 else 0)
L=np.asarray(landm,np.float32)/255
blur=lambda a,r: np.asarray(Image.fromarray(np.clip(a*255,0,255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)),np.float32)/255
sm=np.asarray(src.filter(ImageFilter.GaussianBlur(3)),np.float32)/248
e=np.clip(sm,0,1)**0.7
# smooth ramp through the same cartoon colors
stops=[0.0,0.14,0.30,0.45,0.60,0.78,0.92]
cols=[(126,196,104),(160,206,108),(206,214,122),(236,206,130),(206,150,94),(168,120,90),(250,250,246)]
col=np.stack([np.interp(e,stops,[c[i] for c in cols]) for i in range(3)],-1)
day=np.asarray(Image.open(IMG+'earth-day.jpg').convert('RGB').resize((W,H),Image.BILINEAR).filter(ImageFilter.GaussianBlur(3)),np.float32)
r,g,b=day[...,0],day[...,1],day[...,2]
dry=np.clip(((r-g)+(r+g-2*b)*0.35-8)/22,0,1)
dry=blur(np.clip((blur(dry,4)-0.3)/0.4,0,1),10)  # soft desert mask
lowness=np.clip(1-(e-0.3)/0.25,0,1)              # deserts fade out up the mountains
sandc=np.array([238,206,140],np.float32)
k=(dry*lowness)[...,None]
col=col*(1-k)+sandc*k
lat=np.abs(90-np.arange(H)*180/H)[:,None]
bright=blur(np.clip(((r+g+b)/3-170)/50,0,1),6)
ice=bright*np.clip((lat-52)/8,0,1)
col=col*(1-ice[...,None])+np.array([250,250,246],np.float32)*ice[...,None]
# gentle soft shading
gs=np.asarray(src.filter(ImageFilter.GaussianBlur(3)),np.float32)/248*30
gy,gx=np.gradient(gs)
shade=np.clip(1+(-gx-gy)*0.12,0.86,1.1)[...,None]
land=np.clip(col*shade,0,255)
# water: shallow near coasts fading to deep
near=blur(L,8)
t=np.clip(near*3,0,1)[...,None]
deep=np.array([96,170,214],np.float32); shallow=np.array([156,212,234],np.float32)
sea=deep*(1-t)+shallow*t
dil=np.asarray(landm.filter(ImageFilter.MaxFilter(3)),np.float32)/255
edge=(blur(np.clip(dil-L,0,1),0.7)*0.85)[...,None]
outline=np.array([52,88,104],np.float32)
out=land*L[...,None]+sea*(1-L[...,None])
out=out*(1-edge)+outline*edge
img=Image.fromarray(np.clip(out,0,255).astype(np.uint8))
y0=int((90-84)/180*H); y1=int((90+60)/180*H)
img=img.crop((0,y0,W,y1))
img.save(OUT,quality=82,optimize=True,progressive=True)
