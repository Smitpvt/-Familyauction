const v=require('/home/claude/jersey/node_modules/gltf-validator'),fs=require('fs');
(async()=>{for(const t of ['malgund','sherle','ratnagiri','kotwade']){
 const f=`/home/claude/jersey/teams/${t}/hfpl_jersey_${t}.glb`; const d=new Uint8Array(fs.readFileSync(f));
 const r=await v.validateBytes(d); const i=r.issues;
 console.log(t, (d.length/1048576).toFixed(2)+'MB', 'errors',i.numErrors,'warnings',i.numWarnings,'tris',r.info.totalTriangleCount,'verts',r.info.totalVertexCount,
  'images',(r.info.resources||[]).filter(x=>x.pointer.startsWith('/images')).map(x=>x.mimeType.split('/')[1]+' '+x.image.width+'x'+x.image.height+' '+x.storage).join(', '));
 if(i.numErrors||i.numWarnings) console.log(i.messages.slice(0,5));}})();
