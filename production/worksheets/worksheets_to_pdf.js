const {chromium}=require('playwright');const W=require('/home/user/worksheets/worksheets.json');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
for(const w of W){const id=w.ep==='S2'?'step2':'ep'+w.ep;const slug=w.title.toLowerCase().replace(/[^a-z0-9]+/g,'_');
 await p.goto('file:///home/user/worksheets/ws_'+id+'.html');
 await p.pdf({path:`/home/user/worksheets/worksheet_${id}_${slug}.pdf`,format:'Letter',printBackground:true,preferCSSPageSize:true});}
await p.setViewportSize({width:816,height:1056});await p.goto('file:///home/user/worksheets/ws_step2.html');await p.screenshot({path:'/tmp/claude-0/-home-user/28fd610f-e305-5f5d-acc7-795f2e2a111f/scratchpad/hub/ws2.png'});
await b.close()})();
