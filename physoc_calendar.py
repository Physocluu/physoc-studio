#!/usr/bin/env python3
"""
PhySoc - Monthly "What\'s On" calendar generator (v2: contour-line background + new footer)
Edit the MONTH / YEAR / EVENTS / FOOTER block at the bottom and run.
  python3 physoc_calendar.py --fmt both --footer dark
Rows auto-stack and re-balance for any number of events.
"""
import argparse, html, calendar
try:
    import cairosvg
    HAVE_CAIRO = True
except OSError:
    # The cairo C library (not the Python package) isn't installed on this
    # machine. The script still works -- it just can't render PNGs itself.
    # See the printed note at the end of the run for how to get PNGs anyway.
    cairosvg = None
    HAVE_CAIRO = False

INK="#07140E"; NUCLEUS="#0A0810"; LIME="#BFF36A"; LEAF="#8BC34A"
MINT="#5AD1A0"; FOREST="#2E7D32"; TEAL="#19B89A"; PAPER="#FAFAFA"; META="#5B6472"

F_DISPLAY="SpaceGrotesk Bold"; F_HEAD="Baloo2 Bold"; F_HEAD2="Baloo2 SemiBold"
F_MONO="PlexMono Regular"; F_MONOMED="PlexMono Medium"; F_MONOSB="PlexMono SemiBold"

TYPES={"social":(LIME,INK,"SOCIAL"),"workshop":(MINT,INK,"WORKSHOP"),
       "trip":(LEAF,INK,"TRIP"),"careers":(INK,LIME,"CAREERS"),
       "talk":(FOREST,PAPER,"TALK"),"social+":(LIME,INK,"SOCIAL")}

CONTOURS = [
    ('#BFF36A', '3.5', 'M-80 1105C237 1336 707 841 1160 904'),
    ('#BFF36A', '3.5', 'M-174 719.5C258 694.5 635 849.5 1066 551.5'),
    ('#BFF36A', '3', 'M-80 292C371 33 713 186 1160 151'),
    ('#BFF36A', '2.5', 'M-80 -34C294 104 742 1003 1160 703'),
    ('#BFF36A', '2', 'M-80 939C264 1015 739 -60 1160 103'),
    ('#BFF36A', '2', 'M-80 1122C274 1053 766 1157 1160 863'),
    ('#BFF36A', '1.5', 'M-80 655C285 798 848 489 1160 415'),
    ('#BFF36A', '1.5', 'M-80 276C205 -14 726 1008 1160 1041'),
    ('#BFF36A', '1.5', 'M-80 168C441 -14 944 1057 1160 827'),
    ('#8BC34A', '3', 'M-80 236C159 414 697 97 1160 61'),
    ('#8BC34A', '3', 'M-80 -3C304 -150 877 6.00001 1160 71'),
    ('#8BC34A', '1.5', 'M-80 28C389 -110 668 595 1160 695'),
    ('#7FD0FF', '3.5', 'M-80 696C170 578 669 1077 1160 892'),
    ('#7FD0FF', '2.5', 'M-80 1090C140 915 931 939 1160 957'),
    ('#7FD0FF', '2', 'M-80 769C185 491 646 887 1160 641'),
    ('#19B89A', '3.5', 'M-80 278C451 34 684 547 1160 577'),
    ('#19B89A', '2.5', 'M-80 60C208 -85 887 1025 1160 1127'),
    ('#19B89A', '2.5', 'M-80 318C232 60 885 156 1160 216'),
    ('#19B89A', '2', 'M-80 381C440 524 681 271 1160 -7'),
    ('#BFF36A', '2.5', 'M780 -60C940 220 700 420 980 660C1260 900 860 940 1080 1140'),
    ('#19B89A', '2.5', 'M260 -60C120 240 360 460 140 720C-80 980 300 980 120 1140'),
]

