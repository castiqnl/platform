// Root-owned, fixed loopback check, executed in a separate trusted transient unit.
import http from 'node:http';
const sha=process.argv[2];
if(!/^[0-9a-f]{40}$/.test(sha||''))process.exit(64);
const read=path=>new Promise((resolve,reject)=>{
 const request=http.get({host:'127.0.0.1',port:4184,path,localAddress:'127.0.0.2',timeout:3000},response=>{
  let body='';response.on('data',chunk=>{body+=chunk;if(body.length>8192)request.destroy(new Error('Response too large'));});
  response.on('end',()=>{try{resolve({code:response.statusCode,...JSON.parse(body)});}catch{reject(new Error('Invalid health response'));}});
 });
 request.on('error',reject);request.on('timeout',()=>request.destroy(new Error('Health timeout')));
});
for(let attempt=0;attempt<20;attempt++){
 try{
  const result=await read('/api/health'),ready=await read('/api/readiness');
  if(result.code===200&&result.status==='ok'&&result.commit===sha&&result.authMode==='supabase'&&result.publicationMode==='sandbox-only'&&ready.code===200&&ready.status==='ready'&&ready.commit===sha)process.exit(0);
 }catch{}
 await new Promise(resolve=>setTimeout(resolve,1000));
}
console.error('Loopback health/readiness did not confirm the selected SHA, schema/storage and sandbox/Supabase mode.');
process.exit(1);
