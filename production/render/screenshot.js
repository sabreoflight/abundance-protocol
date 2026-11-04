const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
 p.on('pageerror',e=>console.log('ERR',e.message));p.on('console',m=>{if(m.type()==='error')console.log('CE',m.text())});
 await p.goto('file://'+process.cwd()+'/anim.html');
 console.log('DUR',await p.evaluate(()=>DUR));
 const ts=process.argv.slice(2).map(Number);
 const t0=Date.now();
 for(const t of ts){await p.evaluate(t=>render(t),t);await p.screenshot({path:`s_${t}.png`});}
 console.log('ms/frame',(Date.now()-t0)/ts.length);
 await b.close();
})();
