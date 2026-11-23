import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EventEmitter} from 'node:events';
import {createReadiness} from '../server/readiness.ts';

test('readiness requires matching applied migrations, upload access and a built frontend',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'castiq-ready-'));
 try{
  const uploads=join(directory,'uploads'),dist=join(directory,'dist');await mkdir(uploads);await mkdir(dist);await writeFile(join(dist,'index.html'),'fixture');
  const base=new URL('../database/migrations/',import.meta.url);
  const rows=await Promise.all((await readdir(base)).filter(name=>/^\d+.*\.sql$/.test(name)).map(async name=>({name,sha256:createHash('sha256').update(await readFile(new URL(name,base))).digest('hex')})));
  const pool={query:async()=>({rows})} as any;
  assert.equal(await createReadiness(pool,uploads,dist)(),true);
  assert.equal(await createReadiness({query:async()=>({rows:rows.slice(1)})} as any,uploads,dist)(),false);
  assert.equal(await createReadiness({query:async()=>({rows:rows.map(row=>({...row,sha256:'incorrect'}))})} as any,uploads,dist)(),false);
  assert.equal(await createReadiness(pool,join(directory,'missing'),dist)(),false);
  assert.equal(await createReadiness(pool,uploads,join(directory,'missing'))(),false);
  assert.equal(await createReadiness({query:async()=>{throw new Error('database secret must not escape');}} as any,uploads,dist)(),false);
 }finally{await rm(directory,{recursive:true});}
});

test('trusted release healthcheck requires the HTTP status and exact configured publication mode',async()=>{
 const source=(await readFile(new URL('../deploy/dg-vps-08/healthcheck.mjs',import.meta.url),'utf8')).replace("import http from 'node:http';",'').replaceAll('process.exit(', 'return (');
 const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,check=new AsyncFunction('http','process','setTimeout','console',source);
 const sha='a'.repeat(40);
 async function verify(status:number,reportedMode:string,expectedMode='provider'){
  const http={get:(_options:any,receive:(response:any)=>void)=>{const request=new EventEmitter() as any;request.destroy=(error:Error)=>request.emit('error',error);queueMicrotask(()=>{const response=new EventEmitter() as any;response.statusCode=status;receive(response);response.emit('data',JSON.stringify(_options.path==='/api/health'?{code:200,status:'ok',commit:sha,authMode:'supabase',publicationMode:reportedMode}:{code:200,status:'ready',commit:sha}));response.emit('end');});return request;}};
  return check(http,{argv:['node','healthcheck.mjs',sha,'4184',expectedMode]},(callback:()=>void)=>callback(),{error:()=>{}});
 }
 assert.equal(await verify(200,'provider-per-club'),0);
 assert.equal(await verify(503,'provider-per-club'),1,'a body field cannot replace the actual HTTP status');
 assert.equal(await verify(200,'sandbox-only'),1,'provider activation cannot accept sandbox health');
 assert.equal(await verify(200,'sandbox-only','sandbox'),0);
});
