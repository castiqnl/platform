import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import type pg from 'pg';
import {createManagedPool,closeManagedPool} from '../server/databasePool.ts';
import {migrate} from '../database/migrate.ts';
import {seedFixtures,fixtureAccounts} from '../server/fixtures.ts';
import {createApplication} from '../server/application.ts';
import {platformOperations} from '../server/platformOperations.ts';
import {listClubs,listAccounts,createClub,assignMembership} from '../server/administration.ts';
import type {PlatformOperations} from '../src/platformOperationsTypes.ts';
const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let pool:pg.Pool,admin:pg.Pool,server:Server,base:string,dir:string,database:string;
const platform=fixtureAccounts.find(actor=>actor.role==='platform')!;
const club=fixtureAccounts.find(actor=>actor.id==='getijde-club')!;
async function request(path:string,session='',method='GET',data?:unknown){const response=await fetch(base+path,{method,headers:{...(session?{Cookie:session}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
async function login(id:string){const response=await request('/api/session','','POST',{accountId:id});assert.equal(response.status,200);return response.cookie;}
before(async()=>{
  if(!connection)throw new Error('Een geïsoleerde lokale testdatabase is verplicht.');
  const url=new URL(connection);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Platformtests gebruiken uitsluitend een tijdelijke localhostdatabase.');
  admin=createManagedPool({connectionString:connection});database='castiq_platform_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${database}`);
  url.pathname='/'+database;pool=createManagedPool({connectionString:url.href});await migrate(pool);await seedFixtures(pool);
  dir=await mkdtemp(join(tmpdir(),'castiq-platform-'));server=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',host:'127.0.0.1',origin:'http://127.0.0.1:4173'}));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
});
after(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));if(pool)await closeManagedPool(pool);if(admin){try{if(database)await admin.query(`DROP DATABASE IF EXISTS ${database}`);}finally{await closeManagedPool(admin);}}if(dir)await rm(dir,{recursive:true,force:true});});

test('operations enforce the platform role, including direct HTTP and revoked sessions',async()=>{
  for(const actor of fixtureAccounts.filter(actor=>actor.role!=='platform'))await assert.rejects(platformOperations(pool,actor),(error:any)=>error.status===403);
  assert.equal((await request('/api/admin/operations')).status,401);
  const own=await login('getijde-club'),other=await login('havenlicht-club'),team=await login('getijde-team');
  for(const session of [own,other,team])assert.equal((await request('/api/admin/operations',session)).status,403);
  const adminSession=await login('platform');assert.equal((await request('/api/admin/operations',adminSession)).status,200);
  await pool.query("UPDATE castiq.memberships SET expires_at=now()-interval '1 second' WHERE actor_id='platform'");
  try{assert.equal((await request('/api/admin/operations',adminSession)).status,401);}finally{await pool.query("UPDATE castiq.memberships SET expires_at=NULL WHERE actor_id='platform'");}
});

test('valid zero sources are explicit and contain no personal account or privacy details',async()=>{
  const result=await platformOperations(pool,platform);
  assert.equal(result.sources.jobs.status,'ok');if(result.sources.jobs.status!=='ok')return;
  assert.equal(result.sources.jobs.data.total,0);assert.deepEqual(result.sources.jobs.data.items,[]);
  assert.equal(result.sources.privacy.status,'ok');if(result.sources.privacy.status==='ok')assert.deepEqual(result.sources.privacy.data,{open:0,nextDeadline:null});
  assert.equal(result.sources.mail.status,'ok');if(result.sources.mail.status==='ok')assert.equal(result.sources.mail.data.incidents,0);
  assert(!JSON.stringify(result).includes('actor_name'));assert(!JSON.stringify(result).includes('email'));
});

test('full-table status counts use matching receipts and return only whitelisted bounded job metadata',async()=>{
  await pool.query("INSERT INTO castiq.revisions(club_id,content_id,revision,content_hash,snapshot,actor_id) VALUES('cl1','private-content',1,'hash','{\"title\":\"NEVER_PLATFORM_CONTENT\",\"players\":[\"NEVER_PLATFORM_PLAYER\"],\"image\":\"NEVER_PLATFORM_PHOTO\"}','getijde-club')");
  const statuses=['failed','awaiting_confirmation','queued','paused','published','published','cancelled','private-provider-error'];
  for(const [index,status] of statuses.entries()){
    const id='operational-'+index;
    await pool.query("INSERT INTO castiq.jobs(id,club_id,content_id,revision,idempotency_key,provider_request_id,provider_mode,payload,content_hash,status,state) VALUES($1,'cl1','private-content',1,$1,$1,'demo','{\"title\":\"NEVER_PLATFORM_CONTENT\"}','hash',$2,$3)",[id,status,JSON.stringify({channel:index===7?'NEVER_PLATFORM_CHANNEL_SECRET':'Instagram-feed',error:'NEVER_PLATFORM_ERROR',receipt:{kind:'provider',providerPostId:'forged-state-only'}})]);
    if(index===4)await pool.query("INSERT INTO castiq.receipts(job_id,club_id,revision,kind,provider_post_id,evidence) VALUES($1,'cl1',1,'demo','demo-proof','{\"token\":\"NEVER_PLATFORM_RECEIPT_SECRET\"}')",[id]);
  }
  await pool.query("INSERT INTO castiq.jobs(id,club_id,content_id,revision,idempotency_key,provider_request_id,provider_mode,payload,content_hash,status,state) SELECT 'limit-'||n,'cl1','private-content',1,'limit-'||n,'limit-'||n,'demo','{}','hash','scheduled','{\"channel\":\"Facebook-feed\"}' FROM generate_series(1,202) n");
  const result=await platformOperations(pool,platform);assert.equal(result.sources.jobs.status,'ok');if(result.sources.jobs.status!=='ok')return;
  const jobs=result.sources.jobs.data;assert.equal(jobs.total,210);assert.equal(jobs.items.length,200);assert.equal(jobs.truncated,true);
  assert.deepEqual(jobs.counts,{failed:1,awaiting_confirmation:2,in_progress:203,paused:1,published:1,cancelled:1,other:1});
  assert.equal(Object.values(jobs.counts).reduce((a,b)=>a+b),jobs.total);
  const serialized=JSON.stringify(result);for(const forbidden of ['NEVER_PLATFORM','private-content','payload','contentId','actor_name','evidence','provider_request_id'])assert(!serialized.includes(forbidden),forbidden);
  for(const job of jobs.items)assert.deepEqual(Object.keys(job).sort(),['id','clubId','clubName','channel','status','group','revision','attempt','scheduledAt','confirmedAt','confirmation','providerMode'].sort());
  const session=await login('platform');const response=await request('/api/admin/operations',session);assert.equal(response.status,200);assert.equal((response.body as PlatformOperations).sources.jobs.status,'ok');assert(!JSON.stringify(response.body).includes('NEVER_PLATFORM'));
});

test('an unavailable source stays distinct from zero while independent sources succeed',async()=>{
  await pool.query('ALTER TABLE castiq.mail_outbox RENAME TO unavailable_mail_outbox');
  try{const result=await platformOperations(pool,platform);assert.deepEqual(result.sources.mail,{status:'unavailable'});assert.equal(result.sources.jobs.status,'ok');assert.equal(result.sources.registrations.status,'ok');assert.equal(result.sources.privacy.status,'ok');assert(!JSON.stringify(result).includes('does not exist'));}finally{await pool.query('ALTER TABLE castiq.unavailable_mail_outbox RENAME TO mail_outbox');}
});

test('club directory counts exclude expired, blocked and legacy platform memberships without exposing content',async()=>{
  await pool.query("INSERT INTO castiq.memberships(actor_id,club_id,actor_name,role,expires_at) VALUES('expired-role','cl1','Hidden personal name','club',now()-interval '1 hour'),('legacy-platform','cl1','Hidden mixed name','club',NULL),('legacy-platform','__platform__','Hidden mixed name','platform',NULL),('blocked-role','cl1','Hidden blocked name','club',NULL)");
  await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,email,status) VALUES('blocked-role','private@example.invalid','deletion_pending')");
  const result=await listClubs(pool,platform);assert.equal(result.clubs.find(item=>item.id==='cl1')?.members,3);
  const serialized=JSON.stringify(result);for(const forbidden of ['Hidden','private@example.invalid','content','players','drafts','photo'])assert(!serialized.includes(forbidden));
  await assert.rejects(listClubs(pool,club),(error:any)=>error.status===403);
});

test('registration list is limited to the most recent 200 with a truthful truncation flag',async()=>{
  await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,email,status,registration_started_at) SELECT 'registrant-'||n,'synthetic-'||n||'@example.invalid','registration_pending','2026-01-01'::timestamptz+n*interval '1 second' FROM generate_series(1,205) n");
  const result=await listAccounts(pool,platform);assert.equal(result.truncated,true);assert.equal(result.accounts.length,200);assert(result.total>=206);
  assert(result.accounts.some(account=>account.id==='registrant-205'));assert(!result.accounts.some(account=>account.id==='registrant-1'));
  const operations=await platformOperations(pool,platform);assert.equal(operations.sources.registrations.status,'ok');if(operations.sources.registrations.status==='ok')assert.equal(operations.sources.registrations.data.pending,205);
});

