const v=require('gltf-validator'),fs=require('fs');
const d=new Uint8Array(fs.readFileSync('hfpl_jersey.glb'));
v.validateBytes(d).then(r=>{const i=r.issues;console.log(JSON.stringify({errors:i.numErrors,warnings:i.numWarnings,infos:i.numInfos,
 messages:i.messages.filter(m=>m.severity<=1).map(m=>m.code+': '+m.message).slice(0,10),
 info:{tris:r.info.totalTriangleCount,verts:r.info.totalVertexCount,materials:r.info.materialCount,textures:(r.info.resources||[]).filter(x=>x.pointer.startsWith('/images')).map(x=>x.mimeType+' '+x.image.width+'x'+x.image.height+' '+x.storage)}},null,1))});
