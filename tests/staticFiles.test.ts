import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,mkdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {withStaticFiles} from '../server/staticFiles.ts';

test('production frontend serves SPA/assets and preserves API authorization boundary',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'castiq-static-')),dist=join(temp,'dist');await mkdir(dist);await mkdir(join(dist,'assets'));
 await writeFile(join(dist,'index.html'),'<html>CASTIQ</html>');await writeFile(join(dist,'assets','app.js'),'export const app=1;');await writeFile(join(temp,'secret.env'),'private');await symlink(join(temp,'secret.env'),join(dist,'assets','escape.txt'));
 const server=createServer(withStaticFiles(dist,async(_req,res)=>{res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"auth required"}');}));
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as any).port,url=`http://127.0.0.1:${port}`;
 try{
  const page=await fetch(url+'/club/dashboard');assert.equal(page.status,200);assert.match(await page.text(),/CASTIQ/);assert.equal(page.headers.get('cache-control'),'no-store');
  const asset=await fetch(url+'/assets/app.js');assert.match(asset.headers.get('content-type')||'',/javascript/);
  assert.equal((await fetch(url+'/api/media/private')).status,401);
  for(const path of ['/assets/missing.js','/.env','/assets/escape.txt','/%2eenv','/assets/%2e%2e%2f%2eenv','/assets/%5csecret','/%00'])assert.equal((await fetch(url+path)).status,404,path);
  assert.equal((await fetch(url+'/',{method:'POST'})).status,405);
  const head=await fetch(url+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 }finally{await new Promise<void>(r=>server.close(()=>r()));await rm(temp,{recursive:true});}
});
