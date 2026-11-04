import json,html
W=json.load(open('/home/user/worksheets/worksheets.json'))
CSS='''
@page{size:Letter;margin:0.55in 0.6in}
*{box-sizing:border-box}
body{font-family:"Inter",Arial,sans-serif;color:#1b2140;font-size:10.5pt;line-height:1.45;margin:0}
.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1b2140;padding-bottom:8px;margin-bottom:12px}
.brand{font-size:8pt;letter-spacing:.35em;color:#a07a2c;font-weight:600}
h1{font-family:"Bitstream Charter",Georgia,serif;font-weight:400;font-size:26pt;margin:2px 0 0;line-height:1.05}
.ep{text-align:right;font-size:8.5pt;letter-spacing:.14em;color:#5a6286;text-transform:uppercase}
.ep b{display:block;font-size:13pt;color:#1b2140;letter-spacing:.04em}
.idea{font-family:"Bitstream Charter",Georgia,serif;font-size:12pt;font-style:italic;background:#f5f1e6;border-left:3px solid #c9a24c;padding:9px 12px;margin:0 0 14px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 22px}
h2{font-size:8.5pt;letter-spacing:.22em;color:#a07a2c;margin:0 0 5px;text-transform:uppercase}
ul{margin:0;padding:0;list-style:none}
.do li{padding-left:20px;position:relative;margin:4px 0}
.do li:before{content:"";position:absolute;left:0;top:3px;width:11px;height:11px;border:1.4px solid #1b2140;border-radius:2px}
.say li{font-family:"Bitstream Charter",Georgia,serif;font-size:11.5pt;margin:4px 0}
.say li:before{content:"“";color:#c9a24c}.say li:after{content:"”";color:#c9a24c}
.rem li{margin:4px 0;padding-left:12px;border-left:2px solid #d8dbe8}
.ref{margin-top:14px}
.ref .q{margin:8px 0 2px;font-weight:600}
.line{border-bottom:1px solid #b9bed3;height:20px}
.track{margin-top:14px}
.days{display:grid;gap:6px;margin-top:6px}
.d{border:1.2px solid #1b2140;border-radius:4px;height:30px;font-size:7pt;color:#5a6286;padding:2px 4px}
.foot{margin-top:14px;padding-top:6px;border-top:1px solid #d8dbe8;font-size:7.5pt;color:#5a6286;display:flex;justify-content:space-between}
'''
def esc(s):return html.escape(s)
for w in W:
    lines_per=2 if len(w['reflect'])<=3 else 1
    ref=''.join(f'<div class="q">{esc(q)}</div>'+'<div class="line"></div>'*lines_per for q in w['reflect'])
    n=w.get('days',7)
    cols=10 if n==30 else 7
    days=''.join(f'<div class="d">{"Day "+str(i+1) if n==30 else ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</div>' for i in range(n))
    h=f'''<!doctype html><html><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="top"><div><div class="brand">MISSION ABUNDANCE · WORKSHEET</div><h1>{esc(w['title'])}</h1></div><div class="ep">{"Deep dive" if w["ep"]=="S2" else "Episode"}<b>{"Step 2" if w["ep"]=="S2" else w["ep"]+" · "+esc(w["step"])}</b></div></div>
<div class="idea">{esc(w['idea'])}</div>
<div class="grid">
 <div><h2>Do</h2><ul class="do">{''.join(f'<li>{esc(x)}</li>' for x in w['do'])}</ul></div>
 <div><h2>Say</h2><ul class="say">{''.join(f'<li>{esc(x)}</li>' for x in w['say'])}</ul>
 <h2 style="margin-top:12px">Remember</h2><ul class="rem">{''.join(f'<li>{esc(x)}</li>' for x in w['remember'])}</ul></div>
</div>
<div class="ref"><h2>Reflect</h2>{ref}</div>
<div class="track"><h2>Track · {esc(w['track'])}</h2><div class="days" style="grid-template-columns:repeat({cols},1fr)">{days}</div></div>
<div class="foot"><span>The Abundance Protocol · Mission Abundance</span><span>A contemplative practice, not financial or professional advice.</span></div>
</body></html>'''
    open('/home/user/worksheets/ws_'+('step2' if w['ep']=='S2' else 'ep'+w['ep'])+'.html','w').write(h)
print('ok')
