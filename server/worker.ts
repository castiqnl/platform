import {assertSocialDestination,expireSocialFlows,resolveSocialOptions,decryptChannelSecret,runSocialRefreshTick,socialOptionsFromEnvironment,type SocialOptions,type Provider} from './socialConnections.ts';
import {publishSocialImage,type DispatchState} from './socialPublisher.ts';
import {publicationMediaUrl,renderPublicationMedia,type PublicationMediaOptions} from './publicationMedia.ts';
import {resolveClubProvider} from './clubIntegrations.ts';
import {verifyPublicationPayload} from './publicationIntegrity.ts';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {realpathSync} from 'node:fs';
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
  const row=await db.query("SELECT w.club_id,w.version,w.state FROM castiq.workspaces w WHERE (w.state#>>'{v1,publicationPaused}') IS DISTINCT FROM 'true' AND EXISTS(SELECT 1 FROM castiq.jobs j WHERE j.club_id=w.club_id AND j.provider_mode='demo' AND ((j.status IN ('queued','scheduled') AND (j.scheduled_at IS NULL OR j.scheduled_at<=$1)) OR (j.status='processing' AND j.lease_until<=$1))) ORDER BY w.club_id FOR UPDATE OF w SKIP LOCKED LIMIT 1",[at]);
  if(!row.rowCount){await db.query('COMMIT');return {claimed:false};}
  const {club_id:clubId,state:before,version}=row.rows[0];await db.query("SELECT set_config('castiq.club_id',$1,true)",[clubId]);const state=structuredClone(before);
  for(const item of state.content){const job=item.jobs?.find((job:any)=>job.adapter!=='official-provider'&&((['queued','scheduled'].includes(job.status)&&(!job.scheduledAt||Date.parse(job.scheduledAt)<=Date.parse(at)))||(job.status==='processing'&&job.leaseUntil&&Date.parse(job.leaseUntil)<=Date.parse(at))));if(!job)continue;
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
  let destinationAvailable=true;try{await assertSocialDestination(finish,claim.clubId,job.channel);}catch(error){if((error as any).code!=='channel_unavailable')throw error;destinationAvailable=false;}
  if(!destinationAvailable&&claim.reconcile){let uncertain=processPublication(item,job.id,'timeout',{now:at});uncertain.jobs=uncertain.jobs.map((entry:any)=>entry.id===job.id?{...entry,leaseUntil:null,leaseOwner:null,error:'De bestemming is niet beschikbaar. Eerdere verzending is niet bevestigd; controleer dezelfde opdracht.'}:entry);state.content=state.content.map((entry:any)=>entry.id===item.id?uncertain:entry);await persistHistory(finish,workerActor(claim.clubId),before,state,'worker.awaiting_confirmation',{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,jobId:job.id,status:'awaiting_confirmation',reconciled:false};}
  if(!destinationAvailable||item.version!==job.version||item.approvedVersion!==item.version||contentPrivacyErrors(item).length||!approval.rowCount){job.status='cancelled';job.error='De revisie of publicatievoorkeur is vóór verzending gewijzigd.';job.leaseUntil=null;job.leaseOwner=null;state.content=state.content.map((i:any)=>i.id===item.id?normalizeContent(item):i);await persistHistory(finish,workerActor(claim.clubId),before,state,'worker.cancelled',{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,cancelled:true,jobId:job.id};}
  let outcome='timeout',safeError='';try{const prepared=await adapter.prepare(job);if(claim.reconcile)await adapter.reconcile(prepared.requestId);else await adapter.publish(prepared);}catch{outcome='failed';safeError='De sandboxaanvraag kon niet worden gecontroleerd. Controleer de opdracht en probeer opnieuw.';}
  let next=processPublication(item,job.id,outcome as 'timeout'|'failed',{now:at});next.jobs=next.jobs.map((j:any)=>j.id===job.id?{...j,leaseUntil:null,leaseOwner:null,...(safeError?{error:safeError}:{})}:j);state.content=state.content.map((i:any)=>i.id===item.id?next:i);
  await persistHistory(finish,workerActor(claim.clubId),before,state,claim.reconcile?'worker.reconciled':'worker.awaiting_confirmation',{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,jobId:job.id,reconciled:claim.reconcile,status:next.jobs.find((j:any)=>j.id===job.id).status};
 }catch(error){await finish.query('ROLLBACK');throw error;}finally{finish.release();}
}
export type ProviderTickOptions={social:SocialOptions;media:PublicationMediaOptions;now?:string;leaseMs?:number;afterClaim?:(claim:any)=>Promise<void>};
/** Independent provider path: legacy sandbox requests never become real posts.
 * A separate committed dispatch journal survives a crash or rollback of the
 * workspace transaction while the same workspace lock blocks edit/revoke races. */
export async function runProviderTick(pool:pg.Pool,options:ProviderTickOptions){
 if(options.social.publicationMode!=='provider')return {claimed:false,disabled:true};
 const at=options.now||new Date().toISOString(),owner=randomUUID(),correlationId=randomUUID(),db=await pool.connect();let claim:any;
 try{
  await db.query('BEGIN');
  const result=await db.query("SELECT w.club_id,w.version,w.state,j.id AS job_id FROM castiq.workspaces w JOIN castiq.jobs j ON j.club_id=w.club_id LEFT JOIN castiq.publication_dispatches d ON d.job_id=j.id AND d.club_id=j.club_id WHERE j.provider_mode='provider' AND ((j.status IN ('queued','scheduled') AND (j.scheduled_at IS NULL OR j.scheduled_at<=$1)) OR (j.status='processing' AND j.lease_until<=$1) OR (j.status='awaiting_confirmation' AND d.job_id IS NOT NULL AND COALESCE((j.state->>'nextReconcileAt')::timestamptz,'1970-01-01'::timestamptz)<=$1) OR (d.state->>'phase'='confirmed' AND j.status<>'published')) AND ((w.state#>>'{v1,publicationPaused}') IS DISTINCT FROM 'true' OR d.state->>'phase'='confirmed') ORDER BY CASE WHEN d.state->>'phase'='confirmed' THEN 0 ELSE 1 END,w.club_id FOR UPDATE OF w SKIP LOCKED LIMIT 1",[at]);
  if(!result.rowCount){await db.query('COMMIT');return {claimed:false};}
  const {club_id:clubId,state:before,version}=result.rows[0],state=structuredClone(before);
  for(const item of state.content||[]){const job=item.jobs?.find((job:any)=>job.id===result.rows[0].job_id&&job.providerMode==='provider'&&job.adapter==='official-provider');if(!job)continue;
   job.status='processing';job.leaseOwner=owner;job.leaseUntil=new Date(Date.parse(at)+(options.leaseMs||120000)).toISOString();job.updatedAt=at;job.dispatchStartedAt=job.dispatchStartedAt||at;
   await persistHistory(db,{...workerActor(clubId),id:'provider-worker',name:'Kanaalworker'},before,state,'provider.claimed',{id:item.id},job.id,correlationId);await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,clubId]);claim={clubId,contentId:item.id,job:structuredClone(job)};break;
  }
  await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 if(!claim)return {claimed:false};if(options.afterClaim)await options.afterClaim(claim);
 const provider=(claim.job.channel.toLowerCase().startsWith('instagram')?'instagram':claim.job.channel.toLowerCase().startsWith('facebook')?'facebook':'x') as Provider;
 // Resolve tenant secrets before taking another pooled connection, including
 // pools with only one available query slot. Nothing secret enters job state.
 let social:SocialOptions|undefined;try{social=await resolveSocialOptions(options.social,claim.clubId,provider);}catch{/* Recorded as unavailable below without logging configuration material. */}
 const finish=await pool.connect();
 try{
  await finish.query('BEGIN');const row=(await finish.query('SELECT state,version FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[claim.clubId])).rows[0];
  const before=row.state,state=structuredClone(before),item=state.content?.find((item:any)=>item.id===claim.contentId),job=item?.jobs?.find((job:any)=>job.id===claim.job.id);
  if(!job||job.status!=='processing'||job.leaseOwner!==owner){await finish.query('COMMIT');return {claimed:true,interrupted:true};}
  let journal=(await finish.query('SELECT * FROM castiq.publication_dispatches WHERE job_id=$1 AND club_id=$2',[job.id,claim.clubId])).rows[0];
  const uncertain=journal?.state?.phase==='publishing'||journal?.state?.phase==='confirmed';
  const approval=(await finish.query("SELECT 1 FROM castiq.approvals WHERE club_id=$1 AND content_id=$2 AND revision=$3 AND content_hash=$4 AND decision='approved'",[claim.clubId,item.id,job.version,job.contentHash])).rowCount;
  const current=(await finish.query('SELECT * FROM castiq.social_connections WHERE club_id=$1 AND provider=$2 FOR UPDATE',[claim.clubId,provider])).rows[0];
  let tokens:any;try{if(social&&current?.encrypted_tokens)tokens=decryptChannelSecret(current.encrypted_tokens,social,claim.clubId+':'+provider);}catch{/* Fail closed. */}
  const valid=!!(social?.publicationEnabled===true&&current?.status==='connected'&&current.account_id===job.providerAccountId&&tokens?.authorizationId===job.providerAuthorizationId&&current.destinations.includes(job.channel)&&(!current.expires_at||Date.parse(current.expires_at)>Date.parse(at)));
  let result:any;
  if(journal?.state?.phase==='confirmed'&&journal.state.providerPostId){job.status='published';job.providerDispatch={...journal.state};const receipt={kind:'provider',provider,providerPostId:journal.state.providerPostId,providerObjectType:journal.state.providerObjectType||'post',url:journal.state.url||'',confirmedAt:at,requestId:job.requestId,version:job.version,sponsorAgreementId:job.sponsorAgreementId,sponsorName:job.sponsorName,sponsorLogo:job.sponsorLogo};job.receipt=receipt;job.receipts=[...(job.receipts||[]).filter((entry:any)=>entry.requestId!==job.requestId),receipt];delete job.error;}else if(!valid||!verifyPublicationPayload(job)||journal?.state?.phase!=='publishing'&&(state.v1?.publicationPaused||item.version!==job.version||item.approvedVersion!==job.version||!approval||contentPrivacyErrors(item).length||state.rules?.[`${item.team}|${item.type}|${job.channel}`]==='off')){
   if(uncertain){job.status='awaiting_confirmation';job.error='Eerdere verzending is nog niet bevestigd. De gewijzigde koppeling of inhoud verhindert een nieuwe verzending.';}
   else if(state.v1?.publicationPaused){job.status='queued';job.error='Publicatie is gepauzeerd.';}
   else {job.status='cancelled';job.error='De goedgekeurde revisie of clubkoppeling is gewijzigd. Controleer en maak een nieuwe opdracht.';}
  }else{
   if(!journal){
    await pool.query('INSERT INTO castiq.publication_dispatches(job_id,club_id,provider,account_id,connection_version,content_hash,state) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(job_id) DO NOTHING',[job.id,claim.clubId,provider,current.account_id,current.version,job.contentHash,JSON.stringify({})]);
    journal={state:{}};
   }
   const checkpoint=async(dispatch:DispatchState)=>{await pool.query('UPDATE castiq.publication_dispatches SET state=$1,updated_at=now() WHERE job_id=$2 AND club_id=$3 AND account_id=$4 AND content_hash=$5',[JSON.stringify(dispatch),job.id,claim.clubId,current.account_id,job.contentHash]);journal.state={...dispatch};};
   try{
    const mediaUrl=publicationMediaUrl(claim.clubId,job,options.media),mediaBytes=provider==='x'?await renderPublicationMedia(finish,claim.clubId,job,options.media):undefined;
    result=await publishSocialImage({provider,accountId:current.account_id,accessToken:tokens.accessToken,job,mediaUrl,mediaBytes,state:journal.state,checkpoint,options:social!});
    job.status=result.status;job.providerDispatch={...result.state};
    if(result.status==='published'){
     const receipt={kind:'provider',provider,providerPostId:result.providerPostId,providerObjectType:result.providerObjectType||'post',url:result.url||'',confirmedAt:at,requestId:job.requestId,version:job.version,sponsorAgreementId:job.sponsorAgreementId,sponsorName:job.sponsorName,sponsorLogo:job.sponsorLogo};job.receipt=receipt;job.receipts=[...(job.receipts||[]),receipt];delete job.error;
    }else job.error=result.status==='failed'?'De provider heeft de opdracht geweigerd. Controleer de koppeling en probeer dezelfde opdracht opnieuw.':'De provider heeft de verzending nog niet bevestigd. Controleer dezelfde opdracht; er wordt niet opnieuw geplaatst.';
   }catch{job.status=journal.state?.phase==='publishing'?'awaiting_confirmation':'failed';job.error='De kanaalaanvraag kon niet worden afgerond. Controleer deze opdracht en de koppeling.';}
  }
  job.leaseUntil=null;job.leaseOwner=null;job.updatedAt=at;if(job.status==='awaiting_confirmation'){job.reconcileAttempts=(job.reconcileAttempts||0)+1;job.nextReconcileAt=new Date(Date.parse(at)+Math.min(15*60000,30000*2**Math.min(job.reconcileAttempts,5))).toISOString();}else delete job.nextReconcileAt;state.content=state.content.map((entry:any)=>entry.id===item.id?normalizeContent(item):entry);
  await persistHistory(finish,{...workerActor(claim.clubId),id:'provider-worker',name:'Kanaalworker'},before,state,'provider.'+job.status,{id:item.id},job.id,correlationId);await finish.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(row.version)+1,claim.clubId]);await finish.query('COMMIT');return {claimed:true,jobId:job.id,status:job.status};
 }catch(error){await finish.query('ROLLBACK');throw error;}finally{finish.release();}
}
// Deployments execute through current -> releases/<sha>; Node resolves import.meta.url to the real file.
function isWorkerEntrypoint(){
 if(!process.argv[1])return false;
 try{return realpathSync(process.argv[1])===realpathSync(fileURLToPath(import.meta.url));}catch{return false;}
}
if(isWorkerEntrypoint()){
 const {configuration,errors}=validateRuntimeConfiguration(process.env);if(errors.length)throw new Error(errors.join('\n'));
 const pool=createManagedPool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:5000});let stopped=false,nextPrivacy=0;
 const social=socialOptionsFromEnvironment(process.env,configuration.CASTIQ_APP_ORIGIN);social.resolveProvider=(clubId,provider)=>resolveClubProvider(pool,clubId,provider,social);
 const media:PublicationMediaOptions={origin:configuration.CASTIQ_APP_ORIGIN,environment:process.env.APP_ENV||'local',key:process.env.PUBLICATION_MEDIA_SIGNING_KEY,uploadDir:process.env.UPLOAD_DIR||'.local/uploads',staticDir:process.env.STATIC_DIR||'dist'};
 const mailOptions={origin:configuration.CASTIQ_APP_ORIGIN,environment:process.env.APP_ENV||'local',encryptionKey:process.env.MAIL_ENCRYPTION_KEY};
 const accountOperations=createAccountOperations({supabaseUrl:configuration.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_ACCOUNT_OPERATIONS_KEY});
 const privacy=createPrivacyService({pool,documents:LEGAL_DOCUMENTS,referenceKey:process.env.PRIVACY_LEDGER_HMAC_KEY,ledger:process.env.PRIVACY_LEDGER_DIR?createFileDeletionLedger(process.env.PRIVACY_LEDGER_DIR,{environmentId:process.env.APP_ENV!=='local'?'castiq-vps08-'+process.env.APP_ENV:undefined}):undefined,enqueueMail:(db,mail)=>enqueueMail(db,mail,mailOptions),erasePersonalMail,...accountOperations,deletePrivateMedia:async objectKey=>{if(!/^[a-f0-9]{64}\.webp$/.test(objectKey))throw new Error('invalid_media_reference');await unlink(resolve(process.env.UPLOAD_DIR!,objectKey)).catch(error=>{if(error.code!=='ENOENT')throw error;});}});
 const operations=createPrivacyOperations(pool);
 for(const signal of ['SIGINT','SIGTERM'] as const)process.on(signal,()=>{stopped=true;});
 console.log(JSON.stringify({component:'castiq-worker',publicationMode:social.publicationMode==='provider'?'provider':'sandbox-only',retentionExecute:process.env.PRIVACY_RETENTION_EXECUTE==='true'}));
 try{while(!stopped){try{
  await expireSocialFlows(pool,{});await runSocialRefreshTick(pool,social);await runSandboxTick(pool);if(social.publicationMode==='provider')await runProviderTick(pool,{social,media});await processMailOutbox(pool,mailOptions);
  if(Date.now()>=nextPrivacy){await privacy.syncCaseExtensions();const dryRun=process.env.PRIVACY_RETENTION_EXECUTE!=='true';const result=await privacy.retentionTick({dryRun});console.log(JSON.stringify({component:'privacy-retention',...result}));if(!dryRun&&result.destructionEnabled)await operations.purge({dryRun:false});nextPrivacy=Date.now()+60_000;}
 }catch(error){console.error(JSON.stringify({component:'castiq-worker',code:typeof error?.code==='string'&&/^[a-zA-Z0-9_]{1,60}$/.test(error.code)?error.code:'background_step_failed'}));}if(!stopped)await new Promise(resolve=>setTimeout(resolve,1000));}}finally{await closeManagedPool(pool);}
}