# ---------- atom mark (verbatim from Templates (7).svg) ----------
def atom(cx, cy, size):
    s=size/240.0; tx,ty=cx-120*s, cy-120*s; sw=3.6
    return f"""<g transform="translate({tx:.2f},{ty:.2f}) scale({s:.5f})" fill="none">
  <path d="M120 153C168.601 153 208 138.225 208 120C208 101.775 168.601 87 120 87C71.3989 87 32 101.775 32 120C32 138.225 71.3989 153 120 153Z" stroke="{FOREST}" stroke-width="{sw}" stroke-linecap="round"/>
  <path d="M91.4212 136.5C115.722 178.59 148.216 205.323 164 196.21C179.784 187.098 172.879 145.59 148.579 103.5C124.278 61.4102 91.7837 34.6771 76 43.7898C60.2163 52.9025 67.1206 94.4102 91.4212 136.5Z" stroke="{FOREST}" stroke-width="{sw}" stroke-linecap="round"/>
  <path d="M91.4212 103.5C67.1206 145.59 60.2163 187.098 76 196.21C91.7837 205.323 124.278 178.59 148.579 136.5C172.879 94.4102 179.784 52.9025 164 43.7898C148.216 34.6771 115.722 61.4102 91.4212 103.5Z" stroke="{FOREST}" stroke-width="{sw}" stroke-linecap="round"/>
  <circle cx="120" cy="120" r="14" fill="{NUCLEUS}"/>
  <circle cx="208" cy="120" r="10" fill="{LEAF}"/></g>"""

def wordmark(x, baseline, fs):
    return (f'<text x="{x}" y="{baseline}" font-family="{F_DISPLAY}" font-size="{fs}" letter-spacing="-1">'
            f'<tspan fill="{INK}">Phy</tspan><tspan fill="{FOREST}">Soc</tspan>'
            f'<tspan fill="{LIME}">.</tspan></text>')

def txt(x,y,s,font,fs,fill,anchor="start",ls=None,op=None):
    a=f' text-anchor="{anchor}"' if anchor!="start" else ""
    l=f' letter-spacing="{ls}"' if ls is not None else ""
    o=f' fill-opacity="{op}"' if op is not None else ""
    return f'<text x="{x}" y="{y}" font-family="{font}" font-size="{fs}" fill="{fill}"{a}{l}{o}>{html.escape(s)}</text>'

def clip(s,n): return s if len(s)<=n else s[:n-1].rstrip()+"\u2026"

# ---------- contour field (background, light) ----------
def contour_field(W,H,op=0.12):
    g=['<g fill="none" stroke-linecap="round">']; ty=0
    while ty < H-120:
        for i,(col,w,d) in enumerate(CONTOURS):
            c=(FOREST,LEAF)[i%2]
            g.append(f'<path transform="translate(0,{ty})" d="{d}" stroke="{c}" stroke-width="{w}" stroke-opacity="{op}"/>')
        ty+=1080
    g.append('</g>'); return "".join(g)

def corner_brackets(W,H,t=16,arm=170):
    return (f'<rect x="0" y="0" width="{arm}" height="{t}" fill="{FOREST}"/>'
            f'<rect x="0" y="0" width="{t}" height="{arm}" fill="{FOREST}"/>'
            f'<rect x="{W-arm}" y="{H-t}" width="{arm}" height="{t}" fill="{LIME}"/>'
            f'<rect x="{W-t}" y="{H-arm}" width="{t}" height="{arm}" fill="{LIME}"/>')

def particle(cx,cy,r=8):
    return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{LIME}" stroke="white" stroke-width="3"/>'

# ---------- footers ----------
def footer_dark(W,H,band):
    top=H-band; cid=f"fc{int(top)}"
    wave=f"M0 {top+34} C {W*0.30:.0f} {top-30}, {W*0.66:.0f} {top+66}, {W} {top+6} L{W} {H} L0 {H} Z"
    out=[f'<defs><clipPath id="{cid}"><path d="{wave}"/></clipPath>'
         f'<radialGradient id="fg{cid}" cx="50%" cy="-10%" r="120%">'
         f'<stop offset="0%" stop-color="{FOREST}"/><stop offset="55%" stop-color="{INK}"/>'
         f'<stop offset="100%" stop-color="{INK}"/></radialGradient></defs>']
    out.append(f'<path d="{wave}" fill="url(#fg{cid})"/>')
    out.append(f'<g clip-path="url(#{cid})" fill="none" stroke-linecap="round">')
    for i,(col,w,d) in enumerate(CONTOURS):
        out.append(f'<path transform="translate(0,{top-545})" d="{d}" stroke="{col}" stroke-width="{w}" stroke-opacity="0.42"/>')
    out.append('</g>')
    out.append(f'<g clip-path="url(#{cid})">{particle(W*0.16,top+96,7)}{particle(W*0.82,top+58,9)}{particle(W*0.62,top+150,6)}</g>')
    cy=H-68
    out.append(txt(W/2, cy, "@physocluu", F_MONOSB, 34, PAPER, "middle", "1"))
    out.append(txt(W/2, cy+36, "FULL DETAILS \u00b7 LINK IN BIO", F_MONOMED, 22, LIME, "middle", "2"))
    return "".join(out)

