import json, struct
from pathlib import Path

OUT = Path('assets/characters/ajax/ajax.glb')
verts=[]; faces=[]; colors=[]

SKIN=[105,128,140,255]; BELLY=[225,235,238,255]; BLUE=[28,63,110,255]; DARK=[20,30,38,255]; EYE=[5,5,7,255]; TEETH=[250,245,220,255]

def box(center, ext, color):
    cx,cy,cz=center; ex,ey,ez=[v/2 for v in ext]
    vs=[(-ex,-ey,-ez),(ex,-ey,-ez),(ex,ey,-ez),(-ex,ey,-ez),(-ex,-ey,ez),(ex,-ey,ez),(ex,ey,ez),(-ex,ey,ez)]
    base=len(verts)
    verts.extend([(x+cx,y+cy,z+cz) for x,y,z in vs]); colors.extend([color]*8)
    fs=[(0,1,2),(0,2,3),(4,6,5),(4,7,6),(0,4,5),(0,5,1),(1,5,6),(1,6,2),(2,6,7),(2,7,3),(4,0,3),(4,3,7)]
    faces.extend([[base+i for i in f] for f in fs])

def octa(center, scale, color):
    cx,cy,cz=center; sx,sy,sz=scale; base=len(verts)
    vs=[(0,0,sz),(0,0,-sz),(sx,0,0),(-sx,0,0),(0,sy,0),(0,-sy,0)]
    verts.extend([(x+cx,y+cy,z+cz) for x,y,z in vs]); colors.extend([color]*6)
    fs=[(0,2,4),(0,4,3),(0,3,5),(0,5,2),(1,4,2),(1,3,4),(1,5,3),(1,2,5)]
    faces.extend([[base+i for i in f] for f in fs])

box((0,0,2.15),(1.35,.82,1.5),SKIN); box((0,-.42,2.10),(.86,.20,1.0),BELLY)
octa((0,0,3.30),(.60,.48,.62),SKIN); octa((0,-.40,3.18),(.42,.22,.22),BELLY)
box((-.82,0,2.15),(.36,.40,.95),SKIN); box((.82,0,2.15),(.36,.40,.95),SKIN)
octa((-.94,0,1.62),(.24,.22,.28),BELLY); octa((.94,0,1.62),(.24,.22,.28),BELLY)
box((0,0,1.35),(1.0,.62,.55),BLUE); box((-.28,0,.80),(.36,.40,.72),BELLY); box((.28,0,.80),(.36,.40,.72),BELLY)
octa((-.28,0,.30),(.34,.28,.42),DARK); octa((.28,0,.30),(.34,.28,.42),DARK)
box((-.38,-.43,3.46),(.16,.10,.16),EYE); box((.38,-.43,3.46),(.16,.10,.16),EYE)
box((0,-.47,3.08),(.72,.10,.18),DARK); box((0,.08,3.95),(.14,.28,.85),DARK)
box((-1.10,0,2.48),(.65,.10,.16),SKIN); box((1.10,0,2.48),(.65,.10,.16),SKIN)
for x in (-.24,-.12,0,.12,.24): box((x,-.53,3.04),(.07,.06,.14),TEETH)

V=[tuple(map(float,v)) for v in verts]; F=faces
N=[[0.0,0.0,0.0] for _ in V]
for f in F:
    a,b,c=[V[i] for i in f]
    ab=[b[i]-a[i] for i in range(3)]; ac=[c[i]-a[i] for i in range(3)]
    n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]]
    for i in f:
        N[i]=[N[i][j]+n[j] for j in range(3)]
for i,n in enumerate(N):
    l=sum(x*x for x in n)**0.5 or 1; N[i]=[x/l for x in n]

buf=bytearray()
def align():
    while len(buf)%4: buf.append(0)
def add(data):
    off=len(buf); buf.extend(data); align(); return off,len(data)
import array
pos=add(struct.pack('<%sf'% (len(V)*3), *[x for v in V for x in v]))
nor=add(struct.pack('<%sf'% (len(N)*3), *[x for n in N for x in n]))
col=add(bytes(x for c in colors for x in c))
idx=add(struct.pack('<%sH'% (len(F)*3), *[i for f in F for i in f]))

def view(off,l,target): return {'buffer':0,'byteOffset':off,'byteLength':l,'target':target}
gltf={'asset':{'version':'2.0','generator':'Hero Vortex Ajax GLB generator'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Ajax_GLTF','mesh':0}], 'meshes':[{'name':'Ajax','primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'COLOR_0':2},'indices':3,'material':0}]}], 'materials':[{'name':'Ajax Vertex Colors','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':0,'roughnessFactor':0.72}}], 'buffers':[{'byteLength':len(buf)}], 'bufferViews':[view(*pos,34962),view(*nor,34962),view(*col,34962),view(*idx,34963)], 'accessors':[{'bufferView':0,'componentType':5126,'count':len(V),'type':'VEC3','min':[min(v[i] for v in V) for i in range(3)],'max':[max(v[i] for v in V) for i in range(3)]},{'bufferView':1,'componentType':5126,'count':len(N),'type':'VEC3'},{'bufferView':2,'componentType':5121,'count':len(colors),'type':'VEC4','normalized':True},{'bufferView':3,'componentType':5123,'count':len(F)*3,'type':'SCALAR','min':[0],'max':[len(V)-1]}]}
j=json.dumps(gltf,separators=(',',':')).encode()
while len(j)%4: j+=b' '
out=bytearray(struct.pack('<4sII',b'glTF',2,0)); out.extend(struct.pack('<I4s',len(j),b'JSON')); out.extend(j); out.extend(struct.pack('<I4s',len(buf),b'BIN\x00')); out.extend(buf); struct.pack_into('<I',out,8,len(out))
OUT.parent.mkdir(parents=True,exist_ok=True); OUT.write_bytes(out)
print(f'Generated {OUT} ({len(out)} bytes)')
