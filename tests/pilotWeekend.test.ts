import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {once} from 'node:events';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import pg from 'pg';
import {createManagedPool,closeManagedPool,type PoolError} from '../server/databasePool.ts';
import {createApplication} from '../server/application.ts';
import {migrate} from '../database/migrate.ts';
import {seedFixtures} from '../server/fixtures.ts';
import {publicContentPayload} from '../src/v1Workflow.ts';

type Envelope={state:any;version:number;actor:any;result?:{itemId:string}};
const origin='http://127.0.0.1:4173';
const week='2026-11-02';

class Session {
 cookie='';
 workspace!:Envelope;
 readonly base:string;
 constructor(base:string){this.base=base;}
 async request(path:string,method='GET',data?:any){
  const response=await fetch(this.base+path,{method,headers:{Origin:origin,...(this.cookie?{Cookie:this.cookie}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)});
  const cookie=response.headers.get('set-cookie');if(cookie)this.cookie=cookie.split(';')[0];
  return {status:response.status,body:await response.json() as any};
 }
 async login(accountId:string){const response=await this.request('/api/session','POST',{accountId});assert.equal(response.status,200,`Fixture login ${accountId}`);return this.refresh();}
 async refresh(){const response=await this.request('/api/workspace');assert.equal(response.status,200,'Authenticated workspace read');this.workspace=response.body;return this.workspace;}
 async command(type:string,data:any,expectedVersion=this.workspace.version){
  const response=await this.request('/api/commands','POST',{type,data,expectedVersion});
  assert.equal(response.status,200,`${type}: ${response.body.error||response.status}`);this.workspace=response.body;return this.workspace;
 }
 item(id:string){const item=this.workspace.state.content.find((c:any)=>c.id===id);assert.ok(item,`Expected contribution ${id}`);return item;}
}

/** Real HTTP + PostgreSQL; the provider remains the explicitly named sandbox for every assertion. */
test('three fictional clubs complete a local pilot weekend with sandbox evidence only',{timeout:120000},async t=>{
 const connectionString=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
 assert.ok(connectionString,'TEST_DATABASE_URL or DATABASE_URL is required; integration tests never silently skip');
 const connection=new URL(connectionString);assert.ok(['127.0.0.1','localhost','[::1]'].includes(connection.hostname),'Pilot tests require a local PostgreSQL server');
 const databaseName=`castiq_pilot_${Date.now()}_${randomBytes(4).toString('hex')}`;
 const idleErrors:PoolError[]=[];
 const admin=createManagedPool({connectionString,max:2},error=>idleErrors.push(error));let created=false;let pool:pg.Pool|undefined;let server:Server|undefined;
 const uploadDir=await mkdtemp(join(tmpdir(),'castiq-pilot-'));
 t.after(async()=>{
  if(server){server.closeAllConnections();await new Promise<void>((resolve,reject)=>server!.close(error=>error?reject(error):resolve()));}
  if(pool)await closeManagedPool(pool);
  if(created)await admin.query(`DROP DATABASE "${databaseName}"`);
  await closeManagedPool(admin);await rm(uploadDir,{recursive:true,force:true});assert.deepEqual(idleErrors.map(error=>error.code),[],'Unexpected PostgreSQL idle errors must fail the pilot.');
 });
 await admin.query(`CREATE DATABASE "${databaseName}"`);created=true;
 connection.pathname='/'+databaseName;pool=createManagedPool({connectionString:connection.toString(),max:5},error=>idleErrors.push(error));
 await migrate(pool);await seedFixtures(pool);
 server=createServer(createApplication({pool,uploadDir,authMode:'local',appEnv:'local',host:'127.0.0.1',origin,commit:'local-pilot-test'}));server.listen(0,'127.0.0.1');await once(server,'listening');
 const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}`;
 const health=await fetch(base+'/api/health').then(r=>r.json()) as any;assert.equal(health.publicationMode,'sandbox-only');assert.equal(health.environment,'local');
 const clubs=['getijde','havenlicht','noordhaven'].map((prefix,index)=>({prefix,id:`cl${index+1}`,club:new Session(base),team:new Session(base),sponsorId:`cl${index+1}-pilot-sponsor`,mobileId:`cl${index+1}-pilot-mobile`,reportId:'',publishedVersion:0,receiptJobId:'',receiptPostId:'',frozenSponsorName:'',frozenTitle:'',correctedVersion:0}));

 await t.test('Friday: isolated club setup, sponsor agreement and repeatable clubweek',async()=>{
  for(const context of clubs){
   await context.club.login(context.prefix+'-club');await context.team.login(context.prefix+'-team');
   assert.equal(context.club.workspace.actor.clubId,context.id);assert.equal(context.team.workspace.actor.clubId,context.id);
   assert.ok(context.club.workspace.state.matches.every((m:any)=>m.id.startsWith(context.id+'-')));
   assert.ok(context.team.workspace.state.content.every((c:any)=>c.team==='O14-1'));
   const agreement={id:context.sponsorId,clubId:context.id,name:`Fictieve partner ${context.prefix}`,teams:['O14-1'],types:['Matchday','Einduitslag','Wedstrijdverslag'],start:'2026-11-01',end:'2026-11-30',target:4,frequency:'month',logo:'/assets/club-getijde.svg',active:true,priority:10};
   await context.club.command('sponsor.save',{agreement});
   const selection={week,teams:['Eerste elftal','O14-1','O10-1'],types:['Matchday','Einduitslag']};
   await context.club.command('week.generate',selection);const first=context.club.workspace.state.content.filter((c:any)=>c.origin==='clubweek');assert.equal(first.length,5);const ids=first.map((c:any)=>c.id).sort();
   assert.equal(first.filter((c:any)=>c.team==='O10-1'&&c.type==='Einduitslag').length,0);
   assert.ok(first.filter((c:any)=>c.team==='O14-1').every((c:any)=>c.sponsorAgreementId===context.sponsorId));
   assert.ok(first.every((c:any)=>c.status==='draft'&&c.jobs.length===0));
   await context.club.command('week.generate',selection);assert.deepEqual(context.club.workspace.state.content.filter((c:any)=>c.origin==='clubweek').map((c:any)=>c.id).sort(),ids);
   const staleVersion=context.club.workspace.version;
   const foreign=await context.club.request('/api/commands','POST',{type:'content.save',expectedVersion:staleVersion,data:{item:{id:'foreign',clubId:context.id==='cl1'?'cl2':'cl1',team:'O14-1',title:'Forbidden',type:'Clubnieuws'}}});assert.equal(foreign.status,403);
   await context.team.refresh();const otherTeam=context.club.workspace.state.content.find((c:any)=>c.team==='Eerste elftal');
   const denied=await context.team.request('/api/commands','POST',{type:'content.submit',expectedVersion:context.team.workspace.version,data:{id:otherTeam.id,expectedRevision:otherTeam.version}});assert.equal(denied.status,403);
  }
 });

 await t.test('Saturday: durable mobile draft, exact review, mixed channel outcomes and safe retry',async()=>{
  for(const context of clubs){
   await context.team.refresh();
   const form={id:context.mobileId,clubId:context.id,team:'O14-1',matchId:context.id+'-m1',type:'Wedstrijdverslag',title:'Robin Bakker brengt het team samen',caption:'ROBIN BAKKER speelt met plezier. Eindstand 3–2.',date:'2026-11-07T12:00:00+01:00',photoUsage:'photo',photoConsent:context.id==='cl3'?'denied':'approved',image:'/assets/team-celebration.webp',namePolicy:'full',rawPlayerName:'Robin Bakker',homeScore:3,awayScore:2,scoreConfirmed:true,family:'Penseelkracht',sponsorAgreementId:context.sponsorId};
   await context.team.command('draft.save',{key:'mobile-pilot',draft:{form,savedAt:'2026-11-07T11:00:00Z'}});
   const restored=new Session(base);restored.cookie=context.team.cookie;await restored.refresh();assert.equal(restored.workspace.state.v1.drafts['mobile-pilot'].form.caption,form.caption);assert.equal(restored.workspace.state.v1.drafts['mobile-pilot'].form.id,context.mobileId);
   await context.team.command('content.save',{item:form});let item=context.team.item(context.mobileId);
   const beforeSubmit=context.team.workspace.version;
   await context.team.command('content.submit',{id:item.id,expectedRevision:item.version});
   const duplicate=await context.team.request('/api/commands','POST',{type:'content.submit',expectedVersion:beforeSubmit,data:{id:item.id,expectedRevision:item.version}});assert.equal(duplicate.status,409);
   await context.club.refresh();item=context.club.item(context.mobileId);
   if(context.id==='cl3'){
    const denied=await context.club.request('/api/commands','POST',{type:'content.approve',expectedVersion:context.club.workspace.version,data:{id:item.id,expectedRevision:item.version}});assert.equal(denied.status,400);
    await context.team.refresh();await context.team.command('content.save',{item:{...form,photoUsage:'no_photo',image:''},expectedRevision:item.version});await context.club.refresh();item=context.club.item(context.mobileId);
   }
   const wrongRevision=await context.club.request('/api/commands','POST',{type:'content.approve',expectedVersion:context.club.workspace.version,data:{id:item.id,expectedRevision:item.version+1}});assert.equal(wrongRevision.status,409);
   await context.club.command('content.approve',{id:item.id,expectedRevision:item.version});context.publishedVersion=item.version;
   for(const channel of ['Instagram-feed','Facebook-feed','X-post'])await context.club.command('publication.queue',{id:item.id,expectedRevision:item.version,channel});
   item=context.club.item(item.id);assert.equal(item.jobs.length,3);assert.ok(item.jobs.every((j:any)=>!j.receipt&&j.adapter==='explicit-sandbox'));
   await context.club.command('publication.queue',{id:item.id,expectedRevision:item.version,channel:'Instagram-feed'});assert.equal(context.club.item(item.id).jobs.length,3);
   const instagram=context.club.item(item.id).jobs.find((j:any)=>j.channel==='Instagram-feed'),facebook=context.club.item(item.id).jobs.find((j:any)=>j.channel==='Facebook-feed'),x=context.club.item(item.id).jobs.find((j:any)=>j.channel==='X-post');
   await context.club.command('publication.sandbox',{id:item.id,jobId:instagram.id,outcome:'confirmed'});
   await context.club.command('publication.sandbox',{id:item.id,jobId:facebook.id,outcome:'timeout'});
   await context.club.command('publication.sandbox',{id:item.id,jobId:x.id,outcome:'failed'});
   item=context.club.item(item.id);assert.notEqual(item.status,'published');assert.equal(item.jobs.find((j:any)=>j.id===facebook.id).receipt,undefined);
   for(const job of [facebook,x]){
    await context.club.command('publication.retry',{id:item.id,jobId:job.id});const retried=context.club.item(item.id).jobs.find((j:any)=>j.id===job.id);assert.equal(retried.requestId,job.requestId);assert.equal(retried.dedupeKey,job.dedupeKey);assert.equal(retried.attempt,2);if(job.id===facebook.id)assert.equal(retried.reconciling,true);
    await context.club.command('publication.sandbox',{id:item.id,jobId:job.id,outcome:'confirmed'});
   }
   item=context.club.item(item.id);assert.equal(item.status,'published');assert.ok(item.jobs.every((j:any)=>j.receipt.kind==='demo'&&j.providerMode==='demo'));
   context.receiptJobId=instagram.id;context.receiptPostId=item.jobs.find((j:any)=>j.id===instagram.id).receipt.providerPostId;context.frozenSponsorName=instagram.payload.sponsorName;context.frozenTitle=instagram.payload.title;
   assert.doesNotMatch(context.frozenTitle,/Bakker/i);if(context.id==='cl3'){assert.equal(instagram.payload.playerName,'Speler');assert.equal(instagram.payload.image,'');}
   const published=await pool!.query('SELECT count(*)::int AS n FROM castiq.receipts WHERE club_id=$1 AND kind=\'demo\'',[context.id]);assert.equal(published.rows[0].n,3);
  }
 });

 await t.test('Sunday: source correction cancels old overview jobs and rebuilding keeps exact versions',async()=>{
  for(const context of clubs){
   const options={week,teams:['O14-1','O10-1'],intro:'Fictieve pilot: ieder team hoort erbij.',includeScores:true};
   await context.club.command('weekend.generate',options);let report=context.club.workspace.state.content.find((c:any)=>c.origin==='weekend'&&c.weekKey===week);assert.ok(report);context.reportId=report.id;
   assert.equal(report.staleDerived,false);assert.equal(report.reportSourceVersions.find((r:any)=>r.contentId===context.mobileId).version,context.publishedVersion);
   const o10=publicContentPayload(report).reportEntries.find((e:any)=>e.team==='O10-1');assert.ok(o10);assert.equal(o10.score,undefined);assert.equal(o10.homeScore,undefined);
   await context.club.command('content.submit',{id:report.id,expectedRevision:report.version});await context.club.command('content.approve',{id:report.id,expectedRevision:report.version});await context.club.command('publication.queue',{id:report.id,expectedRevision:report.version,channel:'Facebook-feed'});const oldJob=context.club.item(report.id).jobs[0];
   await context.club.command('match.correct',{id:context.id+'-m1',home:4,away:2,reason:'Fictieve pilotcorrectie: doelpunt ontbrak'});
   report=context.club.item(report.id);const corrected=context.club.item(context.mobileId);context.correctedVersion=corrected.version;
   assert.equal(corrected.version,context.publishedVersion+1);assert.equal(corrected.approvedVersion,undefined);assert.equal(corrected.jobs.filter((j:any)=>j.receipt?.kind==='demo').length,3);
   assert.equal(report.staleDerived,true);assert.equal(report.approvedVersion,undefined);assert.equal(report.jobs.find((j:any)=>j.id===oldJob.id).status,'cancelled');
   const late=await context.club.command('publication.sandbox',{id:report.id,jobId:oldJob.id,outcome:'confirmed'});assert.equal(late.state.content.find((c:any)=>c.id===report.id).jobs.find((j:any)=>j.id===oldJob.id).receipt,undefined);
   const staleApproval=await context.club.request('/api/commands','POST',{type:'content.approve',expectedVersion:context.club.workspace.version,data:{id:report.id,expectedRevision:report.version}});assert.equal(staleApproval.status,400);
   await context.club.command('content.approve',{id:corrected.id,expectedRevision:corrected.version});
   await context.club.command('weekend.generate',options);report=context.club.item(context.reportId);assert.equal(context.club.workspace.state.content.filter((c:any)=>c.origin==='weekend'&&c.weekKey===week).length,1);assert.equal(report.staleDerived,false);assert.equal(report.reportSourceVersions.find((r:any)=>r.contentId===context.mobileId).version,corrected.version);assert.equal(report.reportEntries.find((e:any)=>e.team==='O14-1').score,'4 – 2');
   await context.club.command('content.approve',{id:report.id,expectedRevision:report.version});await context.club.command('publication.queue',{id:report.id,expectedRevision:report.version,channel:'Facebook-feed'});
   const rebuilt=context.club.item(report.id),job=rebuilt.jobs.find((j:any)=>j.version===rebuilt.version&&j.status==='queued');assert.ok(job);assert.equal(job.payload.version,rebuilt.approvedVersion);await context.club.command('publication.sandbox',{id:report.id,jobId:job.id,outcome:'confirmed'});
   const history=await pool!.query('SELECT revision,snapshot FROM castiq.revisions WHERE club_id=$1 AND content_id=$2 ORDER BY revision',[context.id,context.mobileId]);const originalPublication=history.rows.find((r:any)=>r.revision===context.publishedVersion);assert.ok(originalPublication);assert.match(originalPublication.snapshot.caption,/3[–-]2/);assert.match(history.rows.at(-1).snapshot.caption,/4[–-]2/);
  }
 });

 await t.test('Monday: sponsor evidence stays frozen and local receipts never count as external proof',async()=>{
  for(const context of clubs){
   const agreement=context.club.workspace.state.v1.sponsorAgreements.find((a:any)=>a.id===context.sponsorId);await context.club.command('sponsor.save',{agreement:{...agreement,name:'Gewijzigde sponsor na publicatie',frequency:'week'}});
   const item=context.club.item(context.mobileId),old=item.jobs.find((j:any)=>j.id===context.receiptJobId);assert.equal(old.payload.sponsorName,context.frozenSponsorName);assert.equal(old.title,context.frozenTitle);assert.equal(old.receipt.providerPostId,context.receiptPostId);assert.equal(old.receipt.sponsorAgreementId,context.sponsorId);assert.equal(old.receipt.kind,'demo');
   const receipts=await pool!.query('SELECT r.kind,r.revision,r.evidence,j.payload,j.provider_mode FROM castiq.receipts r JOIN castiq.jobs j ON j.id=r.job_id WHERE r.club_id=$1 AND j.content_id=$2 ORDER BY r.job_id',[context.id,context.mobileId]);assert.equal(receipts.rows.length,3);
   for(const receipt of receipts.rows){assert.equal(receipt.kind,'demo');assert.equal(receipt.provider_mode,'demo');assert.equal(receipt.revision,context.publishedVersion);assert.equal(receipt.evidence.sponsorName,context.frozenSponsorName);assert.equal(receipt.payload.sponsorAgreementId,context.sponsorId);assert.match(receipt.evidence.notice,/niet extern/);}
   const confirmedAt=new Date(old.receipt.confirmedAt),periodStart=new Date(Date.UTC(confirmedAt.getUTCFullYear(),confirmedAt.getUTCMonth(),1)),periodEnd=new Date(Date.UTC(confirmedAt.getUTCFullYear(),confirmedAt.getUTCMonth()+1,1));
   const counts=await pool!.query("SELECT count(*)::int AS placements,count(DISTINCT j.content_id)::int AS contributions FROM castiq.receipts r JOIN castiq.jobs j ON j.id=r.job_id WHERE r.club_id=$1 AND r.evidence->>'sponsorAgreementId'=$2 AND (r.evidence->>'confirmedAt')::timestamptz >= $3 AND (r.evidence->>'confirmedAt')::timestamptz < $4",[context.id,context.sponsorId,periodStart.toISOString(),periodEnd.toISOString()]);assert.equal(counts.rows[0].placements,3);assert.equal(counts.rows[0].contributions,1);
   const weeks=await pool!.query("SELECT count(*) FILTER (WHERE date_trunc('week',(evidence->>'confirmedAt')::timestamptz AT TIME ZONE 'Europe/Amsterdam')=date_trunc('week',$3::timestamptz AT TIME ZONE 'Europe/Amsterdam'))::int AS current_week,count(*) FILTER (WHERE date_trunc('week',(evidence->>'confirmedAt')::timestamptz AT TIME ZONE 'Europe/Amsterdam')=date_trunc('week',$3::timestamptz AT TIME ZONE 'Europe/Amsterdam')+interval '7 days')::int AS next_week FROM castiq.receipts WHERE club_id=$1 AND evidence->>'sponsorAgreementId'=$2",[context.id,context.sponsorId,confirmedAt.toISOString()]);assert.equal(weeks.rows[0].current_week,3);assert.equal(weeks.rows[0].next_week,0);
   await context.team.refresh();assert.deepEqual(context.team.workspace.state.v1.sponsorAgreements,[]);assert.ok(context.team.workspace.state.content.every((c:any)=>c.clubId===context.id&&c.team==='O14-1'));
   const foreignId=clubs.find(c=>c.id!==context.id)!.mobileId;const foreign=await context.team.request('/api/commands','POST',{type:'content.submit',expectedVersion:context.team.workspace.version,data:{id:foreignId,expectedRevision:1}});assert.equal(foreign.status,404);assert.equal(foreign.body.code,'not_found');
  }
  const platform=new Session(base);await platform.login('platform');assert.deepEqual(platform.workspace.state.content,[]);assert.deepEqual(platform.workspace.state.matches,[]);
  const external=await pool!.query("SELECT count(*)::int AS n FROM castiq.receipts WHERE kind <> 'demo'");assert.equal(external.rows[0].n,0);
 });
});
