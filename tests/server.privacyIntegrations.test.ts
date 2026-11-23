import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../database/migrate.ts';
import {seedFixtures} from '../server/fixtures.ts';
import {createTemplateLibrary} from '../server/templateLibrary.ts';
import {createPrivacyService} from '../server/privacy.ts';
import {createFileDeletionLedger,initializeFileDeletionLedger,privacyReference} from '../server/privacyLedger.ts';
import {LEGAL_DOCUMENTS} from '../shared/legalDocuments.ts';
const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL,actor='synthetic-design-admin',other='synthetic-other-admin',key='synthetic-privacy-reference-key-32-characters';
let pool:pg.Pool,admin:pg.Pool,database:string,dir:string,limitedRole:string,templateId:string,requestId:string,flowId:string,otherFlowId:string,service:ReturnType<typeof createPrivacyService>;
let now='2026-11-23T12:00:00.000Z';
const immutable=['template_versions','template_audit','plan_policies','plan_events','social_events','integration_events'];
const actorColumn=(table:string)=>table==='plan_policies'?'created_by':'actor_id';
let originalRows:Record<string,any[]>={};
before(async()=>{
 if(!connection)throw new Error('Lokale testdatabase ontbreekt.');const url=new URL(connection);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Privacy-integratietests gebruiken uitsluitend een eigen tijdelijke localhostdatabase.');
 admin=new pg.Pool({connectionString:connection});database='castiq_privacy_integrations_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${database}`);url.pathname='/'+database;pool=new pg.Pool({connectionString:url.href});await migrate(pool);await seedFixtures(pool);dir=await mkdtemp(join(tmpdir(),'castiq-privacy-integrations-'));await initializeFileDeletionLedger(dir,{environmentId:'isolated-privacy-integrations',confirmedEmptyScope:true});
 service=createPrivacyService({pool,documents:LEGAL_DOCUMENTS,clock:()=>new Date(now),referenceKey:key,ledger:createFileDeletionLedger(dir),revokeIdentitySessions:async()=>{},deleteIdentity:async()=>{},erasePersonalMail:async()=>{}});
 await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,status,registration_completed_at,last_conscious_at,reliable_activity) VALUES($1,'active',$2,$2,true)",[actor,now]);
 await pool.query("INSERT INTO castiq.memberships(actor_id,club_id,actor_name,role) VALUES($1,'cl1','Synthetic club administrator','club'),($2,'cl1','Other synthetic administrator','club')",[actor,other]);
 const library=createTemplateLibrary(pool),platform={id:actor,name:'Synthetic platform administrator',role:'platform' as const,clubId:'__platform__'};
 const first=(await library.list(platform)).templates[0];let template=(await library.create(platform,{name:'Shared retained design',family:first.family,postType:'news',layouts:first.versions[0].layouts})).template;
 template=(await library.mutate(platform,template.id,{operation:'publish',expectedRevision:template.revision,layouts:template.draft.layouts})).template;templateId=template.id;
 const policy=(await pool.query('SELECT document FROM castiq.plan_policies WHERE version=1')).rows[0].document;await pool.query('INSERT INTO castiq.plan_policies(version,document,created_by) VALUES(2,$1,$2)',[JSON.stringify(policy),actor]);
 await pool.query("INSERT INTO castiq.plan_events(id,club_id,actor_id,action,snapshot) VALUES($1,'cl1',$2,'choice.saved',$3)",[randomUUID(),actor,JSON.stringify({policyVersion:2,plan:'Club',partnerLogo:true})]);
 await pool.query("INSERT INTO castiq.club_plan_choices(club_id,version,plan_name,opted_in,accepted_policy_version,updated_by) VALUES('cl1',1,'Club',true,2,$1)",[actor]);
 await pool.query("INSERT INTO castiq.social_connections(club_id,provider,version,account_id,account_name,account_type,destinations,scopes,encrypted_tokens,status,updated_by) VALUES('cl1','instagram',1,'synthetic-club-account','Synthetic club account','business','[\"Instagram-feed\"]','[]','synthetic-club-owned-ciphertext','connected',$1)",[actor]);
 for(const owner of[actor,other]){const id=randomUUID();if(owner===actor)flowId=id;else otherFlowId=id;await pool.query("INSERT INTO castiq.social_oauth_flows(id,club_id,actor_id,provider,state_hash,nonce_hash,encrypted_verifier,encrypted_candidates,candidates,status,expires_at) VALUES($1,'cl1',$2,'instagram',$3,$4,'synthetic-verifier','synthetic-candidates','[{\"id\":\"synthetic-account\"}]','pending',now()+interval '1 day')",[id,owner,randomUUID(),randomUUID()]);}
 await pool.query("INSERT INTO castiq.social_events(id,club_id,actor_id,provider,action,metadata) VALUES($1,'cl1',$2,'instagram','connection.selected','{\"version\":1}')",[randomUUID(),actor]);
 await pool.query("INSERT INTO castiq.club_integrations(club_id,provider,public_config,encrypted_config,enabled,updated_by) VALUES('cl1','sportlink','{\"clubCode\":\"synthetic-club\"}','synthetic-integration-ciphertext',true,$1)",[actor]);
 await pool.query("INSERT INTO castiq.integration_events(id,club_id,provider,actor_id,action) VALUES($1,'cl1','sportlink',$2,'configuration.saved')",[randomUUID(),actor]);
 requestId=randomUUID();await pool.query("INSERT INTO castiq.template_requests(id,club_id,title,brief,review_note,created_by,updated_by,reviewed_by) VALUES($1,'cl1','Personal request title','Personal free-text brief','Personal reviewer note',$2,$2,$2)",[requestId,actor]);await pool.query("INSERT INTO castiq.template_request_events(id,request_id,actor_id,action,revision,metadata) VALUES($1,$2,$3,'created',1,'{\"status\":\"Nieuw\"}')",[randomUUID(),requestId,actor]);
 for(const table of immutable)originalRows[table]=(await pool.query(`SELECT * FROM castiq.${table} WHERE ${actorColumn(table)}=$1 ORDER BY ${table==='template_versions'?'published_at':'created_at'}`,[actor])).rows;
});
after(async()=>{if(pool)await pool.end();if(admin){try{if(database)await admin.query(`DROP DATABASE IF EXISTS ${database}`);if(limitedRole)await admin.query(`DROP ROLE IF EXISTS ${limitedRole}`);}finally{await admin.end();}}if(dir)await rm(dir,{recursive:true,force:true});});

