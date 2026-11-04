import {mkdir,cp,writeFile,readFile,stat} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {pipeline} from 'node:stream/promises';
import {createManagedPool,closeManagedPool} from '../server/databasePool.ts';

if(process.env.APP_ENV!=='local'||process.env.AUTH_MODE!=='local'||!process.env.DATABASE_URL)throw new Error('Deze backup/restoreproef is uitsluitend voor de eigen lokale fictieve pilot.');
const databaseUrl=new URL(process.env.DATABASE_URL);
if(databaseUrl.hostname!=='127.0.0.1'||databaseUrl.port!=='55439'||databaseUrl.pathname!=='/castiq_local')throw new Error('Onbekende database; er wordt niets gewijzigd.');
const directory=`.local/backups/${new Date().toISOString().replaceAll(':','-')}`;
await mkdir(directory,{recursive:true,mode:0o700});
const filename=directory+'/database.dump';
const child=spawn('docker',['compose','-f','compose.local.yaml','exec','-T','database','pg_dump','-U','castiq_local','-d','castiq_local','-Fc'],{stdio:['ignore','pipe','inherit']});
const done=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Databasebackup mislukt')));});
await pipeline(child.stdout,createWriteStream(filename,{mode:0o600}));await done;
const uploadDir=process.env.UPLOAD_DIR||'.local/uploads';
try {await stat(uploadDir);await cp(uploadDir,directory+'/uploads',{recursive:true});} catch(error){if(error.code!=='ENOENT')throw error;}
const pool=createManagedPool({connectionString:databaseUrl.href});
const name='castiq_restore_'+randomBytes(8).toString('hex');
let counts;
try {
  const result=await pool.query('SELECT count(*)::integer AS clubs, sum(jsonb_array_length(state->\'content\'))::integer AS content FROM castiq.workspaces');
  await pool.query(`CREATE DATABASE ${name}`);
  // The controlled name contains only a fixed prefix and random hex; no user input reaches SQL or shell.
  execFileSync('docker',['compose','-f','compose.local.yaml','cp',filename,'database:/tmp/'+name+'.dump'],{stdio:'pipe'});
  execFileSync('docker',['compose','-f','compose.local.yaml','exec','-T','database','pg_restore','--exit-on-error','-U','castiq_local','-d',name,'/tmp/'+name+'.dump'],{stdio:'pipe'});
  const restoreUrl=new URL(databaseUrl);restoreUrl.pathname='/'+name;const restored=createManagedPool({connectionString:restoreUrl.href});
  try {counts=(await restored.query('SELECT count(*)::integer AS clubs, sum(jsonb_array_length(state->\'content\'))::integer AS content FROM castiq.workspaces')).rows[0];if(JSON.stringify(counts)!==JSON.stringify(result.rows[0]))throw new Error('Herstelde aantallen komen niet overeen met de bron.');}finally{await closeManagedPool(restored);}
} finally {
  await pool.query(`DROP DATABASE IF EXISTS ${name}`);await closeManagedPool(pool);
  try{execFileSync('docker',['compose','-f','compose.local.yaml','exec','-T','database','rm','-f','/tmp/'+name+'.dump'],{stdio:'pipe'});}catch{}
}
const manifest={createdAt:new Date().toISOString(),environment:'local-fictional',sourceRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),databaseSha256:createHash('sha256').update(await readFile(filename)).digest('hex'),restoreCheck:counts,notice:'Local fixture backup only. No encryption: use the separate approved encrypted backup path for staging.'};
await writeFile(directory+'/manifest.json',JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
console.log(`Lokale backup en herstel naar een aparte tijdelijke database geslaagd: ${directory}. De actieve database is behouden.`);
