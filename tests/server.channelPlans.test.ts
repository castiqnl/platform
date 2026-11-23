import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {migrate} from '../database/migrate.ts';
import {seedFixtures,type Actor} from '../server/fixtures.ts';
import {createApplication} from '../server/application.ts';
import {freezeClubPlan,quotePlan,currentPlanPolicy} from '../server/clubPlans.ts';
import {assertSocialDestination,encryptChannelSecret,decryptChannelSecret,requiredChannelScopes,type SocialOptions} from '../server/socialConnections.ts';
import {eraseIntegrationActorReferences} from '../server/privacy.ts';
const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
if(!connection)throw new Error('Gebruik de bestaande lokale testdatabaseconfiguratie voor de geïsoleerde kanaal-/pakketproeven.');
let pool:pg.Pool,admin:pg.Pool,server:Server,base:string,dir:string,database:string,clubCookie:string,otherCookie:string,teamCookie:string,platformCookie:string;
const externalCalls:{url:URL;init:RequestInit}[]=[];
let revoked=false,providerDenied=false;
const accessToken=randomBytes(32).toString('base64url'),refreshToken=randomBytes(32).toString('base64url');
const social:Omit<SocialOptions,'origin'|'environment'>={encryptionKey:randomBytes(32).toString('hex'),providers:{x:{clientId:'synthetic-client',clientSecret:randomBytes(24).toString('base64url'),approvedScopes:requiredChannelScopes.x},instagram:{clientId:'synthetic-instagram',clientSecret:randomBytes(24).toString('base64url'),approvedScopes:requiredChannelScopes.instagram},facebook:{clientId:'synthetic-facebook',clientSecret:randomBytes(24).toString('base64url'),approvedScopes:requiredChannelScopes.facebook}},fetch:async(raw,init:RequestInit={})=>{
 const url=new URL(String(raw));externalCalls.push({url,init});
 if(providerDenied)return Response.json({error:'invalid_grant'},{status:401});
 if(url.hostname==='api.x.com'&&url.pathname==='/2/oauth2/token')return Response.json({access_token:accessToken,refresh_token:refreshToken,scope:requiredChannelScopes.x.join(' '),expires_in:7200});
 if(url.hostname==='api.x.com'&&url.pathname==='/2/users/me')return revoked?Response.json({error:'revoked'},{status:401}):Response.json({data:{id:'synthetic-x-account',username:'fictional_club'}});
 if(url.hostname==='api.x.com'&&url.pathname==='/2/oauth2/revoke')return Response.json({revoked:true});
 if(url.hostname==='api.instagram.com'&&url.pathname==='/oauth/access_token')return Response.json({data:[{access_token:accessToken,user_id:'synthetic-ig-account',permissions:requiredChannelScopes.instagram.join(',')}]});
 if(url.hostname==='graph.instagram.com'&&url.pathname==='/access_token')return Response.json({access_token:accessToken,expires_in:5184000});
 if(url.hostname==='graph.instagram.com'&&init.method==='DELETE')return Response.json({success:true});
 if(url.hostname==='graph.instagram.com')return Response.json({id:'synthetic-ig-account',user_id:'synthetic-ig-account',username:'fictional_club',account_type:'MEDIA_CREATOR'});
 if(url.hostname==='graph.facebook.com'&&url.pathname.endsWith('/oauth/access_token'))return Response.json({access_token:accessToken,expires_in:3600});
 if(url.hostname==='graph.facebook.com'&&url.pathname.endsWith('/permissions'))return Response.json({data:requiredChannelScopes.facebook.map(permission=>({permission,status:'granted'}))});
 if(url.hostname==='graph.facebook.com'&&url.pathname.endsWith('/accounts'))return Response.json({data:[{id:'synthetic-page',name:'Fictieve clubpagina',access_token:accessToken,tasks:['CREATE_CONTENT']},{id:'no-rights',name:'Onbevoegde pagina',access_token:accessToken,tasks:['ANALYZE']}]});
 if(url.hostname==='graph.facebook.com')return Response.json({id:url.pathname.endsWith('/synthetic-page')?'synthetic-page':'synthetic-fb-user',name:'Fictieve gebruiker'});
 throw new Error('Unexpected mock provider endpoint');
}};
async function request(path:string,method='GET',body?:any,cookie=''){const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),redirect:'manual'});return {status:response.status,headers:response.headers,body:response.status===303?null:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
async function login(id:string){const r=await request('/api/session','POST',{accountId:id});assert.equal(r.status,200);return r.cookie;}
async function channels(cookie=clubCookie){const r=await request('/api/channels','GET',undefined,cookie);assert.equal(r.status,200);return r.body;}
async function providerVersion(name:string,cookie=clubCookie){return (await channels(cookie)).providers.find((p:any)=>p.provider===name).version;}
async function start(name='x',cookie=clubCookie){const r=await request(`/api/channels/${name}/start`,'POST',{expectedVersion:await providerVersion(name,cookie)},cookie);assert.equal(r.status,201);return {...r,state:new URL(r.body.authorizationUrl).searchParams.get('state')!,flowId:r.body.flowId};}
async function callback(flow:any,name='x',extra=''){return request(`/api/channels/oauth/${name}/callback?state=${flow.state}&code=synthetic-one-use-code${extra}`,'GET',undefined,flow.cookie);}
async function select(flow:any,name='x',account='synthetic-x-account',cookie=clubCookie){return request(`/api/channels/${name}/select`,'POST',{flowId:flow.flowId,accountId:account},cookie);}
before(async()=>{const url=new URL(connection!);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw new Error('Kanaaltests maken uitsluitend een tijdelijke lokale database.');admin=new pg.Pool({connectionString:connection});database='castiq_channels_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${database}`);url.pathname='/'+database;pool=new pg.Pool({connectionString:url.href});await migrate(pool);await seedFixtures(pool);dir=await mkdtemp(join(tmpdir(),'castiq-channels-'));server=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',origin:'https://staging.example.test',host:'127.0.0.1',social}));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;clubCookie=await login('getijde-club');otherCookie=await login('havenlicht-club');teamCookie=await login('getijde-team');platformCookie=await login('platform');});
after(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));if(pool)await pool.end();if(admin){try{if(database)await admin.query(`DROP DATABASE IF EXISTS ${database}`);}finally{await admin.end();}}if(dir)await rm(dir,{recursive:true,force:true});});
test('plans enforce roles, tenant boundaries, authoritative integer cents and mandatory free logo',async()=>{
 assert.equal((await request('/api/club/plan','GET',undefined,teamCookie)).status,403);assert.equal((await request('/api/admin/plans','GET',undefined,clubCookie)).status,403);
 const before=(await request('/api/club/plan','GET',undefined,clubCookie)).body;
 let saved=await request('/api/club/plan','PUT',{plan:'Gratis',optedIn:false,expectedVersion:before.snapshot.choiceVersion,expectedPolicyVersion:before.policy.version,netCents:1,partnerLogo:false,clubId:'cl2'},clubCookie);assert.equal(saved.status,200);assert.equal(saved.body.snapshot.netCents,0);assert.equal(saved.body.snapshot.partnerLogo,true);assert.equal(saved.body.snapshot.billingStatus,'not_activated');
 const v=saved.body.snapshot.choiceVersion;saved=await request('/api/club/plan','PUT',{plan:'Club',optedIn:true,expectedVersion:v,expectedPolicyVersion:before.policy.version},clubCookie);assert.equal(saved.status,200);assert.equal(saved.body.snapshot.baseCents,6900);assert.equal(saved.body.snapshot.savingsCents,690);assert.equal(saved.body.snapshot.netCents,6210);
 assert.equal((await pool.query("SELECT 1 FROM castiq.club_plan_choices WHERE club_id='cl2'")).rowCount,0);
 assert.equal((await request('/api/club/plan','PUT',{plan:'Start',optedIn:false,expectedVersion:v,expectedPolicyVersion:before.policy.version},clubCookie)).status,409);
});
test('published policy versions change future estimates, not historical snapshots; 0% retains opt-in',async()=>{
 const original=await freezeClubPlan(pool,'cl1');const oldEvents=JSON.stringify((await pool.query('SELECT snapshot FROM castiq.plan_events WHERE club_id=$1 ORDER BY created_at',['cl1'])).rows);
 let adminState=(await request('/api/admin/plans','GET',undefined,platformCookie)).body;
 for(const percent of [0,15]){const saved=await request('/api/admin/plans','PUT',{expectedVersion:adminState.policy.version,discountPercent:percent,plans:adminState.policy.plans},platformCookie);assert.equal(saved.status,200);adminState=saved.body;const next=await freezeClubPlan(pool,'cl1');assert.equal(next.partnerLogo,true);assert.equal(next.netCents,percent===0?6900:5865);}
 assert.equal(original.netCents,6210);assert.equal(JSON.stringify((await pool.query('SELECT snapshot FROM castiq.plan_events WHERE club_id=$1 ORDER BY created_at',['cl1'])).rows),oldEvents);
 await assert.rejects(pool.query("UPDATE castiq.plan_events SET action='forged'"),/immutable/);
 const invalid=structuredClone(adminState.policy.plans);invalid[1].baseCents=39.5;assert.equal((await request('/api/admin/plans','PUT',{expectedVersion:adminState.policy.version,discountPercent:15,plans:invalid},platformCookie)).status,400);
 const policy=await currentPlanPolicy(pool);assert.equal(quotePlan(policy,'Club',true).netCents,5865);
});
test('server OAuth uses tenant+browser-bound one-use state and S256 without disclosing tokens',async()=>{
 assert.equal((await request('/api/channels','GET',undefined,teamCookie)).status,403);assert.equal((await request('/api/channels/x/start','POST',{expectedVersion:0},teamCookie)).status,403);
 const flow=await start();const auth=new URL(flow.body.authorizationUrl);assert.equal(auth.origin,'https://x.com');assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.equal(auth.searchParams.get('code_challenge')?.length,43);assert(flow.headers.get('set-cookie')?.includes('HttpOnly; Secure; SameSite=Lax'));
 assert.equal((await request(`/api/channels/oauth/x/callback?state=${flow.state}&code=synthetic`)).status,400);
 assert.equal((await request(`/api/channels/flows/${flow.flowId}`,'GET',undefined,otherCookie)).status,404);
 const before=externalCalls.length;const callbacks=await Promise.all([callback(flow),callback(flow)]);const cb=callbacks[0];assert.equal(callbacks[1].status,303);assert.equal(cb.status,303);assert.equal(cb.headers.get('location'),'/'+'#/club/channels');assert.equal((await callback(flow)).status,303);assert.equal(externalCalls.length-before,2,'duplicate callback must not exchange same code again');
 const status=(await request('/api/channels/flows/'+flow.flowId,'GET',undefined,clubCookie)).body;assert.equal(status.status,'select');assert(!JSON.stringify(status).includes(accessToken));assert.equal((await select(flow,'x','synthetic-x-account',otherCookie)).status,404);
 assert.equal((await select(flow)).status,200);assert.equal((await select(flow)).status,200,'selection callback is idempotent');
 const stored=(await pool.query("SELECT encrypted_tokens,status FROM castiq.social_connections WHERE club_id='cl1' AND provider='x'")).rows[0];assert.equal(stored.status,'connected');assert(!stored.encrypted_tokens.includes(accessToken));assert(!stored.encrypted_tokens.includes(refreshToken));assert(!(JSON.stringify(await channels())).includes(accessToken));
 const tokenRequest=externalCalls.find(c=>c.url.pathname==='/2/oauth2/token')!;const verifier=(tokenRequest.init.body as URLSearchParams).get('code_verifier')!;assert.equal(createHash('sha256').update(verifier).digest('base64url'),auth.searchParams.get('code_challenge'));
});
test('denial and expired callback preserve old account; real revocation disables new destinations',async()=>{
 const denial=await start();assert.equal((await callback(denial,'x','&error=access_denied')).status,303);assert.equal((await channels()).providers.find((p:any)=>p.provider==='x').status,'connected');
 const expired=await start();await pool.query("UPDATE castiq.social_oauth_flows SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.flowId]);const before=externalCalls.length;assert.equal((await callback(expired)).status,303);assert.equal(externalCalls.length,before);const expiredRow=(await pool.query('SELECT encrypted_verifier,encrypted_candidates FROM castiq.social_oauth_flows WHERE id=$1',[expired.flowId])).rows[0];assert.equal(expiredRow.encrypted_verifier,null);assert.equal(expiredRow.encrypted_candidates,null);
 await assertSocialDestination(pool,'cl1','X-post');revoked=true;
 const result=await request('/api/channels/x/test','POST',{expectedVersion:await providerVersion('x')},clubCookie);assert.equal(result.status,200);assert.equal(result.body.providers.find((p:any)=>p.provider==='x').status,'revoked');await assert.rejects(assertSocialDestination(pool,'cl1','X-post'),/ontkoppeld/);revoked=false;
 const reconnect=await start();await callback(reconnect);await select(reconnect);assert.equal((await channels()).providers.find((p:any)=>p.provider==='x').status,'connected');
 const disconnected=await request('/api/channels/x','DELETE',{expectedVersion:await providerVersion('x')},clubCookie);assert.equal(disconnected.status,200);assert.equal(disconnected.body.providers.find((p:any)=>p.provider==='x').status,'disconnected');assert.equal((await pool.query("SELECT encrypted_tokens FROM castiq.social_connections WHERE club_id='cl1' AND provider='x'")).rows[0].encrypted_tokens,null);
});
test('Instagram creator excludes Stories; Facebook selection only exposes pages with publishing task',async()=>{
 const ig=await start('instagram');await callback(ig,'instagram');const igStatus=(await request('/api/channels/flows/'+ig.flowId,'GET',undefined,clubCookie)).body;assert.deepEqual(igStatus.candidates[0].destinations,['Instagram-feed']);assert.equal((await select(ig,'instagram','synthetic-ig-account')).status,200);await assert.rejects(assertSocialDestination(pool,'cl1','Instagram Story'),/niet toegestaan/);
 const fb=await start('facebook');await callback(fb,'facebook');const pages=(await request('/api/channels/flows/'+fb.flowId,'GET',undefined,clubCookie)).body;assert.equal(pages.status,'select');assert.equal(pages.candidates.length,1);assert.equal(pages.candidates[0].id,'synthetic-page');assert.equal((await select(fb,'facebook','no-rights')).status,400);assert.equal((await select(fb,'facebook','synthetic-page')).status,200);
});
test('encryption is bound to environment, tenant and provider; unconfigured provider fails closed',async()=>{
 const opts={...social,origin:'https://staging.example.test',environment:'local'};const encrypted=encryptChannelSecret({accessToken},opts,'cl1:x');assert.equal(decryptChannelSecret(encrypted,opts,'cl1:x').accessToken,accessToken);assert.throws(()=>decryptChannelSecret(encrypted,opts,'cl2:x'));assert.throws(()=>decryptChannelSecret(encrypted,{...opts,environment:'production'},'cl1:x'));
 const otherServer=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',origin:'https://staging.example.test',host:'127.0.0.1'}));await new Promise<void>(resolve=>otherServer.listen(0,'127.0.0.1',resolve));try{const response=await fetch(`http://127.0.0.1:${(otherServer.address() as any).port}/api/channels/x/start`,{method:'POST',headers:{Cookie:clubCookie,'Content-Type':'application/json'},body:JSON.stringify({expectedVersion:0})});assert.equal(response.status,503);assert.equal((await response.json() as any).code,'channel_configuration_missing');}finally{await new Promise<void>(resolve=>otherServer.close(()=>resolve()));}
 assert.equal(providerDenied,false);assert(externalCalls.every(c=>!['/2/tweets','/feed','/media_publish'].some(p=>c.url.pathname.endsWith(p))),'no external post was attempted');
});


test('switching club with the same actor cannot apply an earlier club OAuth flow',async()=>{
 const flow=await start('x');await callback(flow,'x');
 await pool.query("INSERT INTO castiq.memberships(actor_id,club_id,actor_name,role) VALUES('getijde-club','cl2','Fictieve gecombineerde beheerder','club')");
 const token=randomBytes(32).toString('hex');await pool.query("INSERT INTO castiq.sessions(token_hash,actor_id,club_id,expires_at) VALUES($1,'getijde-club','cl2',now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex')]);
 const switched='castiq_session='+token;assert.equal((await request('/api/channels/flows/'+flow.flowId,'GET',undefined,switched)).status,404);assert.equal((await select(flow,'x','synthetic-x-account',switched)).status,404);assert.equal((await select(flow)).status,200);assert.equal((await pool.query("SELECT 1 FROM castiq.social_connections WHERE club_id='cl2' AND provider='x'")).rowCount,0);
});
test('expired selections erase staged tokens and uncertain revocation stays disabled until retry',async()=>{
 const flow=await start('instagram');await callback(flow,'instagram');assert((await pool.query('SELECT encrypted_candidates FROM castiq.social_oauth_flows WHERE id=$1',[flow.flowId])).rows[0].encrypted_candidates);await pool.query("UPDATE castiq.social_oauth_flows SET expires_at=now()-interval '1 second' WHERE id=$1",[flow.flowId]);assert.equal((await request('/api/channels/flows/'+flow.flowId,'GET',undefined,clubCookie)).body.status,'expired');const erased=(await pool.query('SELECT encrypted_verifier,encrypted_candidates FROM castiq.social_oauth_flows WHERE id=$1',[flow.flowId])).rows[0];assert.equal(erased.encrypted_verifier,null);assert.equal(erased.encrypted_candidates,null);
 providerDenied=true;let r=await request('/api/channels/x','DELETE',{expectedVersion:await providerVersion('x')},clubCookie);assert.equal(r.status,200);assert.equal(r.body.providers.find((p:any)=>p.provider==='x').status,'revocation_pending');await assert.rejects(assertSocialDestination(pool,'cl1','X-post'));assert((await pool.query("SELECT encrypted_tokens FROM castiq.social_connections WHERE club_id='cl1' AND provider='x'")).rows[0].encrypted_tokens);providerDenied=false;r=await request('/api/channels/x','DELETE',{expectedVersion:await providerVersion('x')},clubCookie);assert.equal(r.status,200);assert.equal(r.body.providers.find((p:any)=>p.provider==='x').status,'disconnected');assert.equal((await pool.query("SELECT encrypted_tokens FROM castiq.social_connections WHERE club_id='cl1' AND provider='x'")).rows[0].encrypted_tokens,null);
});
test('account erasure during a provider exchange cannot recreate an OAuth flow or audit actor reference',async()=>{
 const flow=await start('x'),original=social.fetch!,actor='getijde-club',pseudonym='erased:'+createHash('sha256').update('synthetic-erasure-proof').digest('hex');let erased=false;
 social.fetch=async(url,init)=>{
  if(!erased&&new URL(String(url)).pathname==='/2/oauth2/token'){
   erased=true;const db=await pool.connect();try{await db.query('BEGIN');await db.query("SELECT club_id FROM castiq.workspaces WHERE club_id='cl1' FOR UPDATE");await eraseIntegrationActorReferences(db,actor,pseudonym);await db.query('DELETE FROM castiq.memberships WHERE actor_id=$1',[actor]);await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  }
  return original(url,init);
 };
 // The application captured the options object at construction. Its injected
 // fetch delegates through this mutable test object via a second local server.
 const app=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',origin:'https://staging.example.test',host:'127.0.0.1',social}));await new Promise<void>(resolve=>app.listen(0,'127.0.0.1',resolve));
 try{const response=await fetch(`http://127.0.0.1:${(app.address() as any).port}/api/channels/oauth/x/callback?state=${flow.state}&code=synthetic-erasure-code`,{headers:{Cookie:flow.cookie},redirect:'manual'});assert.equal(response.status,303);assert.equal(erased,true);const row=(await pool.query('SELECT actor_id,status,encrypted_verifier,encrypted_candidates FROM castiq.social_oauth_flows WHERE id=$1',[flow.flowId])).rows[0];assert.equal(row.actor_id,pseudonym);assert.equal(row.status,'expired');assert.equal(row.encrypted_verifier,null);assert.equal(row.encrypted_candidates,null);assert.equal((await pool.query('SELECT 1 FROM castiq.social_events WHERE actor_id=$1',[actor])).rowCount,0);}finally{social.fetch=original;await new Promise<void>(resolve=>app.close(()=>resolve()));}
});
