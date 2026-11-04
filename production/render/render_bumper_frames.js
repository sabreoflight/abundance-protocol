const {chromium}=require('playwright');const fs=require('fs');
const [html,out,W,N]=[process.argv[2],process.argv[3],+process.argv[4],+process.argv[5]];
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
await p.goto('file://'+process.cwd()+'/'+html);const total=Math.round(await p.evaluate(()=>DUR)*24);
for(let f=W;f<total;f+=N){const d=await p.evaluate(f=>{render(f/24);return document.getElementById('c').toDataURL('image/jpeg',0.93)},f);fs.writeFileSync(`${out}/f${String(f).padStart(6,'0')}.jpg`,Buffer.from(d.split(',')[1],'base64'))}
await b.close()})();
