import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createManagedPool,closeManagedPool,type PoolError} from '../server/databasePool.ts';
import {migrate} from '../database/migrate.ts';
import {seedFixtures,fixtureAccounts} from '../server/fixtures.ts';
import {mutate,persistHistory} from '../server/workflow.ts';

function launch(args:string[],environment:NodeJS.ProcessEnv,cwd:string){
 const child=spawn(process.execPath,args,{env:environment,cwd,stdio:['ignore','pipe','pipe']});let output='',errors='';
 child.stdout!.on('data',chunk=>{output+=chunk;});child.stderr!.on('data',chunk=>{errors+=chunk;});
 const exited=new Promise<{code:number|null;signal:NodeJS.Signals|null}>((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve({code,signal}));});
 return {child,exited,output:()=>output,errors:()=>errors};
}
async function stop(child:ChildProcess,exited:Promise<unknown>){
 if(child.exitCode!==null||child.signalCode!==null)return;
 child.kill('SIGTERM');let timer:NodeJS.Timeout;
 try{await Promise.race([exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Worker failed to stop gracefully')),10000);})]);}
 catch(error){child.kill('SIGKILL');await exited;throw error;}
 finally{clearTimeout(timer!);}
}

test('the real worker starts through a release symlink, processes its durable sandbox job and remains safe to import',{timeout:60000},async t=>{
 const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;assert.ok(connection,'Local TEST_DATABASE_URL or DATABASE_URL is required; this regression never silently skips.');
 const testUrl=new URL(connection);assert.ok(['127.0.0.1','localhost','[::1]'].includes(testUrl.hostname),'Only an isolated local test database may be used.');
 const database='castiq_worker_entry_'+randomUUID().replaceAll('-',''),idleErrors:PoolError[]=[];
 const admin=createManagedPool({connectionString:connection},error=>idleErrors.push(error));let created=false,pool:ReturnType<typeof createManagedPool>|undefined,runtime:ReturnType<typeof launch>|undefined;
 const temporary=await mkdtemp(join(tmpdir(),'castiq-worker-entry-'));
 t.after(async()=>{try{if(runtime)await stop(runtime.child,runtime.exited);}finally{if(pool)await closeManagedPool(pool);try{if(created)await admin.query(`DROP DATABASE ${database}`);}finally{await closeManagedPool(admin);await rm(temporary,{recursive:true,force:true});}}assert.deepEqual(idleErrors.map(error=>error.code),[],'Unexpected pool errors must fail this regression.');});
 const repository=fileURLToPath(new URL('../',import.meta.url)),current=join(temporary,'current');await symlink(repository,current,'dir');const entry=join(current,'server','worker.ts');
 const blocker=join(temporary,'no-network.mjs');await writeFile(blocker,"globalThis.fetch=async()=>{process.stderr.write('worker_entry_forbidden_fetch\\n');throw new Error('Network disabled in worker entry regression');};\n");
 // Deliberately exclude inherited credentials, NODE_OPTIONS and retention flags.
 const environment:NodeJS.ProcessEnv={PATH:process.env.PATH,APP_ENV:'local',AUTH_MODE:'local',HOST:'127.0.0.1',PORT:'4174',CASTIQ_APP_ORIGIN:'http://127.0.0.1:4173',CASTIQ_DATA_MODE:'server',PUBLICATION_MODE:'sandbox',PRIVACY_RETENTION_EXECUTE:'false',UPLOAD_DIR:join(temporary,'uploads')};
 const imported=launch(['--import',blocker,'--input-type=module','-e','await import(process.env.WORKER_IMPORT_URL)'],{...environment,WORKER_IMPORT_URL:pathToFileURL(entry).href},temporary);assert.deepEqual(await imported.exited,{code:0,signal:null});assert.equal(imported.output(),'');assert.equal(imported.errors(),'');
 await admin.query(`CREATE DATABASE ${database}`);created=true;testUrl.pathname='/'+database;pool=createManagedPool({connectionString:testUrl.href},error=>idleErrors.push(error));await migrate(pool);await seedFixtures(pool);
 const actor=fixtureAccounts.find(account=>account.id==='getijde-club')!,db=await pool.connect();let jobId='',requestId='';
 try{await db.query('BEGIN');let {state,version}=(await db.query("SELECT state,version FROM castiq.workspaces WHERE club_id='cl1' FOR UPDATE")).rows[0];for(const [type,data] of [['content.approve',{id:'cl1-c1',expectedRevision:1}],['publication.queue',{id:'cl1-c1',expectedRevision:1,channel:'Instagram-feed'}]] as const){const result=await mutate(db,state,actor,type,data);await persistHistory(db,actor,state,result.state,type,data,result.objectId,randomUUID());state=result.state;version=Number(version)+1;await db.query("UPDATE castiq.workspaces SET state=$1,version=$2 WHERE club_id='cl1'",[JSON.stringify(state),version]);}const job=state.content.find((item:any)=>item.id==='cl1-c1').jobs[0];jobId=job.id;requestId=job.requestId;await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 runtime=launch(['--import',blocker,entry],{...environment,DATABASE_URL:testUrl.href},temporary);
 const deadline=Date.now()+30000;let job:any,retention:any;
 while(Date.now()<deadline){if(runtime.child.exitCode!==null||runtime.child.signalCode!==null)assert.fail(`Worker exited before processing the symlink entry: ${runtime.output()} ${runtime.errors()}`);job=(await pool.query('SELECT status,state FROM castiq.jobs WHERE id=$1',[jobId])).rows[0];retention=runtime.output().split('\n').filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).find(value=>value?.component==='privacy-retention');if(job.status==='awaiting_confirmation'&&retention)break;await delay(50);}
 assert.equal(job?.status,'awaiting_confirmation','The entry must actually execute the durable worker loop.');assert.equal(job.state.requestId,requestId);assert.equal(job.state.receipt,undefined);assert.equal(retention?.dryRun,true);assert.equal(retention?.destructionEnabled,false);assert.equal(runtime.child.exitCode,null,'The worker must remain active after its first tick.');assert.equal(runtime.errors(),'');
 await stop(runtime.child,runtime.exited);assert.deepEqual(await runtime.exited,{code:0,signal:null});assert.equal(runtime.errors(),'');
});
