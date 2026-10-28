import json,numpy as np
from pathlib import Path
from scipy.ndimage import label
from matplotlib.path import Path as Polygon
root=Path(__file__).resolve().parent
a=np.array(json.loads((root/'coastline.json').read_text())['outline']);b=np.roll(a,-1,axis=0)
def cross(x,y):return x[...,0]*y[...,1]-x[...,1]*y[...,0]
hits=[]
for i in range(len(a)):
 for j in range(i+2,len(a)):
  if i==0 and j==len(a)-1:continue
  if cross(b[i]-a[i],a[j]-a[i])*cross(b[i]-a[i],b[j]-a[i])<0 and cross(b[j]-a[j],a[i]-a[j])*cross(b[j]-a[j],b[i]-a[j])<0:hits.append([i,j])
f=np.fromfile(root/'shore-distance.f32',dtype='<f4').reshape(621,621)
_,n=label(f>0)
old=np.array(json.loads((root/'existing.json').read_text())['outline']);axis=np.arange(-620,622,2);xx,zz=np.meshgrid(axis,axis);oldArea=int(Polygon(old).contains_points(np.c_[xx.ravel(),zz.ravel()]).sum()*4)
# Preserve the entire 26.5m lagoon depression and an additional dry barrier to the sea.
lagoon=[-153,-99]; lagoonShoreClearance=float(f[round((lagoon[1]+620)/2),round((lagoon[0]+620)/2)])
r={'outlineSegments':len(a),'selfIntersections':hits,'mainlandComponents':int(n),'landAreaSquareMetres':int(np.sum(f>0)*4),'baselineMainlandAreaSquareMetres':oldArea,'boundsMetres':[a.min(axis=0).tolist(),a.max(axis=0).tolist()],'lagoonCentreToSeaMetresSampled':lagoonShoreClearance,'lagoonDepressionOuterRadiusMetres':26.5,'note':'Mainland only; 2m raster; separate production islet and freshwater depression are excluded from this field.'}
(root/'topology.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
assert not hits and n==1 and lagoonShoreClearance>26.5+20
