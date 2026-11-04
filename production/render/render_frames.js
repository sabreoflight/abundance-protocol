const {chromium}=require('playwright');const fs=require('fs');
const FPS=24,W=+process.argv[2],N=+process.argv[3];
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1280,height:720}});
 await p.goto('file://'+process.cwd()+'/anim.html');
 const total=Math.round(await p.evaluate(()=>DUR)*FPS);
 for(let f=W;f<total;f+=N){
  const d=await p.evaluate(f=>{render(f/24);return document.getElementById('c').toDataURL('image/jpeg',0.93)},f);
  fs.writeFileSync(`frames/f${String(f).padStart(6,'0')}.jpg`,Buffer.from(d.split(',')[1],'base64'));
 }
 await b.close();
})();
