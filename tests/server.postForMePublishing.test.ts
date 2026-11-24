import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {PostForMeError,type PFMPost,type PFMPostResult,type PFMAccount} from '../server/postForMeClient.ts';
import {publishPostForMeImage,postForMeReference,validatePostForMeMedia,type PostForMePublishInput,type PostForMeDispatchState} from '../server/postForMePublishing.ts';
const account=(id='spc_synthetic'):PFMAccount=>({id,platform:'facebook',username:'synthetic',user_id:'synthetic-page',profile_photo_url:null,status:'connected',external_id:'castiq:local:synthetic-club',metadata:{display_name:'Synthetische vereniging'}});
const page=<T>(data:T[])=>({data,meta:{total:data.length,offset:0,limit:10,next:null}});
function input(){
 const payload={caption:'Fictieve stagingtest',title:'Synthetisch clubmoment'},job={id:'job-synthetic',providerMode:'provider',adapter:'post-for-me',requestId:'synthetic-club:synthetic-request',channel:'Facebook-feed',attempt:1,payload,contentHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
 const state:PostForMeDispatchState={},checkpoints:PostForMeDispatchState[]=[],calls:string[]=[],creates:any[]=[];
 const value:PostForMePublishInput={environment:'local',clubId:'synthetic-club',job,accountId:'spc_synthetic',expectedProviderAccountId:'synthetic-page',recheckAuthorization:async()=>true,state,mediaUrl:'https://staging.example.test/api/publication-media/job-synthetic?synthetic=1',maySend:true,checkpoint:async(s:PostForMeDispatchState)=>{checkpoints.push(structuredClone(s));},client:{
  getAccount:async(accountId:string)=>{calls.push('account');return {...account(accountId),platform:value.job.channel.toLowerCase().startsWith('instagram')?'instagram':'facebook'};},createPost:async(body:any)=>{calls.push('create');creates.push(body);return post(body.external_id);},listPosts:async()=>{calls.push('list');return page<PFMPost>([]);},getPost:async()=>{calls.push('get');return post();},getPostResults:async()=>{calls.push('results');return page<PFMPostResult>([]);},deletePost:async()=>{calls.push('delete');return {success:true as const};}
 }};
 function post(reference=postForMeReference(value.environment,value.clubId,value.job),status:PFMPost['status']='processing'):PFMPost{return {id:'spp_synthetic',external_id:reference,caption:payload.caption,status,scheduled_at:null,social_accounts:[account()]};}
 return {value,checkpoints,calls,creates,post};
}
const result=(success:boolean,id='synthetic-published'):PFMPostResult=>({id:'spr_synthetic',post_id:'spp_synthetic',social_account_id:'spc_synthetic',success,platform_data:success?{id,url:'https://www.facebook.com/'+id}:{},...(!success?{errorCode:'provider_rejected'}:{})});
test('Post for Me requires an explicit staging adapter, valid frozen payload, and permission to send',async()=>{
 const {value,calls}=input();value.maySend=false;assert.equal((await publishPostForMeImage(value)).status,'cancelled');assert.equal(calls.length,0);
 value.maySend=true;value.environment='production';await assert.rejects(publishPostForMeImage(value),/publication_invalid/);value.environment='local';value.job.payload.caption='tampered';await assert.rejects(publishPostForMeImage(value),/publication_invalid/);
});
test('Post for Me commits a unique single-account intent before POST and waits for a real per-channel result',async()=>{
 const {value,checkpoints,creates}=input();value.client.createPost=async(body)=>{assert.equal(checkpoints.at(-1)?.phase,'publishing');creates.push(body);return {id:'spp_synthetic',external_id:body.external_id,caption:body.caption,status:'processing',scheduled_at:null,social_accounts:[account()]};};
 const outcome=await publishPostForMeImage(value);assert.equal(outcome.status,'awaiting_confirmation');assert.equal(outcome.providerPostId,undefined);assert.equal(outcome.state.postId,'spp_synthetic');assert.equal(creates.length,1);assert.deepEqual(creates[0].social_accounts,['spc_synthetic']);assert.equal(creates[0].scheduled_at,undefined);assert.deepEqual(creates[0].platform_configurations,{facebook:{placement:'timeline'}});
});
test('a successful result needs the exact post and destination and a platform post ID',async()=>{
 const {value}=input();value.client.getPostResults=async()=>page([{...result(true),social_account_id:'other-club'}, {...result(true),post_id:'other-post'}, {...result(true),platform_data:{url:'https://www.facebook.com/synthetic'} }]);
 assert.equal((await publishPostForMeImage(value)).status,'awaiting_confirmation');value.client.getPostResults=async()=>page([result(true)]);const outcome=await publishPostForMeImage({...value,state:{phase:'accepted',reference:postForMeReference(value.environment,value.clubId,value.job),postId:'spp_synthetic'}});assert.equal(outcome.status,'published');assert.equal(outcome.providerPostId,'synthetic-published');assert.equal(outcome.url,'https://www.facebook.com/synthetic-published');
});
test('Instagram Story uses documented stories placement and only safe Instagram result URLs',async()=>{
 const {value,creates}=input();value.job.channel='Instagram Story';value.client.getPostResults=async()=>page([{...result(true),platform_data:{id:'synthetic-published',url:'https://attacker.invalid/post'}}]);const outcome=await publishPostForMeImage(value);assert.equal(outcome.status,'published');assert.equal(outcome.url,'');assert.deepEqual(creates[0].platform_configurations,{instagram:{placement:'stories'}});
});
test('an ambiguous create timeout is reconciled by external_id and never blindly posted again',async()=>{
 const {value,calls,post}=input();value.client.createPost=async()=>{calls.push('create');throw new PostForMeError('post_for_me_unavailable',0,true);};
 const first=await publishPostForMeImage(value);assert.equal(first.status,'awaiting_confirmation');assert.equal(first.state.phase,'publishing');
 const noResult=await publishPostForMeImage({...value,state:first.state});assert.equal(noResult.status,'awaiting_confirmation');assert.equal(calls.filter(call=>call==='create').length,1);
 value.client.listPosts=async()=>page([post()]);value.client.getPostResults=async()=>page([result(true)]);const recovered=await publishPostForMeImage({...value,state:first.state});assert.equal(recovered.status,'published');assert.equal(calls.filter(call=>call==='create').length,1);
});
test('a read failure while reconciling never turns uncertainty into a repeatable rejection',async()=>{
 const {value,calls}=input();const state:PostForMeDispatchState={phase:'publishing',attempt:1,reference:postForMeReference(value.environment,value.clubId,value.job)};value.job.attempt=2;value.client.listPosts=async()=>{throw new PostForMeError('post_for_me_unauthorized',401,false);};const outcome=await publishPostForMeImage({...value,state});assert.equal(outcome.status,'awaiting_confirmation');assert.equal(outcome.state.phase,'publishing');assert(!calls.includes('create'));
});
test('an exact known rejection can be retried explicitly with a new reference and preserved history',async()=>{
 const {value,calls,creates}=input();value.client.getPostResults=async()=>page([result(false)]);const failed=await publishPostForMeImage(value);assert.equal(failed.status,'failed');assert.equal((await publishPostForMeImage({...value,state:failed.state})).status,'failed');assert.equal(creates.length,1);
 value.job.attempt=2;const next=await publishPostForMeImage({...value,state:failed.state});assert.equal(next.status,'failed');assert.equal(creates.length,2);assert.notEqual(creates[0].external_id,creates[1].external_id);assert.equal(next.state.history?.length,1);assert.equal(calls.filter(call=>call==='create').length,2);
});
test('a definitive create rejection is safe to report but contains no upstream message',async()=>{
 const {value}=input();value.client.createPost=async()=>{throw new PostForMeError('post_for_me_unauthorized',401,false);};const outcome=await publishPostForMeImage(value);assert.equal(outcome.status,'failed');assert.equal(outcome.errorCode,'unauthorized');assert.equal(outcome.state.phase,'rejected');
});
test('conflicting external references and another club account are never activated or republished',async()=>{
 const {value,calls,post}=input(),state:PostForMeDispatchState={phase:'publishing',attempt:1,reference:postForMeReference(value.environment,value.clubId,value.job)};
 value.client.listPosts=async()=>page([{...post(),social_accounts:[account('spc_other-club')]}]);assert.equal((await publishPostForMeImage({...value,state})).status,'awaiting_confirmation');assert(!calls.includes('create'));
 value.client.listPosts=async()=>page([post(),{...post(),id:'spp_duplicate'}]);const duplicate=await publishPostForMeImage({...value,state});assert.equal(duplicate.errorCode,'reference_conflict');assert(!calls.includes('create'));
});
test('disable or stale approval removes only the saved exact scheduled provider request and preserves live results',async()=>{
 const {value,calls,post}=input(),state:PostForMeDispatchState={phase:'accepted',attempt:1,reference:postForMeReference(value.environment,value.clubId,value.job),postId:'spp_synthetic'};value.client.getPost=async()=>post(undefined,'scheduled');
 let outcome=await publishPostForMeImage({...value,state,maySend:false,cancelPending:true});assert.equal(outcome.status,'cancelled');assert.equal(calls.filter(call=>call==='delete').length,1);
 value.client.getPostResults=async()=>page([result(true)]);outcome=await publishPostForMeImage({...value,state,maySend:false,cancelPending:true});assert.equal(outcome.status,'published');assert.equal(calls.filter(call=>call==='delete').length,1,'confirmed posts must never be deleted');
});
test('one channel failing does not change a successful channel and confirmed receipt is monotonic',async()=>{
 const fb=input(),ig=input();ig.value.job.id='instagram-job';ig.value.job.channel='Instagram-feed';fb.value.client.getPostResults=async()=>page([result(true)]);ig.value.client.getPostResults=async()=>page([result(false)]);
 const [facebook,instagram]=await Promise.all([publishPostForMeImage(fb.value),publishPostForMeImage(ig.value)]);assert.equal(facebook.status,'published');assert.equal(instagram.status,'failed');
 fb.value.maySend=false;fb.value.client.getPostResults=async()=>page([result(false)]);const duplicate=await publishPostForMeImage({...fb.value,state:facebook.state});assert.equal(duplicate.status,'published');assert.equal(fb.creates.length,1);
});
test('provider media is a bounded JPEG at the supported feed or Story dimensions',async()=>{
 for(const story of [false,true]){const bytes=await sharp({create:{width:1080,height:story?1920:1350,channels:3,background:'#163aff'}}).jpeg().toBuffer();await validatePostForMeMedia(bytes,story?'Instagram Story':'Facebook-feed');}
 const wrong=await sharp({create:{width:200,height:200,channels:3,background:'#ffffff'}}).png().toBuffer();await assert.rejects(validatePostForMeMedia(wrong,'Instagram-feed'),/media_invalid/);
});

// Durable tests use a separate disposable localhost database. All provider HTTP
// calls below are synthetic; no Post for Me key or real social channel is used.
import {before,after} from 'node:test';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import pg from 'pg';
import {migrate} from '../database/migrate.ts';
import {seedFixtures} from '../server/fixtures.ts';
import {encryptChannelSecret,type SocialOptions} from '../server/socialConnections.ts';
import {canonicalPayloadHash} from '../server/publicationIntegrity.ts';
import {processPostForMeJobs,runPostForMeWebhookTick,type PostForMeTickOptions} from '../server/postForMePublishing.ts';
import {readPublicationMedia,publicationMediaUrl} from '../server/publicationMedia.ts';
import {normalizeContent,reviseContent} from '../src/v1Workflow.ts';
import {receivePostForMeWebhook} from '../server/postForMe.ts';
const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let pool:pg.Pool,admin:pg.Pool,database:string,dir:string,builtin:any,opts:PostForMeTickOptions;
const secret=randomBytes(32).toString('hex'),apiKey='synthetic-pfm-api-key-for-tests',webhookSecret='synthetic-pfm-webhook-secret',origin='https://castiq.integration.invalid';
const externalPosts=new Map<string,any>();let postsSent=0,accountReads=0,remoteExternalId:string|undefined,remoteProviderAccountId:string|undefined,afterAccountRead:(()=>Promise<void>)|undefined,transport:'success'|'pending'|'timeout'|'partial'='success',remoteStatus:PFMPost['status']='processing',remoteAccountStatus:PFMAccount['status']='connected';

function remoteAccount(accountId:string):PFMAccount{return {...account(accountId),platform:accountId.includes('instagram')?'instagram':'facebook',user_id:remoteProviderAccountId||'page-'+accountId,status:remoteAccountStatus,external_id:remoteExternalId||'castiq:local:'+accountId.split('_')[1]};}
function remotePost(value:any):PFMPost{return {id:value.id,external_id:value.body.external_id,caption:value.body.caption,status:remoteStatus,scheduled_at:null,social_accounts:value.body.social_accounts.map(remoteAccount)};}
const fakeFetch:typeof fetch=async(raw,init)=>{
 const url=new URL(String(raw));assert.equal(url.origin,'https://api.postforme.dev');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer '+apiKey);
 if(url.pathname==='/v1/social-posts'&&init?.method==='POST'){
  const body=JSON.parse(String(init.body)),id='spp_'+randomUUID().replaceAll('-',''),record={id,body};postsSent++;
  assert.equal((await pool.query("SELECT COUNT(*)::int AS n FROM castiq.publication_dispatches WHERE state->>'phase'='publishing' AND state->>'reference'=$1",[body.external_id])).rows[0].n,1,'write intent must be committed before external create');
  externalPosts.set(id,record);if(transport==='timeout')throw Error('synthetic lost POST response');return Response.json(remotePost(record));
 }
 if(url.pathname==='/v1/social-posts')return Response.json(page([...externalPosts.values()].filter(row=>!url.searchParams.get('external_id')||row.body.external_id===url.searchParams.get('external_id')).map(remotePost)));
 if(url.pathname.startsWith('/v1/social-posts/')){const row=externalPosts.get(url.pathname.split('/').at(-1)!);assert(row);if(init?.method==='DELETE'){externalPosts.delete(row.id);return Response.json({success:true});}return Response.json(remotePost(row));}
 if(url.pathname==='/v1/social-post-results'){
  const row=externalPosts.get(url.searchParams.get('post_id')!);assert(row);const accountId=row.body.social_accounts[0],success=transport!=='partial'||!accountId.includes('instagram');
  return Response.json(page(transport==='pending'||transport==='timeout'?[]:[{id:'spr_'+row.id,post_id:row.id,social_account_id:accountId,success,platform_data:success?{id:'live_'+row.id,url:'https://'+(accountId.includes('instagram')?'www.instagram.com/p/':'www.facebook.com/')+'live_'+row.id}:{},error:success?null:{message:'Synthetic denied'},details:{syntheticOnly:true},media:[]} ]));
 }
 if(url.pathname.startsWith('/v1/social-accounts/')){accountReads++;const a=remoteAccount(url.pathname.split('/').at(-1)!);if(afterAccountRead)await afterAccountRead();return Response.json(a);}
 throw Error('unexpected synthetic path');
};
before(async()=>{
 if(!connection)return;const url=new URL(connection);assert(['127.0.0.1','localhost','[::1]'].includes(url.hostname));admin=new pg.Pool({connectionString:connection});database='castiq_pfm_publish_'+randomUUID().replaceAll('-','');await admin.query('CREATE DATABASE '+database);url.pathname='/'+database;pool=new pg.Pool({connectionString:url.href,max:6});await migrate(pool);await seedFixtures(pool);dir=await mkdtemp(join(tmpdir(),'castiq-pfm-'));
 const templates=JSON.parse(await readFile(new URL('../src/template-studio/builtin-templates.json',import.meta.url),'utf8'));builtin=templates[0];
 const postForMe={origin,environment:'local',encryptionKey:secret,fetch:fakeFetch};opts={postForMe,media:{origin,environment:'local',key:randomBytes(32).toString('hex'),staticDir:resolve('public'),uploadDir:dir,postForMe}};
 await pool.query("INSERT INTO castiq.post_for_me_config(id,project_id,key_fingerprint,encrypted_api_key,enabled,api_test_status,encrypted_webhook_secret,webhook_status,updated_by) VALUES('staging','proj_synthetic',$1,$2,true,'success',$3,'registered','platform')",[createHash('sha256').update(apiKey).digest('hex'),encryptChannelSecret({apiKey},postForMe as SocialOptions,'post-for-me:api-key'),encryptChannelSecret({secret:webhookSecret},postForMe as SocialOptions,'post-for-me:webhook')]);
 for(const clubId of ['cl1','cl2'])for(const provider of ['facebook','instagram']){
  const accountId='spc_'+clubId+'_'+provider;await pool.query('INSERT INTO castiq.post_for_me_account_claims(project_id,account_id,club_id,provider,provider_account_id) VALUES($1,$2,$3,$4,$5)',['proj_synthetic',accountId,clubId,provider,'page-'+accountId]);
  await pool.query("INSERT INTO castiq.post_for_me_connections(club_id,provider,project_id,account_id,provider_account_id,account_name,status,authorization_id,updated_by) VALUES($1,$2,'proj_synthetic',$3,$4,'Synthetische vereniging','connected',$5,'synthetic')",[clubId,provider,accountId,'page-'+accountId,randomUUID()]);
 }
});
after(async()=>{if(pool)await pool.end();if(admin){if(database)await admin.query('DROP DATABASE IF EXISTS '+database);await admin.end();}if(dir)await rm(dir,{recursive:true,force:true});});
async function reset(){
 externalPosts.clear();postsSent=0;accountReads=0;remoteExternalId=undefined;remoteProviderAccountId=undefined;afterAccountRead=undefined;transport='success';remoteStatus='processing';remoteAccountStatus='connected';await pool.query("UPDATE castiq.post_for_me_config SET enabled=true,api_test_status='success'");await pool.query("UPDATE castiq.post_for_me_connections SET status='connected'");
 for(const clubId of ['cl1','cl2']){const state=(await pool.query('SELECT state FROM castiq.workspaces WHERE club_id=$1',[clubId])).rows[0].state;state.v1.publicationPaused=false;for(const item of state.content)for(const job of item.jobs||[])if(job.status!=='published'){job.status='cancelled';await pool.query("UPDATE castiq.jobs SET status='cancelled',state=$2 WHERE id=$1",[job.id,JSON.stringify(job)]);}await pool.query('UPDATE castiq.workspaces SET state=$1 WHERE club_id=$2',[JSON.stringify(state),clubId]);}
}
async function addJob({clubId='cl1',provider='facebook',scheduledAt}: {clubId?:string;provider?:string;scheduledAt?:string}={}){
 const row=(await pool.query('SELECT state FROM castiq.workspaces WHERE club_id=$1',[clubId])).rows[0],state=row.state,contentId='content-'+randomUUID(),jobId='job-'+randomUUID(),channel=provider==='instagram'?'Instagram-feed':'Facebook-feed';
 const c=(await pool.query('SELECT authorization_id FROM castiq.post_for_me_connections WHERE club_id=$1 AND provider=$2',[clubId,provider])).rows[0];
 const payload={id:contentId,version:1,title:'Fictieve clubtest',caption:'Synthetisch goedgekeurde inhoud',team:'Eerste elftal',type:'Clubnieuws',photoUsage:'no_photo',namePolicy:'anonymous',render:{templateSnapshot:{id:builtin.id,name:builtin.name,family:builtin.family,version:1,layouts:builtin.versions[0].layouts},primary:'#1464f4',secondary:'#ffffff',partnerLogo:true,data:{clubName:'Fictieve vereniging'},media:[]}};
 const hash=createHash('sha256').update(JSON.stringify(payload)).digest('hex'),job={id:jobId,channel,status:scheduledAt?'scheduled':'queued',version:1,attempt:1,requestId:clubId+':'+jobId,dedupeKey:clubId+':'+contentId+':'+channel,providerMode:'provider',adapter:'post-for-me',providerProjectId:'proj_synthetic',providerAccountId:'spc_'+clubId+'_'+provider,providerConnectionVersion:1,providerAuthorizationId:c.authorization_id,payload,contentHash:hash,providerPayloadHash:canonicalPayloadHash(payload),createdAt:new Date().toISOString(),scheduledAt};
 const item=normalizeContent({...payload,family:builtin.family,status:'approved',approvedVersion:1,jobs:[job]});state.content.push(item);
 await pool.query('INSERT INTO castiq.revisions(club_id,content_id,revision,content_hash,snapshot,actor_id) VALUES($1,$2,1,$3,$4,\'synthetic\')',[clubId,contentId,hash,JSON.stringify(payload)]);
 await pool.query("INSERT INTO castiq.approvals(id,club_id,content_id,revision,content_hash,actor_id,decision) VALUES($1,$2,$3,1,$4,'synthetic','approved')",[randomUUID(),clubId,contentId,hash]);
 await pool.query("INSERT INTO castiq.jobs(id,club_id,content_id,revision,idempotency_key,provider_request_id,provider_mode,payload,content_hash,status,attempt,scheduled_at,state) VALUES($1,$2,$3,1,$4,$5,'provider',$6,$7,$8,1,$9,$10)",[jobId,clubId,contentId,job.dedupeKey,job.requestId,JSON.stringify(payload),hash,job.status,scheduledAt||null,JSON.stringify(job)]);await pool.query('UPDATE castiq.workspaces SET state=$1 WHERE club_id=$2',[JSON.stringify(state),clubId]);return {clubId,contentId,job};
}
async function stored(jobId:string){return (await pool.query('SELECT state FROM castiq.jobs WHERE id=$1',[jobId])).rows[0].state;}
async function makeDue(jobId:string){const row=(await pool.query('SELECT club_id,state FROM castiq.jobs WHERE id=$1',[jobId])).rows[0],state=(await pool.query('SELECT state FROM castiq.workspaces WHERE club_id=$1',[row.club_id])).rows[0].state;for(const item of state.content)for(const job of item.jobs||[])if(job.id===jobId){job.nextReconcileAt=new Date(0).toISOString();job.leaseUntil=new Date(0).toISOString();await pool.query('UPDATE castiq.jobs SET state=$1,lease_until=$2 WHERE id=$3',[JSON.stringify(job),job.leaseUntil,jobId]);}await pool.query('UPDATE castiq.workspaces SET state=$1 WHERE club_id=$2',[JSON.stringify(state),row.club_id]);}

test('durable Post for Me scheduling stays local until UTC due time and stores actual channel receipt',{skip:!connection},async()=>{
 await reset();const future=new Date(Date.now()+3600000).toISOString(),{job}=await addJob({scheduledAt:future});assert.equal((await processPostForMeJobs(pool,opts)).claimed,false);assert.equal(postsSent,0);
 const sent=await processPostForMeJobs(pool,{...opts,now:new Date(Date.parse(future)+1000).toISOString()});assert.equal(sent.status,'published');assert.equal(postsSent,1);const row=await stored(job.id);assert.equal(row.receipt.kind,'provider');assert.equal(row.receipt.provider,'post-for-me');assert(row.receipt.providerPostId.startsWith('live_'));assert.equal((await processPostForMeJobs(pool,opts)).claimed,false);
});
test('durable Post for Me approval, club ownership, connection grant and global switch fail closed',{skip:!connection},async()=>{
 for(const scenario of ['approval','foreign-account','grant','disabled'] as const){await reset();const {job,contentId}=await addJob();if(scenario==='disabled'){const noSend=await processPostForMeJobs(pool,{...opts,publicationEnabled:false});assert.equal(noSend.claimed,false);assert.equal(postsSent,0);continue;}
  const state=(await pool.query("SELECT state FROM castiq.workspaces WHERE club_id='cl1'")).rows[0].state,item=state.content.find((item:any)=>item.id===contentId),current=item.jobs[0];if(scenario==='approval')item.approvedVersion=undefined;if(scenario==='foreign-account')current.providerAccountId='spc_cl2_facebook';if(scenario==='grant')current.providerAuthorizationId=randomUUID();await pool.query("UPDATE castiq.workspaces SET state=$1 WHERE club_id='cl1'",[JSON.stringify(state)]);
  assert.equal((await processPostForMeJobs(pool,opts)).status,'cancelled',scenario);assert.equal(postsSent,0);assert.equal((await stored(job.id)).status,'cancelled');
 }
});
test('a committed Post for Me intent survives a lost create response and repeated delivery never duplicates a post',{skip:!connection},async()=>{
 await reset();const {job}=await addJob();transport='timeout';assert.equal((await processPostForMeJobs(pool,opts)).status,'awaiting_confirmation');assert.equal(postsSent,1);await makeDue(job.id);transport='success';assert.equal((await processPostForMeJobs(pool,opts)).status,'published');assert.equal(postsSent,1);assert.equal((await stored(job.id)).receipt.kind,'provider');
});
test('partial channel success and explicit retry affect only the failed destination',{skip:!connection},async()=>{
 await reset();transport='partial';const facebook=await addJob(),instagram=await addJob({provider:'instagram'});await processPostForMeJobs(pool,opts);await processPostForMeJobs(pool,opts);assert.equal((await stored(facebook.job.id)).status,'published');assert.equal((await stored(instagram.job.id)).status,'failed');assert.equal(postsSent,2);
 const state=(await pool.query("SELECT state FROM castiq.workspaces WHERE club_id='cl1'")).rows[0].state,item=state.content.find((item:any)=>item.id===instagram.contentId);item.jobs[0].status='queued';item.jobs[0].attempt=2;await pool.query("UPDATE castiq.workspaces SET state=$1 WHERE club_id='cl1'",[JSON.stringify(state)]);await pool.query("UPDATE castiq.jobs SET status='queued',attempt=2,state=$1 WHERE id=$2",[JSON.stringify(item.jobs[0]),instagram.job.id]);transport='success';assert.equal((await processPostForMeJobs(pool,opts)).status,'published');assert.equal(postsSent,3);assert.equal((await stored(facebook.job.id)).receipt.providerPostId,(await stored(facebook.job.id)).receipts[0].providerPostId);
});
test('duplicate and out-of-order webhooks durably wake only the exact journal and trust read results',{skip:!connection},async()=>{
 await reset();transport='pending';const {job}=await addJob();await processPostForMeJobs(pool,opts);const postId=(await pool.query('SELECT state FROM castiq.publication_dispatches WHERE job_id=$1',[job.id])).rows[0].state.postId;
 const event={event_type:'social.post.result.created',data:{id:'spr_webhook',post_id:postId,social_account_id:job.providerAccountId,success:false,details:{access_token:'synthetic-must-be-discarded'}}};
 for(let i=0;i<2;i++)await receivePostForMeWebhook(pool,JSON.stringify(event),webhookSecret,opts.postForMe);assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM castiq.post_for_me_webhook_events WHERE processed_at IS NULL')).rows[0].n,1);
 assert(!(await pool.query('SELECT payload FROM castiq.post_for_me_webhook_events WHERE processed_at IS NULL')).rows[0].payload.data.details);transport='success';assert.equal((await runPostForMeWebhookTick(pool,opts)).claimed,true);assert.equal((await processPostForMeJobs(pool,opts)).status,'published');const receipt=(await stored(job.id)).receipt;
 event.data.id='spr_old';await receivePostForMeWebhook(pool,JSON.stringify(event),webhookSecret,opts.postForMe);await runPostForMeWebhookTick(pool,opts);assert.deepEqual((await stored(job.id)).receipt,receipt);assert.equal(postsSent,1);
});
test('revoking an unsent future channel prevents publication and signed media requires the current club grant',{skip:!connection},async()=>{
 await reset();const {job}=await addJob({scheduledAt:new Date(Date.now()+3600000).toISOString()});await pool.query("UPDATE castiq.post_for_me_connections SET status='disconnected' WHERE club_id='cl1' AND provider='facebook'");assert.equal((await processPostForMeJobs(pool,{...opts,now:new Date(Date.now()+7200000).toISOString()})).status,'cancelled');assert.equal(postsSent,0);
 await reset();transport='pending';const next=await addJob();await processPostForMeJobs(pool,opts);const saved=await stored(next.job.id),url=new URL(publicationMediaUrl('cl1',saved,opts.media));assert((await readPublicationMedia(pool,url,opts.media)).bytes.length>10000);
 await pool.query("UPDATE castiq.post_for_me_connections SET status='disconnected' WHERE club_id='cl1' AND provider='facebook'");await assert.rejects(readPublicationMedia(pool,url,opts.media),/niet beschikbaar/);
});
test('a changed approval does not resend an accepted request and a late genuine receipt remains visible',{skip:!connection},async()=>{
 await reset();transport='pending';const {job,contentId}=await addJob();await processPostForMeJobs(pool,opts);const state=(await pool.query("SELECT state FROM castiq.workspaces WHERE club_id='cl1'")).rows[0].state,item=state.content.find((item:any)=>item.id===contentId);state.content=state.content.map((item:any)=>item.id===contentId?reviseContent(item,{caption:'Een nieuw concept'},'Synthetische beheerder'):item);await pool.query("UPDATE castiq.workspaces SET state=$1 WHERE club_id='cl1'",[JSON.stringify(state)]);await makeDue(job.id);transport='success';assert.equal((await processPostForMeJobs(pool,{...opts,publicationEnabled:false})).status,'published');assert.equal(postsSent,1);assert.equal((await stored(job.id)).receipt.version,1);
});
test('a revoke or changed approval committed after claim wins before any provider write',{skip:!connection},async()=>{
 await reset();await addJob();const result=await processPostForMeJobs(pool,{...opts,afterClaim:async()=>{await pool.query("UPDATE castiq.post_for_me_connections SET status='disconnected' WHERE club_id='cl1' AND provider='facebook'");}});assert.equal(result.status,'cancelled');assert.equal(postsSent,0);
});
test('overlapping deliveries claim one lease and an expired pre-send lease safely resumes once',{skip:!connection},async()=>{
 await reset();await addJob();const results=await Promise.all([processPostForMeJobs(pool,opts),processPostForMeJobs(pool,opts)]);assert.equal(results.filter(result=>result.claimed).length,1);assert.equal(postsSent,1);
 await reset();const {job}=await addJob();await assert.rejects(processPostForMeJobs(pool,{...opts,afterClaim:async()=>{throw Error('synthetic process crash');}}),/synthetic process crash/);assert.equal(postsSent,0);await makeDue(job.id);assert.equal((await processPostForMeJobs(pool,opts)).status,'published');assert.equal(postsSent,1);
});
test('a retry followed by disconnect cannot hide an uncertain provider attempt or its late receipt',{skip:!connection},async()=>{
 await reset();transport='timeout';const {job,contentId}=await addJob();await processPostForMeJobs(pool,opts);const state=(await pool.query("SELECT state FROM castiq.workspaces WHERE club_id='cl1'")).rows[0].state,current=state.content.find((item:any)=>item.id===contentId).jobs[0];current.status='cancelled';current.attempt=2;current.error='Kanaal ontkoppeld';current.nextReconcileAt=new Date(0).toISOString();await pool.query("UPDATE castiq.workspaces SET state=$1 WHERE club_id='cl1'",[JSON.stringify(state)]);await pool.query("UPDATE castiq.jobs SET status='cancelled',attempt=2,state=$1 WHERE id=$2",[JSON.stringify(current),job.id]);await pool.query("UPDATE castiq.post_for_me_connections SET status='disconnected' WHERE club_id='cl1' AND provider='facebook'");transport='success';assert.equal((await processPostForMeJobs(pool,opts)).status,'published');assert.equal(postsSent,1);assert.equal((await stored(job.id)).receipt.kind,'provider');
});
test('account webhooks verify the read API and never revive an explicitly disconnected club account',{skip:!connection},async()=>{
 await reset();const {job}=await addJob({scheduledAt:new Date(Date.now()+3600000).toISOString()}),event={event_type:'social.account.updated',data:{id:job.providerAccountId,status:'connected'}};
 const beforeCount=(await pool.query('SELECT COUNT(*)::int AS n FROM castiq.post_for_me_webhook_events')).rows[0].n;await assert.rejects(receivePostForMeWebhook(pool,JSON.stringify(event),'wrong-synthetic-secret',opts.postForMe),(error:any)=>error.status===401);assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM castiq.post_for_me_webhook_events')).rows[0].n,beforeCount);
 remoteAccountStatus='disconnected';await receivePostForMeWebhook(pool,JSON.stringify(event),webhookSecret,opts.postForMe);await runPostForMeWebhookTick(pool,opts);assert.equal((await pool.query("SELECT status FROM castiq.post_for_me_connections WHERE club_id='cl1' AND provider='facebook'")).rows[0].status,'disconnected');assert.equal((await stored(job.id)).status,'cancelled');assert.equal(postsSent,0);
 remoteAccountStatus='connected';event.data.status='disconnected';await receivePostForMeWebhook(pool,JSON.stringify(event),webhookSecret,opts.postForMe);await runPostForMeWebhookTick(pool,opts);assert.equal((await pool.query("SELECT status FROM castiq.post_for_me_connections WHERE club_id='cl1' AND provider='facebook'")).rows[0].status,'disconnected');
});

test('fresh provider ownership and connection preflight rejects another tenant, wrong profile and revoked access before create',async()=>{
 for(const scenario of ['tenant','provider','profile','disconnected'] as const){
  const {value,calls}=input();value.client.getAccount=async()=>({...account(),...(scenario==='tenant'?{external_id:'castiq:local:another-club'}:scenario==='provider'?{platform:'instagram'}:scenario==='profile'?{user_id:'different-profile'}:{status:'disconnected' as const})});
  const result=await publishPostForMeImage(value);assert.equal(result.status,'failed',scenario);assert.equal(result.state.phase,'rejected');assert.equal(result.errorCode,scenario==='disconnected'?'account_disconnected':'account_not_owned');assert(!calls.includes('create'));assert(!JSON.stringify(result).includes(value.mediaUrl!));
 }
});
test('local authorization is rechecked after the fresh provider read and stops a changed grant before POST',async()=>{
 const {value,calls}=input();let accountRead=false;value.client.getAccount=async()=>{accountRead=true;calls.push('account');return account();};value.recheckAuthorization=async()=>{assert(accountRead);calls.push('local-recheck');return false;};
 const result=await publishPostForMeImage(value);assert.equal(result.status,'failed');assert.equal(result.errorCode,'authorization_changed');assert.deepEqual(calls,['account','local-recheck']);assert.equal(result.state.phase,'rejected');
});
test('a failed pre-send account check is known unsent and does not leak provider messages or a media capability',async()=>{
 const {value,calls}=input();value.client.getAccount=async()=>{throw Error('synthetic upstream secret must never be retained '+value.mediaUrl);};
 const result=await publishPostForMeImage(value);assert.equal(result.status,'failed');assert.equal(result.errorCode,'account_verification_failed');assert.equal(result.state.phase,'rejected');assert(!calls.includes('create'));assert(!JSON.stringify(result).includes('synthetic upstream'));assert(!JSON.stringify(result).includes(value.mediaUrl!));
});
test('late genuine publication results bypass new-write account preflight after ownership or access changes',async()=>{
 const {value,calls,post}=input();value.client.getAccount=async()=>{throw Error('a revoked account must not hide old publication evidence');};value.recheckAuthorization=async()=>{throw Error('historical receipt does not grant a new write');};value.client.listPosts=async()=>page([post()]);value.client.getPostResults=async()=>page([result(true)]);
 const outcome=await publishPostForMeImage({...value,maySend:false,state:{phase:'publishing',attempt:1,reference:postForMeReference(value.environment,value.clubId,value.job)}});assert.equal(outcome.status,'published');assert.equal(outcome.providerPostId,'synthetic-published');assert(!calls.includes('create'));assert(!calls.includes('account'));
});
test('a missed account webhook never permits a new publication to a foreign tenant, replaced profile or disconnected account',{skip:!connection},async()=>{
 for(const scenario of ['tenant','profile','disconnected'] as const){
  await reset();const {job}=await addJob();if(scenario==='tenant')remoteExternalId='castiq:local:cl2';if(scenario==='profile')remoteProviderAccountId='another-provider-profile';if(scenario==='disconnected')remoteAccountStatus='disconnected';
  const outcome=await processPostForMeJobs(pool,opts),saved=await stored(job.id);assert.equal(outcome.status,'failed',scenario);assert.equal(postsSent,0);assert.equal(accountReads,1);assert.equal(saved.providerDispatch.phase,'rejected');assert.equal(saved.providerDispatch.errorCode,scenario==='disconnected'?'account_disconnected':'account_not_owned');assert.equal((await pool.query("SELECT status FROM castiq.post_for_me_connections WHERE club_id='cl1' AND provider='facebook'")).rows[0].status,'connected','the stale local cache demonstrates the missed webhook');
 }
});
test('the worker rechecks its local selected grant after the provider account lookup',{skip:!connection},async()=>{
 await reset();const {job}=await addJob();afterAccountRead=async()=>{await pool.query("UPDATE castiq.post_for_me_connections SET authorization_id=$1 WHERE club_id='cl1' AND provider='facebook'",[randomUUID()]);};
 assert.equal((await processPostForMeJobs(pool,opts)).status,'failed');assert.equal(postsSent,0);assert.equal((await stored(job.id)).providerDispatch.errorCode,'authorization_changed');
});
test('an accepted request still reconciles its late result after remote ownership and access are lost',{skip:!connection},async()=>{
 await reset();transport='timeout';const {job}=await addJob();assert.equal((await processPostForMeJobs(pool,opts)).status,'awaiting_confirmation');assert.equal(postsSent,1);assert.equal(accountReads,1);
 remoteExternalId='castiq:local:cl2';remoteAccountStatus='disconnected';accountReads=0;await makeDue(job.id);transport='success';assert.equal((await processPostForMeJobs(pool,opts)).status,'published');assert.equal(postsSent,1);assert.equal(accountReads,0,'read-only reconciliation must not be gated on a current remote account grant');assert.equal((await stored(job.id)).receipt.kind,'provider');
});
