import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {LEGAL_DOCUMENTS} from '../shared/legalDocuments.ts';
import {createPrivacyService} from './privacy.ts';
import {createFileDeletionLedger} from './privacyLedger.ts';
import {createPrivacyOperations} from './privacyOperations.ts';
import {createAccountOperations} from './accountOperations.ts';
import {enqueueMail,erasePersonalMail,processMailOutbox} from './mail.ts';
import {validateRuntimeConfiguration} from '../scripts/configuration.mjs';
import pg from 'pg';
import {createManagedPool,closeManagedPool} from './databasePool.ts';
import {normalizeContent,processPublication,contentPrivacyErrors} from '../src/v1Workflow.ts';
import {persistHistory} from './workflow.ts';
import {SandboxAdapter} from './sandboxAdapter.ts';
import type {Actor} from './fixtures.ts';
export type SandboxTickOptions={now?:string;leaseMs?:number;afterClaim?:(claim:any)=>Promise<void>;adapter?:SandboxAdapter};
const workerActor=(clubId:string):Actor=>({id:'sandbox-worker',name:'Expliciete sandboxworker',clubId,role:'club'});
/** Claim is durable before adapter work. An expired lease only reconciles the same request. */
export async function runSandboxTick(pool:pg.Pool,options:SandboxTickOptions={}){
 const at=options.now||new Date().toISOString(),leaseMs=options.leaseMs||30000,owner=randomUUID(),correlationId=randomUUID();const db=await pool.connect();let claim:any=null;
 try{
  await db.query('BEGIN');
  const row=await db.query("SELECT w.club_id,w.version,w.state FROM castiq.workspaces w WHERE (w.state#>>'{v1,publicationPaused}') IS DISTINCT FROM 'true' AND EXISTS(SELECT 1 FROM castiq.jobs j WHERE j.club_id=w.club_id AND ((j.status IN ('queued','scheduled') AND (j.scheduled_at IS NULL OR j.scheduled_at<=$1)) OR (j.status='processing' AND j.lease_until<=$1))) ORDER BY w.club_id FOR UPDATE OF w SKIP LOCKED LIMIT 1",[at]);
  if(!row.rowCount){await db.query('COMMIT');return {claimed:false};}
  const {club_id:clubId,state:before,version}=row.rows[0];await db.query("SELECT set_config('castiq.club_id',$1,true)",[clubId]);const state=structuredClone(before);
  for(const item of state.content){const job=item.jobs?.find((job:any)=>(['queued','scheduled'].includes(job.status)&&(!job.scheduledAt||Date.parse(job.scheduledAt)<=Date.parse(at)))||(job.status==='processing'&&job.leaseUntil&&Date.parse(job.leaseUntil)<=Date.parse(at)));if(!job)continue;
   const approval=await db.query("SELECT 1 FROM castiq.approvals WHERE club_id=$1 AND content_id=$2 AND revision=$3 AND content_hash=$4 AND decision='approved'",[clubId,item.id,job.version,job.contentHash]);
   if(item.approvedVersion!==item.version||item.version!==job.version||contentPrivacyErrors(item).length||!approval.rowCount){job.status='cancelled';job.cancelledAt=at;job.error='De actuele revisie, goedkeuring of publicatievoorkeur is niet meer geldig.';job.leaseUntil=null;state.content=state.content.map((i:any)=>i.id===item.id?normalizeContent(item):i);await persistHistory(db,workerActor(clubId),before,state,'worker.cancelled',{id:item.id},job.id,correlationId);await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,clubId]);await db.query('COMMIT');return {claimed:true,cancelled:true,jobId:job.id};}
   const reconcile=job.status==='processing'||job.reconciling===true||!!job.dispatchStartedAt;job.status='processing';job.leaseOwner=owner;job.leaseUntil=new Date(Date.parse(at)+leaseMs).toISOString();job.dispatchStartedAt=job.dispatchStartedAt||at;job.updatedAt=at;job.reconciling=reconcile;
   state.content=state.content.map((i:any)=>i.id===item.id?normalizeContent(item):i);await persistHistory(db,workerActor(clubId),before,state,reconcile?'worker.reconcile_claimed':'worker.claimed',{id:item.id},job.id,correlationId);await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,clubId]);claim={clubId,contentId:item.id,job:structuredClone(job),reconcile};break;
  }
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 if(!claim)return {claimed:false};if(options.afterClaim)await options.afterClaim(claim);
 const adapter=options.adapter||new SandboxAdapter();
 const finish=await pool.connect();try{
  await finish.query('BEGIN');await finish.query("SELECT set_config('castiq.club_id',$1,true)",[claim.clubId]);const rows=await finish.query('SELECT state,version FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[claim.clubId]);const {state:before,version}=rows.rows[0];const state=structuredClone(before);const item=state.content.find((i:any)=>i.id===claim.contentId),job=item?.jobs?.find((j:any)=>j.id===claim.job.id);
  if(!job||job.status!=='processing'||job.leaseOwner!==owner){await finish.query('COMMIT');return {claimed:true,interrupted:true,jobId:claim.job.id};}
  // Recheck under the same workspace lock held until adapter dispatch and persistence complete.
  // A club mutation committed after claim is authoritative before any provider-side attempt begins.
  const approval=await finish.query("SELECT 1 FROM castiq.approvals WHERE club_id=$1 AND content_id=$2 AND revision=$3 AND content_hash=$4 AND decision='approved'",[claim.clubId,item.id,job.version,job.contentHash]);
  if(state.v1.publicationPaused){job.status='queued';job.leaseUntil=null;job.leaseOwner=null;if(!claim.reconcile)delete job.dispatchStartedAt;state.content=state.content.map((i:any)=>i.id===item.id?normalizeContent(item):i);await persistHistory(finish,workerActor(claim.clubId),before,state,'worker.paused',{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,paused:true,jobId:job.id};}
  if(item.version!==job.version||item.approvedVersion!==item.version||contentPrivacyErrors(item).length||!approval.rowCount){job.status='cancelled';job.error='De revisie of publicatievoorkeur is vóór verzending gewijzigd.';job.leaseUntil=null;job.leaseOwner=null;state.content=state.content.map((i:any)=>i.id===item.id?normalizeContent(item):i);await persistHistory(finish,workerActor(claim.clubId),before,state,'worker.cancelled',{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,cancelled:true,jobId:job.id};}
  let outcome='timeout',safeError='';try{const prepared=await adapter.prepare(job);if(claim.reconcile)await adapter.reconcile(prepared.requestId);else await adapter.publish(prepared);}catch{outcome='failed';safeError='De sandboxaanvraag kon niet worden gecontroleerd. Controleer de opdracht en probeer opnieuw.';}
  let next=processPublication(item,job.id,outcome as 'timeout'|'failed',{now:at});next.jobs=next.jobs.map((j:any)=>j.id===job.id?{...j,leaseUntil:null,leaseOwner:null,...(safeError?{error:safeError}:{})}:j);state.content=state.content.map((i:any)=>i.id===item.id?next:i);
  await persistHistory(finish,workerActor(claim.clubId),before,state,claim.reconcile?'worker.reconciled':'worker.awaiting_confirmation',{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,jobId:job.id,reconciled:claim.reconcile,status:next.jobs.find((j:any)=>j.id===job.id).status};
 }catch(error){await finish.query('ROLLBACK');throw error;}finally{finish.release();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const {configuration,errors}=validateRuntimeConfiguration(process.env);if(errors.length)throw new Error(errors.join('\n'));
 const pool=createManagedPool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000});let stopped=false,nextPrivacy=0;
 const mailOptions={origin:configuration.CASTIQ_APP_ORIGIN,environment:process.env.APP_ENV||'local',encryptionKey:process.env.MAIL_ENCRYPTION_KEY};
 const accountOperations=createAccountOperations({supabaseUrl:configuration.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_ACCOUNT_OPERATIONS_KEY});
 const privacy=createPrivacyService({pool,documents:LEGAL_DOCUMENTS,referenceKey:process.env.PRIVACY_LEDGER_HMAC_KEY,ledger:process.env.PRIVACY_LEDGER_DIR?createFileDeletionLedger(process.env.PRIVACY_LEDGER_DIR,{environmentId:process.env.APP_ENV!=='local'?'castiq-vps08-'+process.env.APP_ENV:undefined}):undefined,enqueueMail:(db,mail)=>enqueueMail(db,mail,mailOptions),erasePersonalMail,...accountOperations,deletePrivateMedia:async objectKey=>{if(!/^[a-f0-9]{64}\.webp$/.test(objectKey))throw new Error('invalid_media_reference');await unlink(resolve(process.env.UPLOAD_DIR!,objectKey)).catch(error=>{if(error.code!=='ENOENT')throw error;});}});
 const operations=createPrivacyOperations(pool);
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{stopped=true;});
 console.log(JSON.stringify({component:'castiq-worker',publicationMode:'sandbox-only',retentionExecute:process.env.PRIVACY_RETENTION_EXECUTE==='true'}));
 try{while(!stopped){try{
  await runSandboxTick(pool);await processMailOutbox(pool,mailOptions);
  if(Date.now()>=nextPrivacy){await privacy.syncCaseExtensions();const dryRun=process.env.PRIVACY_RETENTION_EXECUTE!=='true';const result=await privacy.retentionTick({dryRun});console.log(JSON.stringify({component:'privacy-retention',...result}));if(!dryRun&&result.destructionEnabled)await operations.purge({dryRun:false});nextPrivacy=Date.now()+60_000;}
 }catch(error){console.error(JSON.stringify({component:'castiq-worker',code:typeof error?.code==='string'&&/^[a-zA-Z0-9_]{1,60}$/.test(error.code)?error.code:'background_step_failed'}));}if(!stopped)await new Promise(resolve=>setTimeout(resolve,1000));}}finally{await closeManagedPool(pool);}
}
