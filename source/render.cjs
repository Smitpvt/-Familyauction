const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const fs=require('fs');
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
   args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
 const p=await b.newPage(); p.on('console',m=>console.log('console:',m.text())); p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('http://localhost:8765/render.html?f='+(process.env.GLB||'./hfpl_jersey.glb')); await p.waitForFunction('window.READY',null,{timeout:60000});
 console.log(JSON.stringify(await p.evaluate('window.INFO')));
 if(process.argv[3]){const [n,num]=JSON.parse(process.argv[3]); await p.evaluate(([a,b])=>window.setPlayer(a,b),[n,num]);}
 const views=JSON.parse(process.argv[2]||'[[0],[45],[90],[135],[180],[225],[270],[315]]');
 const OUT=process.env.OUT||'views'; fs.mkdirSync(OUT,{recursive:true});
 for(const [i,v] of views.entries()){const d=await p.evaluate(([a,e,dd])=>window.shot(a,e,dd),[v[0],v[1]??0.05,v[2]??2.15]);
   fs.writeFileSync(`${OUT}/v${i}.png`,Buffer.from(d.split(',')[1],'base64'));}
 await b.close();})();
