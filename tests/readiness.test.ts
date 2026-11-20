import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
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