def footer_light(W,H,band):
    top=H-band
    out=['<g fill="none" stroke-linecap="round">']
    for i,(col,w,d) in enumerate(CONTOURS):
        c=(FOREST,LEAF,TEAL)[i%3]
        out.append(f'<path transform="translate(0,{top-690})" d="{d}" stroke="{c}" stroke-width="{w}" stroke-opacity="0.20"/>')
    out.append('</g>')
    out.append(particle(W*0.20,top+74,7)); out.append(particle(W*0.80,top+52,8))
    out.append(f'<rect x="{W*0.5-70}" y="{H-104}" width="140" height="4" rx="2" fill="{LIME}"/>')
    cy=H-58
    out.append(txt(W/2, cy, "@physocluu", F_MONOSB, 30, INK, "middle", "1"))
    out.append(txt(W/2, cy+30, "FULL DETAILS \u00b7 LINK IN BIO", F_MONO, 18, FOREST, "middle", "2", op=0.85))
    return "".join(out)

# ---------- event row ----------
def event_row(ev,x,y,w,h):
    tfill,ttext,tlabel=TYPES.get(ev.get("type","talk"),TYPES["talk"])
    pad=h*0.13; tile=h-2*pad; tx=x+pad; ty=y+pad
    o=[f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="20" fill="white" stroke="{INK}" stroke-opacity="0.12" stroke-width="1.5"/>']
    o.append(f'<rect x="{tx}" y="{ty}" width="{tile}" height="{tile}" rx="16" fill="{tfill}"/>')
    o.append(txt(tx+tile/2, ty+tile*0.34, ev["weekday"].upper(), F_MONOMED, tile*0.155, ttext, "middle", "1"))
    o.append(txt(tx+tile/2, ty+tile*0.82, str(ev["day"]), F_DISPLAY, tile*0.46, ttext, "middle"))
    cx=tx+tile+pad*1.2
    o.append(txt(cx, y+h*0.46, clip(ev["title"],26), F_HEAD, h*0.235, INK))
    meta="  \u00b7  ".join([p for p in [ev.get("time",""),ev.get("place","")] if p])
    o.append(txt(cx, y+h*0.72, clip(meta,40), F_MONO, h*0.135, META))
    pf=h*0.125; pw=len(tlabel)*pf*0.62+pad*1.4; ph=pf*2.0; px=x+w-pad-pw; py=ty
    sc=FOREST if tfill==LIME else tfill
    o.append(f'<rect x="{px}" y="{py}" width="{pw}" height="{ph}" rx="{ph/2}" fill="none" stroke="{sc}" stroke-width="1.6"/>')
    o.append(txt(px+pw/2, py+ph*0.68, tlabel, F_MONOSB, pf, sc, "middle", "1"))
    return "".join(o)

_EXPORT={"SpaceGrotesk Bold":("Space Grotesk",700),"SpaceGrotesk Medium":("Space Grotesk",500),
         "Baloo2 Bold":("Baloo 2",700),"Baloo2 SemiBold":("Baloo 2",600),
         "PlexMono Regular":("IBM Plex Mono",400),"PlexMono Medium":("IBM Plex Mono",500),
         "PlexMono SemiBold":("IBM Plex Mono",600)}
def to_editable(svg):
    for k,(f,wt) in _EXPORT.items():
        svg=svg.replace(f'font-family="{k}"', f'font-family="{f}" font-weight="{wt}"')
    return svg

# ---------- compose ----------
def render(month,year,events,fmt="story",footer="dark",out="calendar.svg"):
    if fmt=="square":
        W=H=1080; m=64; head_top=96; band_top=372
        kfs,mfs=60,96; gap=22; row_max=148; fb=206
    else:
        W,H=1080,1920; m=70; head_top=110; band_top=432
        kfs,mfs=78,132; gap=26; row_max=176; fb=246
    band_bot=H-fb-30
    n=max(1,len(events)); band_h=band_bot-band_top
    row_h=min(row_max,(band_h-gap*(n-1))/n); total=n*row_h+gap*(n-1)
    start_y=band_top+(band_h-total)/2
    s=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">']
    s.append(f'<rect width="{W}" height="{H}" fill="{PAPER}"/>')
    s.append(contour_field(W,H))
    s.append(corner_brackets(W,H))
    s.append(atom(m+30, head_top+30, 64)); s.append(wordmark(m+74, head_top+48, 46))
    ty=head_top+(150 if fmt=="story" else 132)
    s.append(txt(m, ty, "WHAT\u2019S ON", F_DISPLAY, kfs, INK))
    my=ty+mfs*0.92; mname=calendar.month_name[month]
    s.append(txt(m, my, mname, F_HEAD, mfs, FOREST))
    s.append(txt(m+len(mname)*mfs*0.50, my, ".", F_HEAD, mfs, LIME))
    ry=my+mfs*0.30
    s.append(f'<rect x="{m}" y="{ry:.1f}" width="{W-2*m}" height="2" fill="{INK}" fill-opacity="0.10"/>')
    y=start_y
    for ev in events:
        s.append(event_row(ev,m,y,W-2*m,row_h)); y+=row_h+gap
    s.append(footer_dark(W,H,fb) if footer=="dark" else footer_light(W,H,fb))
    s.append('</svg>')
    svg="\n".join(s)
    open(out,"w").write(to_editable(svg))
    if HAVE_CAIRO:
        cairosvg.svg2png(bytestring=svg.encode(), write_to=out.replace(".svg",".png"), output_width=W, output_height=H)
        print("wrote",out,"and a matching .png",f"({n} events, {fmt}, {footer} footer)")
    else:
        print("wrote",out,f"({n} events, {fmt}, {footer} footer) -- PNG skipped, see note below")

# ================== EDIT BELOW ==================
MONTH, YEAR = 10, 2026
FOOTER = "dark"          # "dark" or "light"
EVENTS = [
    {"day":2, "weekday":"Thu","title":"Welcome Social","time":"19:00","place":"Old Bar","type":"social"},
    {"day":9, "weekday":"Thu","title":"Quantum Computing Talk","time":"18:00","place":"Roger Stevens LT 20","type":"talk"},
    {"day":16,"weekday":"Thu","title":"LaTeX & Python Workshop","time":"17:00","place":"EC Stoner 7.70","type":"workshop"},
    {"day":23,"weekday":"Thu","title":"Careers in Physics Panel","time":"18:00","place":"Nexus Auditorium","type":"careers"},
    {"day":25,"weekday":"Sat","title":"Observatory Trip","time":"20:00","place":"Meet at Parkinson Steps","type":"trip"},
    {"day":30,"weekday":"Thu","title":"Halloween Quiz Social","time":"19:30","place":"The Terrace","type":"social"},
]
# ===============================================
if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--fmt",choices=["square","story","both"],default="both")
    ap.add_argument("--footer",choices=["dark","light"],default=FOOTER)
    a=ap.parse_args()
    fmts=["square","story"] if a.fmt=="both" else [a.fmt]
    for f in fmts:
        evs=EVENTS[:4] if f=="square" else EVENTS
        render(MONTH,YEAR,evs,fmt=f,footer=a.footer,out=f"physoc_whatson_{f}.svg")
    if not HAVE_CAIRO:
        print("""
NOTE: PNGs weren't generated because the 'cairo' graphics library isn't
installed on this machine (this is separate from 'pip install cairosvg').
Your .svg files are still complete and correct -- to get a PNG, do EITHER:

  A) No install needed: open the .svg in a browser (drag it in) or in Figma
     -> File/Export as PNG. Quickest if you just want to post today.

  B) Install cairo once, then re-run this script and it'll make PNGs itself:
       Windows : conda install -c conda-forge cairosvg
                 (or pip install pycairo after installing the GTK3 runtime)
       macOS   : brew install cairo
       Linux   : sudo apt-get install libcairo2   (Debian/Ubuntu)
                 sudo dnf install cairo            (Fedora)
""")