test('existing club creation and role assignment remain authoritative and require recent platform authentication',async()=>{
  await assert.rejects(createClub(pool,platform,{name:'Testclub'},false),(error:any)=>error.code==='recent_auth_required');
  await assert.rejects(createClub(pool,club,{name:'Testclub'},true),(error:any)=>error.status===403);
  const created=await createClub(pool,platform,{name:'Afgescheiden testvereniging',color:'#123456',accent:'#abcdef'},true);
  const workspace=(await pool.query('SELECT state FROM castiq.workspaces WHERE club_id=$1',[created.club.id])).rows[0].state;
  for(const field of ['content','players','teams','matches'])assert.deepEqual(workspace[field],[]);assert.equal(workspace.v1.publicationPaused,true);
  await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,email,status) VALUES('active-new-member','active-new-member@example.invalid','active'),('pending-new-member','pending-new-member@example.invalid','registration_pending'),('platform','platform@example.invalid','active')");
  await assert.rejects(assignMembership(pool,platform,created.club.id,{actorId:'pending-new-member',role:'club'},true),(error:any)=>error.code==='registration_required');
  await assert.rejects(assignMembership(pool,platform,created.club.id,{actorId:'platform',role:'club'},true),(error:any)=>error.code==='platform_club_separation');
  await assert.rejects(assignMembership(pool,platform,created.club.id,{actorId:'active-new-member',role:'team',team:'Niet bestaand'},true),(error:any)=>error.code==='invalid_team');
  await assignMembership(pool,platform,created.club.id,{actorId:'active-new-member',role:'club'},true);
  const directory=await listClubs(pool,platform);assert.equal(directory.clubs.find(item=>item.id===created.club.id)?.members,1);
  const session=await login('havenlicht-club');const response=await request('/api/commands',session,'POST',{type:'club.settings',data:{clubId:created.club.id,club:{name:'Verboden'}},expectedVersion:1});assert.equal(response.status,403,JSON.stringify(response.body));
  const roleResponse=await request(`/api/admin/clubs/${created.club.id}/memberships`,session,'PUT',{actorId:'active-new-member',role:'club'});assert.equal(roleResponse.status,403);
});
