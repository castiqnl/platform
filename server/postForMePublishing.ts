import {createHash,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import type pg from 'pg';
import {PostForMeClient,PostForMeError,type PFMPost} from './postForMeClient.ts';
import {readPostForMeConfiguration,assertPostForMeDestination,reconcilePostForMeAccount,postForMeExternalId,type PostForMeOptions} from './postForMe.ts';
import {publicationMediaUrl,renderPublicationMedia,type PublicationMediaOptions} from './publicationMedia.ts';
import {verifyPublicationPayload} from './publicationIntegrity.ts';
import {normalizeContent,contentPrivacyErrors} from '../src/v1Workflow.ts';
import {persistHistory} from './workflow.ts';

export type PostForMeDispatchState={
 adapter?:'post-for-me';projectId?:string;phase?:'publishing'|'accepted'|'confirmed'|'rejected'|'cancelled';attempt?:number;reference?:string;postId?:string;
 providerPostId?:string;url?:string;errorCode?:string;startedAt?:string;
 history?:{attempt:number;reference:string;postId?:string;phase:string;providerPostId?:string;url?:string}[];
};
export type PostForMePublishResult={status:'published'|'awaiting_confirmation'|'failed'|'cancelled';state:PostForMeDispatchState;providerPostId?:string;url?:string;errorCode?:string};
export type PostForMePublishInput={client:Pick<PostForMeClient,'createPost'|'listPosts'|'getPost'|'getPostResults'|'deletePost'|'getAccount'>;environment:string;clubId:string;job:any;accountId:string;expectedProviderAccountId:string;recheckAuthorization:()=>Promise<boolean>;mediaUrl?:string;state:PostForMeDispatchState;checkpoint:(state:PostForMeDispatchState)=>Promise<void>;maySend:boolean;cancelPending?:boolean;now?:string};
const providers=['facebook','instagram'] as const;
function providerFor(job:any){return providers.find(provider=>String(job?.channel||'').toLowerCase().startsWith(provider));}
const id=(value:unknown):value is string=>typeof value==='string'&&/^[a-zA-Z0-9_:-]{1,240}$/.test(value);
const safePostUrl=(value:unknown,provider:string)=>{if(typeof value!=='string'||value.length>2000)return '';try{const url=new URL(value),host=url.hostname.toLowerCase(),root=provider==='instagram'?'instagram.com':'facebook.com';return url.protocol==='https:'&&!url.username&&!url.password&&(host===root||host.endsWith('.'+root))?url.href:'';}catch{return '';}};
export function postForMeReference(environment:string,clubId:string,job:any){return 'castiq-'+createHash('sha256').update([environment,clubId,job.id,job.requestId,Number(job.attempt)||1].join('\n')).digest('hex');}
function accountIds(post:PFMPost){return (post.social_accounts||[]).map((account:any)=>typeof account==='string'?account:account?.id);}
function matchesPost(post:PFMPost,reference:string,accountId:string){const accounts=accountIds(post);return id(post.id)&&post.external_id===reference&&accounts.length===1&&accounts[0]===accountId;}
function safeFailure(code?:string){code=({post_for_me_unauthorized:'unauthorized',post_for_me_rate_limited:'rate_limited',post_for_me_rejected:'provider_rejected',provider_media_invalid:'media_invalid',channel_revoked:'account_disconnected',provider_rate_limited:'rate_limited'} as Record<string,string>)[code||'']||code;return ['unauthorized','forbidden','rate_limited','provider_rejected','account_disconnected','invalid_request','media_invalid'].includes(code||'')?code!:'provider_rejected';}
export function postForMeFailureMessage(code?:string){return ({unauthorized:'De Post for Me-verbinding moet door de platformbeheerder worden gecontroleerd.',forbidden:'Post for Me heeft geen toestemming voor dit kanaal. Koppel het clubaccount opnieuw.',rate_limited:'Het kanaal of Post for Me heeft tijdelijk een verzendlimiet bereikt.',account_disconnected:'Het clubaccount is niet meer verbonden. Koppel het opnieuw.',account_not_owned:'Het sociale account hoort niet meer aantoonbaar bij deze vereniging. Controleer en koppel het account opnieuw.',account_verification_failed:'Het clubaccount kon niet opnieuw worden gecontroleerd. Er is geen nieuwe verzending gestart. Controleer de verbinding en probeer opnieuw.',authorization_changed:'De clubkoppeling of publicatierechten zijn gewijzigd. Controleer de koppeling en maak een nieuwe opdracht.',media_invalid:'Het publicatiebeeld voldoet niet aan de eisen van dit kanaal.',reference_conflict:'De aanvraag kon niet eenduidig worden gecontroleerd. Er wordt niet opnieuw geplaatst.',provider_rejected:'Het kanaal heeft deze publicatie geweigerd. Controleer de koppeling en probeer alleen dit kanaal opnieuw.'} as Record<string,string>)[code||'']||'De provider heeft de verzending nog niet bevestigd. Castiq controleert dezelfde aanvraag en plaatst deze niet nogmaals.';}
/** One Post for Me post has exactly one destination. The journal is committed
 * before POST. A lost response is reconciled by external_id and never resent. */
export async function publishPostForMeImage(input:PostForMePublishInput):Promise<PostForMePublishResult>{
 const provider=providerFor(input.job);if(!provider||!['staging','local'].includes(input.environment)||input.job.adapter!=='post-for-me'||input.job.providerMode!=='provider'||!id(input.accountId)||!verifyPublicationPayload(input.job))throw new Error('post_for_me_publication_invalid');
 let state:PostForMeDispatchState={adapter:'post-for-me',...structuredClone(input.state||{})};
 const save=async(patch:Partial<PostForMeDispatchState>)=>{state={...state,...patch};await input.checkpoint(structuredClone(state));};
 const outcome=(status:PostForMePublishResult['status'],errorCode=state.errorCode)=>({status,state,providerPostId:state.providerPostId,url:state.url||'',...(errorCode?{errorCode}:{})});
 if(state.phase==='confirmed'&&state.providerPostId)return outcome('published');
 // Only a known, terminal rejection plus an explicit user retry creates a new
 // attempt. An uncertain attempt is reconciled even after clicking Retry.
 if(state.phase==='rejected'&&(Number(input.job.attempt)||1)>(state.attempt||1)&&input.maySend){
  const history=[...(state.history||[]),{attempt:state.attempt||1,reference:state.reference!,postId:state.postId,phase:state.phase}].slice(-20);state={adapter:'post-for-me',projectId:state.projectId,history};await input.checkpoint(state);
 }
 if(state.phase==='rejected')return outcome('failed');if(state.phase==='cancelled')return outcome('cancelled');
 const reference=state.reference||postForMeReference(input.environment,input.clubId,input.job);
 let post:PFMPost|undefined,creating=false;
 try{
  if(state.postId){post=await input.client.getPost(state.postId);if(!matchesPost(post,reference,input.accountId))return outcome('awaiting_confirmation','reference_conflict');}
  else if(state.phase==='publishing'){
   const page=await input.client.listPosts({external_id:reference,social_account_id:input.accountId,limit:10,offset:0});
   const found=page.data.filter(post=>matchesPost(post,reference,input.accountId));
   if(found.length!==1||page.meta.total>page.data.length||page.data.some(post=>post.external_id===reference&&!matchesPost(post,reference,input.accountId)))return outcome('awaiting_confirmation',found.length>1?'reference_conflict':undefined);
   post=found[0];await save({phase:'accepted',postId:post.id});
  }else{
   if(!input.maySend)return outcome('cancelled');
   const media=new URL(input.mediaUrl||'');if(media.protocol!=='https:'||!media.pathname.startsWith('/api/publication-media/'))throw new Error('post_for_me_media_invalid');
   // A missed webhook must not let a cached connection send under another
   // tenant's external_id, a replaced profile, or a revoked provider grant.
   // This preflight runs only for a new write, never for historical receipts.
   const rejectUnsent=async(errorCode:string)=>{await save({phase:'rejected',attempt:Number(input.job.attempt)||1,reference,errorCode});return outcome('failed',errorCode);};
   let account:Awaited<ReturnType<PostForMeClient['getAccount']>>;
   try{account=await input.client.getAccount(input.accountId);}catch{return rejectUnsent('account_verification_failed');}
   if(account.id!==input.accountId||account.platform!==provider||account.external_id!==postForMeExternalId(input.clubId,{origin:'',environment:input.environment})||!id(input.expectedProviderAccountId)||account.user_id!==input.expectedProviderAccountId)return rejectUnsent('account_not_owned');
   if(account.status!=='connected')return rejectUnsent('account_disconnected');
   // The worker still holds the workspace lock. Recheck authoritative local
   // feature flags, claims and the selected grant after the provider read.
   let authorized=false;try{authorized=await input.recheckAuthorization();}catch{/* No upstream payload or credential enters the durable error. */}
   if(!authorized)return rejectUnsent('authorization_changed');
   await save({phase:'publishing',attempt:Number(input.job.attempt)||1,reference,startedAt:input.now||new Date().toISOString(),errorCode:undefined});
   creating=true;post=await input.client.createPost({caption:String(input.job.payload.caption||input.job.payload.title||''),social_accounts:[input.accountId],external_id:reference,media:[{url:media.href}],platform_configurations:{[provider]:{placement:input.job.channel.endsWith('Story')?'stories':'timeline'}}});
   creating=false;if(!matchesPost(post,reference,input.accountId))return outcome('awaiting_confirmation','reference_conflict');
   await save({phase:'accepted',postId:post.id});
  }
  const results=await input.client.getPostResults(post.id,{social_account_id:input.accountId,limit:10,offset:0});
  const matching=results.data.filter(result=>result.post_id===post!.id&&result.social_account_id===input.accountId);
  const success=matching.find(result=>result.success===true&&id(result.platform_data?.id));
  if(success){await save({phase:'confirmed',providerPostId:success.platform_data.id,url:safePostUrl(success.platform_data.url,provider),errorCode:undefined});return outcome('published');}
  if(results.meta.total<=results.data.length&&matching.some(result=>result.success===false)){await save({phase:'rejected',errorCode:safeFailure(matching.find(result=>result.success===false)?.errorCode)});return outcome('failed');}
  // Planning stays in Castiq. If the provider nevertheless reports a future
  // scheduled/draft item, remove only the exact saved single-account request.
  if(input.cancelPending&&['scheduled','draft'].includes(post.status)){await input.client.deletePost(post.id);await save({phase:'cancelled',errorCode:undefined});return outcome('cancelled');}
  return outcome('awaiting_confirmation');
 }catch(error){
  if(error instanceof PostForMeError&&creating&&!error.ambiguous&&state.phase==='publishing'&&!state.postId){await save({phase:'rejected',errorCode:safeFailure(error.code)});return outcome('failed');}
  if(error instanceof PostForMeError)return outcome('awaiting_confirmation');
  throw error;
 }
}

export async function validatePostForMeMedia(bytes:Buffer,channel:string){
 const meta=await sharp(bytes,{limitInputPixels:20_000_000}).metadata();const story=channel.endsWith('Story');
 if(meta.format!=='jpeg'||bytes.length>8*1024*1024||meta.width!==1080||meta.height!==(story?1920:1350))throw new Error('post_for_me_media_invalid');
}
export type PostForMeTickOptions={postForMe:PostForMeOptions;media:PublicationMediaOptions;now?:string;leaseMs?:number;publicationEnabled?:boolean;afterClaim?:(claim:any)=>Promise<void>};
const workerActor=(clubId:string)=>({id:'post-for-me-worker',name:'Kanaalworker',role:'club' as const,clubId});
async function persistWorker(db:pg.PoolClient,clubId:string,before:any,state:any,version:number,job:any,at:string,correlationId:string){
 job.leaseUntil=null;job.leaseOwner=null;job.updatedAt=at;
 if(job.status==='awaiting_confirmation'){
  job.reconcileAttempts=(job.reconcileAttempts||0)+1;
  job.nextReconcileAt=job.reconcileAttempts>=24?'9999-12-31T00:00:00.000Z':new Date(Date.parse(at)+Math.min(15*60000,30000*2**Math.min(job.reconcileAttempts-1,5))).toISOString();
  if(job.reconcileAttempts>=24)job.error='De provider heeft de verzending nog niet bevestigd. Controleer deze opdracht handmatig; Castiq verstuurt hem niet opnieuw.';
 }else delete job.nextReconcileAt;
 state.content=state.content.map((item:any)=>item.jobs?.some((entry:any)=>entry.id===job.id)?normalizeContent(item):item);
 await persistHistory(db,workerActor(clubId),before,state,'post_for_me.'+job.status,{id:state.content.find((item:any)=>item.jobs?.some((entry:any)=>entry.id===job.id))?.id},job.id,correlationId);
 await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(version)+1,clubId]);
}
function confirmReceipt(job:any,dispatch:PostForMeDispatchState,at:string){
 job.status='published';job.providerDispatch={...dispatch};
 const receipt={kind:'provider',provider:'post-for-me',channelProvider:providerFor(job),externalPostId:dispatch.postId,providerPostId:dispatch.providerPostId,url:dispatch.url||'',confirmedAt:at,requestId:job.requestId,version:job.version,sponsorAgreementId:job.sponsorAgreementId,sponsorName:job.sponsorName,sponsorLogo:job.sponsorLogo};
 job.receipt=receipt;job.receipts=[...(job.receipts||[]).filter((entry:any)=>entry.requestId!==job.requestId),receipt];delete job.error;
}
/** Scheduled jobs remain private/local until due. All authorization and approval
 * checks run again while holding the authoritative workspace lock. */
