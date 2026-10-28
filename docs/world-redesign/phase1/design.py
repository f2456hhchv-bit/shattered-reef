import json,numpy as np,matplotlib.pyplot as plt
from matplotlib.path import Path
from scipy.interpolate import splprep,splev
from scipy.ndimage import distance_transform_edt
from pathlib import Path as F
root=F(__file__).resolve().parent;old=json.loads((root/'existing.json').read_text())
controls=[[-180,-440],[-110,-470],[-35,-440],[30,-430],[65,-370],[105,-335],[175,-345],[215,-385],[270,-390],[305,-350],[285,-300],[250,-260],[270,-215],[325,-225],[365,-275],[405,-285],[430,-240],[410,-180],[385,-145],[390,-70],[370,-5],[405,50],[445,100],[475,180],[455,255],[420,290],[365,300],[330,280],[340,240],[310,225],[295,255],[270,295],[215,335],[155,365],[100,395],[65,395],[45,365],[25,350],[-10,350],[-35,375],[-75,400],[-135,410],[-190,385],[-235,340],[-285,310],[-320,265],[-335,200],[-320,145],[-350,95],[-390,65],[-405,15],[-385,-10],[-330,-25],[-300,-35],[-270,-35],[-240,-42],[-215,-55],[-225,-72],[-255,-85],[-285,-88],[-310,-100],[-325,-110],[-305,-155],[-307,-225],[-290,-290],[-285,-315],[-255,-360],[-230,-415],[-180,-440]]
a=np.array(controls);tck,u=splprep(a.T,s=0,per=True);outline=np.array(splev(np.linspace(0,1,768,endpoint=False),tck)).T
poly=Path(outline,closed=False)
# 2 m precomputed field: sampled once, bilinear queries at runtime.
axis=np.arange(-620,622,2);xx,zz=np.meshgrid(axis,axis);mask=poly.contains_points(np.c_[xx.ravel(),zz.ravel()]).reshape(xx.shape)
sdf=(distance_transform_edt(mask)-distance_transform_edt(~mask))*2
sdf.astype('<f4').tofile(root/'shore-distance.f32')
meta={'island':'bellwether','status':'isolated geography prototype; not installed in the game','controls':controls,'outline':outline.tolist(),'field':{'origin':[-620,-620],'spacing':2,'width':len(axis),'file':'shore-distance.f32','positive':'land'},'features':{'harbour':[0,350],'west_estuary':[-285,-60],'northeast_inlet':[305,-285],'southeast_cove':[315,255]}}
(root/'coastline.json').write_text(json.dumps(meta,indent=2))
fig,axs=plt.subplots(1,2,figsize=(16,10),facecolor='#f2eedf')
for ax,pts,title in zip(axs,[np.array(old['outline']),outline],['CURRENT · sampled game geometry','PROPOSED · authored coastal structure']):
 ax.set_facecolor('#acd2d2');ax.fill(pts[:,0],pts[:,1],color='#88a96a',ec='#42674f',lw=1.8);ax.set_xlim(-530,530);ax.set_ylim(470,-520);ax.set_aspect('equal');ax.set_title(title,fontweight='bold',fontsize=12,pad=18);ax.set_xlabel('metres east / west');ax.grid(alpha=.12);ax.set_ylabel('metres north / south');ax.plot([0,58,62,98,9],[323,214,42,-36,-237],color='#d6bf83',lw=3,zorder=3)
 for key,label in [('village','Quay'),('quarry','Quarry'),('copperback','Copperback'),('saltpine','Saltpine'),('peak','Ironcrag'),('ruin','Quest arena')]:
  p=old['anchors'][key];ax.plot(p['x'],p['z'],'o',ms=4,c='#303e36');ax.annotate(label,(p['x'],p['z']),xytext=(6,-9),textcoords='offset points',fontsize=8)
for text,point,label in [('Drowned river valley\nwith tidal mudflats',(-275,-60),(-440,-160)),('Exposed rock headlands\nand a sheltered inlet',(326,-253),(245,-455)),('Southern harbour retained\nbehind uneven sheltering arms',(0,350),(-240,450)),('Small working cove\nwith a narrow mouth',(315,255),(360,365))]:
 axs[1].annotate(text,point,xytext=label,fontsize=9,ha='center',arrowprops={'arrowstyle':'-','color':'#34483d'},bbox={'facecolor':'#f2eedf','edgecolor':'none','alpha':.88})
fig.suptitle('BELLWETHER · PHASE 1 COASTLINE STUDY',fontsize=20,fontweight='bold',y=.99)
fig.text(.5,.025,'Geometry study, not final environment art. Existing inland anchors shown for comparison; coastal content requires a migration pass.',ha='center',fontsize=10)
fig.tight_layout(rect=[0,.05,1,.95]);fig.savefig(root/'coastline-comparison.png',dpi=160)
fig,ax=plt.subplots(figsize=(10,10),facecolor='#acd2d2');ax.set_facecolor('#acd2d2');ax.fill(outline[:,0],outline[:,1],color='#88a96a',ec='#42674f',lw=2);ax.set_xlim(-530,530);ax.set_ylim(470,-520);ax.set_aspect('equal');ax.axis('off');fig.tight_layout(pad=0);fig.savefig(root/'silhouette-reference.png',dpi=120)
print('Field',mask.shape,'land area',int(mask.sum()*4),'m2','bounds',outline.min(axis=0),outline.max(axis=0))