test('personal export includes request and integration actions without authorization material',async()=>{
 const result=await service.personalExport({id:actor,authenticatedAt:now});assert.equal(result.templateRequests.length,1);assert.equal(result.templateRequests[0].brief,'Personal free-text brief');assert.equal(result.templateActions.length,2);assert.equal(result.planActions.length,1);assert.equal(result.socialActions.length,1);assert.equal(result.integrationActions.length,1);const output=JSON.stringify(result);for(const forbidden of['synthetic-verifier','synthetic-candidates','synthetic-club-owned-ciphertext','synthetic-integration-ciphertext'])assert(!output.includes(forbidden));
});
test('account deletion pseudonymizes all new actor references, cancels only own pending consent and preserves shared configurations',async()=>{
 const deletion=await service.blockDeletion({id:actor,authenticatedAt:now});now=deletion.deadline!;await pool.query('UPDATE castiq.privacy_retention_control SET destructive_enabled=true,dry_run_verified_at=$1,restore_verified_at=$1,transition_verified_at=$1,provider_retention_verified_at=$1 WHERE singleton=true',[now]);assert.equal((await service.executeDeletion(deletion.id)).completed,true);
 const pseudonym='erased:'+privacyReference(actor,key);
 for(const table of immutable){assert.equal((await pool.query(`SELECT count(*)::integer AS n FROM castiq.${table} WHERE ${actorColumn(table)}=$1`,[actor])).rows[0].n,0);const after=(await pool.query(`SELECT * FROM castiq.${table} WHERE ${actorColumn(table)}=$1 ORDER BY ${table==='template_versions'?'published_at':'created_at'}`,[pseudonym])).rows;const strip=(row:any)=>{const copy={...row};delete copy[actorColumn(table)];return copy;};assert.deepEqual(after.map(strip),originalRows[table].map(strip),table+' immutable payload preserved');}
 for(const table of['club_plan_choices','social_connections','club_integrations'])assert.equal((await pool.query(`SELECT updated_by FROM castiq.${table} WHERE club_id='cl1'`)).rows[0].updated_by,pseudonym);
 const connection=(await pool.query("SELECT * FROM castiq.social_connections WHERE club_id='cl1' AND provider='instagram'")).rows[0];assert.equal(connection.encrypted_tokens,'synthetic-club-owned-ciphertext');assert.equal(connection.status,'connected');assert.equal(connection.version,1);
 const integration=(await pool.query("SELECT * FROM castiq.club_integrations WHERE club_id='cl1' AND provider='sportlink'")).rows[0];assert.equal(integration.encrypted_config,'synthetic-integration-ciphertext');assert.equal(integration.enabled,true);
 const flow=(await pool.query('SELECT * FROM castiq.social_oauth_flows WHERE id=$1',[flowId])).rows[0];assert.equal(flow.actor_id,pseudonym);assert.equal(flow.status,'expired');assert.equal(flow.encrypted_verifier,null);assert.equal(flow.encrypted_candidates,null);assert.deepEqual(flow.candidates,[]);
 const otherFlow=(await pool.query('SELECT * FROM castiq.social_oauth_flows WHERE id=$1',[otherFlowId])).rows[0];assert.equal(otherFlow.actor_id,other);assert.equal(otherFlow.status,'pending');assert.equal(otherFlow.encrypted_verifier,'synthetic-verifier');
 const request=(await pool.query('SELECT * FROM castiq.template_requests WHERE id=$1',[requestId])).rows[0];assert.equal(request.title,'Verwijderde aanvraag');assert.equal(request.brief,'');assert.equal(request.review_note,'');assert.equal(request.created_by,pseudonym);assert.equal(request.updated_by,pseudonym);assert.equal(request.reviewed_by,pseudonym);
 assert.equal((await pool.query('SELECT actor_id FROM castiq.template_request_events WHERE request_id=$1',[requestId])).rows[0].actor_id,pseudonym);assert.equal((await pool.query('SELECT count(*)::integer AS n FROM castiq.memberships WHERE actor_id=$1',[other])).rows[0].n,1);assert.equal((await pool.query('SELECT count(*)::integer AS n FROM castiq.templates WHERE id=$1',[templateId])).rows[0].n,1);
});
test('new history guards reject arbitrary updates and grant runtime only the pseudonymizable column',async()=>{
 limitedRole='castiq_privacy_history_'+randomUUID().replaceAll('-','');await admin.query(`CREATE ROLE ${limitedRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);await pool.query(`GRANT USAGE ON SCHEMA castiq TO ${limitedRole}`);
 for(const table of immutable){await pool.query(`GRANT SELECT ON castiq.${table} TO ${limitedRole}`);await pool.query(`CREATE POLICY privacy_history_test ON castiq.${table} TO ${limitedRole} USING(true) WITH CHECK(true)`);}
 const sql=await readFile(new URL('../database/migrations/014_privacy_integration_history.sql',import.meta.url),'utf8');await pool.query(sql.slice(sql.indexOf('DO $$ BEGIN'),sql.lastIndexOf('COMMIT;')).replaceAll('castiq_runtime',limitedRole));
 const db=await pool.connect();try{for(const table of immutable){const column=actorColumn(table);for(const[statement,flag]of[[`UPDATE castiq.${table} SET ${column}='forged'`,false],[`UPDATE castiq.${table} SET ${column}='erased:invalid'`,true],[`DELETE FROM castiq.${table}`,true]]){await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);if(flag)await db.query("SELECT set_config('castiq.privacy_erasure','on',true)");await assert.rejects(db.query(statement as string),error=>['42501','P0001'].includes((error as any).code));await db.query('ROLLBACK');}
 await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);await db.query("SELECT set_config('castiq.privacy_erasure','on',true)");await db.query(`UPDATE castiq.${table} SET ${column}=$1 WHERE ${column}=$2`,['erased:'+'c'.repeat(64),'erased:'+privacyReference(actor,key)]);await db.query('ROLLBACK');
 }await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);await db.query("SELECT set_config('castiq.privacy_erasure','on',true)");await assert.rejects(db.query("UPDATE castiq.plan_policies SET document='{}'"),error=>(error as any).code==='42501');await db.query('ROLLBACK');
 }finally{await db.query('ROLLBACK');db.release();}
});