export async function processPostForMeJobs(pool:pg.Pool,options:PostForMeTickOptions){
 if(!['staging','local'].includes(options.postForMe.environment))return {claimed:false,disabled:true};
 const at=options.now||new Date().toISOString(),owner=randomUUID(),correlationId=randomUUID(),db=await pool.connect();let claim:any;
 try{
  await db.query('BEGIN');
  const row=(await db.query("SELECT w.club_id,w.state,w.version,j.id AS job_id FROM castiq.workspaces w JOIN castiq.jobs j ON j.club_id=w.club_id LEFT JOIN castiq.publication_dispatches d ON d.job_id=j.id AND d.club_id=j.club_id WHERE j.provider_mode='provider' AND j.state->>'adapter'='post-for-me' AND ($2::boolean OR d.job_id IS NOT NULL) AND ((j.status IN ('queued','scheduled') AND (j.scheduled_at IS NULL OR j.scheduled_at<=$1)) OR (j.status='processing' AND j.lease_until<=$1) OR (j.status='awaiting_confirmation' AND COALESCE((j.state->>'nextReconcileAt')::timestamptz,'1970-01-01'::timestamptz)<=$1) OR (d.state->>'phase' IN ('publishing','accepted') AND j.status NOT IN ('published','processing','awaiting_confirmation') AND COALESCE((j.state->>'nextReconcileAt')::timestamptz,'1970-01-01'::timestamptz)<=$1) OR (d.state->>'phase'='confirmed' AND j.status<>'published')) AND ((w.state#>>'{v1,publicationPaused}') IS DISTINCT FROM 'true' OR d.job_id IS NOT NULL) ORDER BY CASE WHEN d.state->>'phase'='confirmed' THEN 0 ELSE 1 END,w.club_id,j.updated_at,j.id FOR UPDATE OF w SKIP LOCKED LIMIT 1",[at,options.publicationEnabled!==false])).rows[0];
  if(!row){await db.query('COMMIT');return {claimed:false};}
  const before=row.state,state=structuredClone(before),item=state.content?.find((item:any)=>item.jobs?.some((job:any)=>job.id===row.job_id)),job=item?.jobs?.find((job:any)=>job.id===row.job_id);
  if(!job||job.adapter!=='post-for-me'||job.providerMode!=='provider'){await db.query('COMMIT');return {claimed:false};}
  job.status='processing';job.leaseOwner=owner;job.leaseUntil=new Date(Date.parse(at)+(options.leaseMs||120000)).toISOString();job.updatedAt=at;
  await persistHistory(db,workerActor(row.club_id),before,state,'post_for_me.claimed',{id:item.id},job.id,correlationId);await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(row.version)+1,row.club_id]);
  claim={clubId:row.club_id,contentId:item.id,job:structuredClone(job)};await db.query('COMMIT');
 }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 if(options.afterClaim)await options.afterClaim(claim);
 const finish=await pool.connect();
 try{
  await finish.query('BEGIN');
  await finish.query("SELECT id FROM castiq.post_for_me_config WHERE id='staging' FOR SHARE");
  const row=(await finish.query('SELECT state,version FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[claim.clubId])).rows[0];
  const before=row.state,state=structuredClone(before),item=state.content?.find((item:any)=>item.id===claim.contentId),job=item?.jobs?.find((job:any)=>job.id===claim.job.id);
  if(!job||job.status!=='processing'||job.leaseOwner!==owner){await finish.query('COMMIT');return {claimed:true,interrupted:true};}
  let journal=(await finish.query('SELECT * FROM castiq.publication_dispatches WHERE job_id=$1 AND club_id=$2',[job.id,claim.clubId])).rows[0];
  let config:Awaited<ReturnType<typeof readPostForMeConfiguration>>|undefined,destination:Awaited<ReturnType<typeof assertPostForMeDestination>>|undefined;
  try{config=await readPostForMeConfiguration(finish,options.postForMe);destination=await assertPostForMeDestination(finish,claim.clubId,job.channel,options.postForMe);}catch{/* Configuration and authorization failures never expose provider details. */}
  const approval=(await finish.query("SELECT 1 FROM castiq.approvals WHERE club_id=$1 AND content_id=$2 AND revision=$3 AND content_hash=$4 AND decision='approved'",[claim.clubId,item.id,job.version,job.contentHash])).rowCount;
  const authorized=!!(config?.enabled&&config.apiTestStatus==='success'&&destination?.accountId===job.providerAccountId&&destination.authorizationId===job.providerAuthorizationId&&config.projectId===job.providerProjectId);
  const current=options.publicationEnabled!==false&&authorized&&verifyPublicationPayload(job)&&!state.v1?.publicationPaused&&item.version===job.version&&item.approvedVersion===job.version&&!!approval&&!contentPrivacyErrors(item).length&&state.rules?.[`${item.team}|${item.type}|${job.channel}`]!=='off';
  if(journal?.state?.phase==='confirmed'&&journal.state.providerPostId)confirmReceipt(job,journal.state,at);
  else if(!current&&!journal){job.status=state.v1?.publicationPaused?'queued':'cancelled';job.error=state.v1?.publicationPaused?'Publicatie is gepauzeerd.':'De goedkeuring, integratie of clubkoppeling is gewijzigd. Controleer en maak een nieuwe opdracht.';}
  else if(journal&&(journal.account_id!==job.providerAccountId||journal.content_hash!==job.contentHash||journal.provider!==providerFor(job)||journal.state?.projectId!==job.providerProjectId)){job.status='awaiting_confirmation';job.error=postForMeFailureMessage('reference_conflict');}
  else if(!config?.apiKey||config.projectId!==job.providerProjectId){job.status=journal?'awaiting_confirmation':'failed';job.error='De Post for Me-configuratie is niet beschikbaar. Laat de platformbeheerder deze controleren.';}
  else{
   if(!journal){
    // This autocommit journal survives a lost workspace transaction.
    await pool.query('INSERT INTO castiq.publication_dispatches(job_id,club_id,provider,account_id,connection_version,content_hash,state) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(job_id) DO NOTHING',[job.id,claim.clubId,providerFor(job),job.providerAccountId,destination!.version,job.contentHash,JSON.stringify({adapter:'post-for-me',projectId:job.providerProjectId})]);journal={state:{adapter:'post-for-me',projectId:job.providerProjectId}};
   }
   const checkpoint=async(dispatch:PostForMeDispatchState)=>{const saved=await pool.query('UPDATE castiq.publication_dispatches SET state=$1,updated_at=now() WHERE job_id=$2 AND club_id=$3 AND account_id=$4 AND content_hash=$5',[JSON.stringify(dispatch),job.id,claim.clubId,job.providerAccountId,job.contentHash]);if(saved.rowCount!==1)throw new Error('post_for_me_journal_mismatch');journal.state=structuredClone(dispatch);};
   try{
    let mediaUrl:string|undefined;
    if(current&&(!journal.state?.phase||journal.state?.phase==='rejected'&&(Number(job.attempt)||1)>(journal.state.attempt||1))){
     await validatePostForMeMedia(await renderPublicationMedia(finish,claim.clubId,job,options.media),job.channel);mediaUrl=publicationMediaUrl(claim.clubId,job,options.media);
    }
    const selected=(await finish.query('SELECT provider_account_id FROM castiq.post_for_me_connections WHERE club_id=$1 AND provider=$2 AND project_id=$3 AND account_id=$4 AND authorization_id=$5',[claim.clubId,providerFor(job),job.providerProjectId,job.providerAccountId,job.providerAuthorizationId])).rows[0];
    const recheckAuthorization=async()=>{const latest=await assertPostForMeDestination(finish,claim.clubId,job.channel,options.postForMe);const local=(await finish.query('SELECT provider_account_id FROM castiq.post_for_me_connections WHERE club_id=$1 AND provider=$2 AND project_id=$3 AND account_id=$4 AND authorization_id=$5',[claim.clubId,providerFor(job),job.providerProjectId,job.providerAccountId,job.providerAuthorizationId])).rows[0];return options.publicationEnabled!==false&&latest.projectId===job.providerProjectId&&latest.accountId===job.providerAccountId&&latest.authorizationId===job.providerAuthorizationId&&!!selected?.provider_account_id&&local?.provider_account_id===selected.provider_account_id;};
    const result=await publishPostForMeImage({client:new PostForMeClient({apiKey:config.apiKey,fetch:options.postForMe.fetch}),environment:options.postForMe.environment,clubId:claim.clubId,job,accountId:job.providerAccountId,expectedProviderAccountId:selected?.provider_account_id||'',recheckAuthorization,mediaUrl,state:journal.state,checkpoint,maySend:current,cancelPending:!current,now:at});
    job.status=result.status;job.providerDispatch=structuredClone(result.state);
    if(result.status==='published')confirmReceipt(job,result.state,at);else job.error=result.status==='cancelled'?'De externe concept- of geplande opdracht is ingetrokken.':postForMeFailureMessage(result.errorCode);
   }catch(error){job.status=['publishing','accepted'].includes(journal.state?.phase)?'awaiting_confirmation':'failed';job.error=error instanceof Error&&error.message==='post_for_me_media_invalid'?postForMeFailureMessage('media_invalid'):'De kanaalaanvraag kon niet worden afgerond. Controleer deze opdracht en de koppeling.';}
  }
  await persistWorker(finish,claim.clubId,before,state,row.version,job,at,correlationId);await finish.query('COMMIT');return {claimed:true,jobId:job.id,status:job.status};
 }catch(error){await finish.query('ROLLBACK');throw error;}finally{finish.release();}
}

export type PostForMeWebhookEvent={event_type:string;data:{id?:string;post_id?:string;social_account_id?:string;platform?:string;external_id?:string;status?:string;success?:boolean;platform_data?:{id?:string;url?:string}}};
/** Webhook data only wakes a durable journal. The read API remains the source
 * of per-account truth, so duplicate and out-of-order events cannot regress a
 * successful receipt or make an unselected account publishable. */
export async function processPostForMeWebhookEvent(db:pg.PoolClient,event:PostForMeWebhookEvent,options:PostForMeTickOptions){
 if(event.event_type==='social.account.created'||event.event_type==='social.account.updated'){if(!id(event.data?.id))return {ignored:true};const config=await readPostForMeConfiguration(db,options.postForMe);return reconcilePostForMeAccount(db,event.data.id,options.postForMe);}
 if(event.event_type!=='social.post.result.created')return {ignored:true};
 const postId=event.data?.post_id,accountId=event.data?.social_account_id;if(!id(postId)||!id(accountId))return {ignored:true};
 const config=await readPostForMeConfiguration(db,options.postForMe),client=new PostForMeClient({apiKey:config.apiKey,fetch:options.postForMe.fetch}),post=await client.getPost(postId);
 if(!id(post.external_id)||!accountIds(post).includes(accountId))return {ignored:true};
 const journal=(await db.query("SELECT d.job_id,d.club_id,d.state FROM castiq.publication_dispatches d JOIN castiq.jobs j ON j.id=d.job_id AND j.club_id=d.club_id WHERE d.account_id=$1 AND j.state->>'adapter'='post-for-me' AND j.state->>'providerProjectId'=$2 AND (d.state->>'postId'=$3 OR d.state->>'reference'=$4)",[accountId,config.projectId,postId,post.external_id])).rows;
 // More than one journal for a reference would be a consistency failure, not a
 // reason to guess a destination. No arbitrary provider-side item is imported.
 if(journal.length!==1)return {ignored:true};
 const entry=journal[0],row=(await db.query('SELECT state,version FROM castiq.workspaces WHERE club_id=$1 FOR UPDATE',[entry.club_id])).rows[0];if(!row)return {ignored:true};
 const before=row.state,state=structuredClone(before),item=state.content?.find((item:any)=>item.jobs?.some((job:any)=>job.id===entry.job_id)),job=item?.jobs?.find((job:any)=>job.id===entry.job_id);
 if(!job||job.providerAccountId!==accountId||job.status==='published'||entry.state?.phase==='confirmed')return {ignored:true};
 job.status='awaiting_confirmation';job.nextReconcileAt=options.now||new Date().toISOString();job.reconcileAttempts=0;job.leaseUntil=null;job.leaseOwner=null;
 await persistHistory(db,workerActor(entry.club_id),before,state,'post_for_me.result_available',{id:item.id},job.id,randomUUID());
 await db.query('UPDATE castiq.workspaces SET state=$1,version=$2,updated_at=now() WHERE club_id=$3',[JSON.stringify(state),Number(row.version)+1,entry.club_id]);return {woken:true,jobId:job.id};
}
export async function runPostForMeWebhookTick(pool:pg.Pool,options:PostForMeTickOptions){
 if(!['staging','local'].includes(options.postForMe.environment))return {claimed:false,disabled:true};
 const at=options.now||new Date().toISOString(),db=await pool.connect();let event:any;
 try{
  await db.query('BEGIN');await db.query("SELECT id FROM castiq.post_for_me_config WHERE id='staging' FOR SHARE");
  event=(await db.query('SELECT * FROM castiq.post_for_me_webhook_events WHERE processed_at IS NULL AND next_attempt_at<=$1 ORDER BY received_at,id FOR UPDATE SKIP LOCKED LIMIT 1',[at])).rows[0];
  if(!event){await db.query('COMMIT');return {claimed:false};}
  const config=await readPostForMeConfiguration(db,options.postForMe);
  const result=config.projectId===event.project_id?await processPostForMeWebhookEvent(db,event.payload,options):{ignored:true};
  await db.query('UPDATE castiq.post_for_me_webhook_events SET processed_at=$1,attempts=attempts+1,error_code=NULL WHERE id=$2',[at,event.id]);await db.query('COMMIT');return {claimed:true,...result};
 }catch(error){
  await db.query('ROLLBACK');if(!event)throw error;
  const attempts=Number(event.attempts)+1;
  await pool.query('UPDATE castiq.post_for_me_webhook_events SET attempts=attempts+1,error_code=$1,next_attempt_at=$2 WHERE id=$3 AND processed_at IS NULL',['read_verification_pending',attempts>=12?'9999-12-31T00:00:00.000Z':new Date(Date.parse(at)+Math.min(15*60000,30000*2**Math.min(attempts-1,5))).toISOString(),event.id]);return {claimed:true,retry:true};
 }finally{db.release();}
}
