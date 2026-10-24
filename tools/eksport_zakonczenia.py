"""Eksport oryginalnej planszy końcowej poziomu 11 z SWF do statycznego SVG.

Użycie: python tools/eksport_zakonczenia.py e_kolejnyetap.swf zakonczenie.svg
Odtwarza wektory, gradienty, osadzone glify i pierwsze klatki symboli SWF 6.
Obsługuje tagi użyte w tej planszy; nie jest ogólnym odtwarzaczem Flasha.
Nie wymaga bibliotek zewnętrznych ani zainstalowanych czcionek.
"""
import collections, pathlib, struct, sys, zlib

class Bits:
    def __init__(self,d,p=0): self.d,self.p=d,p*8
    def u(self,n):
        v=0
        for _ in range(n): v=(v<<1)|((self.d[self.p//8]>>(7-self.p%8))&1);self.p+=1
        return v
    def s(self,n):
        v=self.u(n); return v-(1<<n) if n and v&(1<<(n-1)) else v
    def byte(self): self.p=(self.p+7)//8*8;return self.p//8

def rect(d,p):
    b=Bits(d,p);n=b.u(5);v=[b.s(n) for _ in range(4)];return v,b.byte()
def matrix(d,p):
    b=Bits(d,p);a=dd=1;c=e=0
    if b.u(1): n=b.u(5);a=b.s(n)/65536;dd=b.s(n)/65536
    if b.u(1): n=b.u(5);c=b.s(n)/65536;e=b.s(n)/65536
    n=b.u(5);x,y=b.s(n),b.s(n)
    return f'matrix({a:g} {c:g} {e:g} {dd:g} {x} {y})',b.byte()
def rgb(d,p,alpha):
    r,g,b=d[p:p+3];a=d[p+3]/255 if alpha else 1
    return f'rgba({r},{g},{b},{a:g})',p+(4 if alpha else 3)
def tags(d,p):
    while p+2<=len(d):
        h=struct.unpack_from('<H',d,p)[0];p+=2;t,n=h>>6,h&63
        if n==63:n=struct.unpack_from('<I',d,p)[0];p+=4
        v=d[p:p+n];p+=n;yield t,v
        if t==0:return

class Export:
    def __init__(self):self.defs=[];self.fonts={};self.counter=0
    def styles(self,d,p,alpha):
        n=d[p];p+=1
        if n==255:n=struct.unpack_from('<H',d,p)[0];p+=2
        fills=['none']
        for _ in range(n):
            t=d[p];p+=1
            if t==0: c,p=rgb(d,p,alpha);fills.append(c)
            elif t in (16,18):
                m,p=matrix(d,p);k=d[p]&15;p+=1;stops=[]
                for _ in range(k):
                    r=d[p];p+=1;c,p=rgb(d,p,alpha);stops.append(f'<stop offset="{r/255:g}" stop-color="{c}"/>')
                self.counter+=1;gid=f'gradient{self.counter}'
                attrs='x1="-16384" y1="0" x2="16384" y2="0"' if t==16 else 'cx="0" cy="0" r="16384"'
                tag='linearGradient' if t==16 else 'radialGradient'
                self.defs.append(f'<{tag} id="{gid}" gradientUnits="userSpaceOnUse" gradientTransform="{m}" {attrs}>{"".join(stops)}</{tag}>')
                fills.append(f'url(#{gid})')
            else:raise ValueError(f'Unsupported fill {t}')
        n=d[p];p+=1
        if n==255:n=struct.unpack_from('<H',d,p)[0];p+=2
        lines=[None]
        for _ in range(n):
            w=struct.unpack_from('<H',d,p)[0];p+=2;c,p=rgb(d,p,alpha);lines.append((w,c))
        return fills,lines,p
    def shape(self,d,p,alpha=False,glyph=False):
        fills,lines,p=(['none','inherit'],[None],p) if glyph else self.styles(d,p,alpha)
        b=Bits(d,p);fb,lb=b.u(4),b.u(4);x=y=f0=f1=line=0;fo=lo=0;edges=collections.defaultdict(list);strokes=collections.defaultdict(list)
        while True:
            if b.u(1):
                straight=b.u(1);n=b.u(4)+2;start=(x,y)
                if straight:
                    if b.u(1):x+=b.s(n);y+=b.s(n)
                    elif b.u(1):y+=b.s(n)
                    else:x+=b.s(n)
                    control=None
                else:
                    cx,cy=x+b.s(n),y+b.s(n);x,y=cx+b.s(n),cy+b.s(n);control=(cx,cy)
                end=(x,y)
                if f1:edges[f1].append((start,control,end))
                if f0:edges[f0].append((end,control,start))
                if line:strokes[line].append((start,control,end))
            else:
                flags=b.u(5)
                if not flags:break
                if flags&1:n=b.u(5);x,y=b.s(n),b.s(n)
                if flags&2:v=b.u(fb);f0=v+fo if v else 0
                if flags&4:v=b.u(fb);f1=v+fo if v else 0
                if flags&8:v=b.u(lb);line=v+lo if v else 0
                if flags&16:
                    nf,nl,q=self.styles(d,b.byte(),alpha);fo=len(fills)-1;lo=len(lines)-1
                    fills.extend(nf[1:]);lines.extend(nl[1:]);b=Bits(d,q);fb,lb=b.u(4),b.u(4)
        def paths(segments,close):
            segments=list(segments);out=[]
            while segments:
                start,c,end=segments.pop(0);first=start;path=f'M{start[0]} {start[1]}'
                while True:
                    path+=(f'Q{c[0]} {c[1]} {end[0]} {end[1]}' if c else f'L{end[0]} {end[1]}')
                    if end==first:
                        if close:path+='Z'
                        break
                    i=next((i for i,s in enumerate(segments) if s[0]==end),None)
                    if i is None:break
                    start,c,end=segments.pop(i)
                out.append(path)
            return ''.join(out)
        out=[]
        for i,es in edges.items():out.append(f'<path fill="{fills[i]}" fill-rule="evenodd" d="{paths(es,True)}"/>')
        for i,es in strokes.items():
            w,c=lines[i];out.append(f'<path fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" d="{paths(es,False)}"/>')
        return ''.join(out)
    def text(self,d,alpha):
        cid=struct.unpack_from('<H',d)[0];_,p=rect(d,2);m,p=matrix(d,p);gb,ab=d[p:p+2];p+=2
        x=y=0;font=None;size=1024;color='black';out=[]
        while p<len(d) and d[p]:
            flags=d[p];p+=1
            if flags&8:font=struct.unpack_from('<H',d,p)[0];p+=2
            if flags&4:color,p=rgb(d,p,alpha)
            if flags&1:x=struct.unpack_from('<h',d,p)[0];p+=2
            if flags&2:y=struct.unpack_from('<h',d,p)[0];p+=2
            if flags&8:size=struct.unpack_from('<H',d,p)[0];p+=2
            n=d[p];p+=1;b=Bits(d,p)
            for _ in range(n):
                glyph=b.u(gb);adv=b.s(ab)
                out.append(f'<use href="#font{font}glyph{glyph}" transform="translate({x} {y}) scale({size/1024:g})" fill="{color}"/>');x+=adv
            p=b.byte()
        self.defs.append(f'<g id="char{cid}" transform="{m}">{"".join(out)}</g>')
    def place(self,d,display):
        flags=d[0];depth=struct.unpack_from('<H',d,1)[0];p=3
        state=display.get(depth,{}).copy()
        if flags&2:state['id']=struct.unpack_from('<H',d,p)[0];p+=2
        if flags&4:state['matrix'],p=matrix(d,p)
        if flags&8:
            b=Bits(d,p);add,mul=b.u(1),b.u(1);n=b.u(4)
            multipliers=[b.s(n)/256 for _ in range(4)] if mul else [1]*4
            offsets=[b.s(n)/255 for _ in range(4)] if add else [0]*4
            p=b.byte()
            if multipliers!=[1]*4 or offsets!=[0]*4:
                self.counter+=1;fid=f'color{self.counter}'
                vals=' '.join(str(v) for i in range(4) for v in [*(multipliers[i] if j==i else 0 for j in range(4)),offsets[i]])
                self.defs.append(f'<filter id="{fid}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="{vals}"/></filter>');state['filter']=fid
        display[depth]=state
    def timeline(self,d,p=0):
        display={}
        for t,v in tags(d,p):
            if t in (2,22,32):
                cid=struct.unpack_from('<H',v)[0];_,q=rect(v,2)
                self.defs.append(f'<g id="char{cid}">{self.shape(v,q,t==32)}</g>')
            elif t==10:
                cid,first=struct.unpack_from('<HH',v);count=first//2
                offsets=struct.unpack_from('<'+'H'*count,v,2)
                for i,off in enumerate(offsets):self.defs.append(f'<g id="font{cid}glyph{i}">{self.shape(v,2+off,glyph=True)}</g>')
            elif t in (11,33):self.text(v,t==33)
            elif t==39:
                cid=struct.unpack_from('<H',v)[0];s=self.timeline(v,4);self.defs.append(f'<g id="char{cid}">{s}</g>')
            elif t==26:self.place(v,display)
            elif t==28:display.pop(struct.unpack_from('<H',v)[0],None)
            elif t in (0,1):break
            elif t not in (9,12,13,62):raise ValueError(f'Unsupported tag {t}')
        out=[]
        for depth,state in sorted(display.items()):
            if 'id' not in state:continue
            f=f' filter="url(#{state["filter"]})"' if 'filter' in state else ''
            out.append(f'<g transform="{state.get("matrix","matrix(1 0 0 1 0 0)")}"{f}><use href="#char{state["id"]}"/></g>')
        return ''.join(out)
    def run(self,path,out):
        d=pathlib.Path(path).read_bytes()
        if d[:3]==b'CWS':d=d[:8]+zlib.decompress(d[8:])
        r,p=rect(d,8);svg=self.timeline(d,p+4);x0,x1,y0,y1=r
        body=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0} {y0} {x1-x0} {y1-y0}" width="{(x1-x0)/20:g}" height="{(y1-y0)/20:g}"><title>Zakończenie gry Kubuś i Wehikuł Czasu</title><defs>{"".join(self.defs)}</defs>{svg}</svg>'
        pathlib.Path(out).write_text(body,encoding='utf8');print(out,r,len(body))

if __name__=='__main__':Export().run(*sys.argv[1:])
