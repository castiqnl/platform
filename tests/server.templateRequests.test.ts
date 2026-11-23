import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../database/migrate.ts';
import {seedFixtures} from '../server/fixtures.ts';
import {createApplication} from '../server/application.ts';
import {stampContentTemplate} from '../server/templateLibrary.ts';
import {pseudonymizeTemplateRequestActor} from '../server/templateRequests.ts';
const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let pool:pg.Pool,admin:pg.Pool,server:Server,base:string,dir:string,database:string,club:string,team:string,other:string,platform:string,limitedRole:string;
async function request(path:string,method='GET',data?:any,session=platform){const response=await fetch(base+path,{method,headers:{...(session?{Cookie:session}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
const list=()=>request('/api/admin/template-requests');
const change=(item:any,input:any)=>request('/api/admin/template-requests/'+item.id,'PATCH',{expectedRevision:item.revision,...input});
before(async()=>{if(!connection)throw new Error('Een tijdelijke lokale testdatabase is verplicht.');const url=new URL(connection);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Maatwerktests gebruiken uitsluitend een geïsoleerde lokale database.');admin=new pg.Pool({connectionString:connection});database='castiq_requests_test_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${database}`);url.pathname='/'+database;pool=new pg.Pool({connectionString:url.href});await migrate(pool);await seedFixtures(pool);dir=await mkdtemp(join(tmpdir(),'castiq-requests-'));server=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',host:'127.0.0.1',origin:'http://127.0.0.1:4173'}));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;for(const[id,set]of[['getijde-club',(value:string)=>club=value],['getijde-team',(value:string)=>team=value],['havenlicht-club',(value:string)=>other=value],['platform',(value:string)=>platform=value]] as const){const result=await request('/api/session','POST',{accountId:id},'');assert.equal(result.status,200);set(result.cookie);}});
after(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));if(pool)await pool.end();if(admin){try{if(database)await admin.query(`DROP DATABASE IF EXISTS ${database}`);if(limitedRole)await admin.query(`DROP ROLE IF EXISTS ${limitedRole}`);}finally{await admin.end();}}if(dir)await rm(dir,{recursive:true,force:true});});
let designRequest:any,custom:any;
test('only club managers create tenant-bound persistent requests; platform owns the work queue',async()=>{
 for(const session of[team,platform,''])assert.equal((await request('/api/template-requests','POST',{title:'Forbidden',brief:'Forbidden'},session)).status,session?403:401);
 for(const session of[club,team,other,''])assert.equal((await request('/api/admin/template-requests','GET',undefined,session)).status,session?403:401);
 assert.equal((await request('/api/template-requests','POST',{title:'   ',brief:'Wens'},club)).status,400);
 assert.equal((await request('/api/template-requests','POST',{title:'T'.repeat(71),brief:'Wens'},club)).status,400);
 let result=await request('/api/template-requests','POST',{title:'Jubileumontwerp',brief:'Vier formaten met een speciale jubileumkop.',clubId:'cl2',status:'Gereed',createdBy:'forged'},club);assert.equal(result.status,201);designRequest=result.body.request;assert.equal(designRequest.clubId,'cl1');assert.equal(designRequest.status,'Nieuw');assert.equal(designRequest.revision,1);assert.equal(designRequest.history.length,1);
 const stored=(await pool.query('SELECT * FROM castiq.template_requests WHERE id=$1',[designRequest.id])).rows[0];assert.equal(stored.created_by,'getijde-club');assert.equal(stored.brief,designRequest.brief);
 assert.equal((await request('/api/template-requests?clubId=cl1','GET',undefined,other)).body.requests.length,0);
 assert.equal((await request('/api/template-requests','GET',undefined,club)).body.requests[0].title,'Jubileumontwerp');
 assert.equal((await list()).body.requests[0].clubName,'SC Getijde');assert.equal((await request('/api/admin/template-requests?clubId=cl2')).body.requests.length,0);
 assert.equal((await request('/api/admin/template-requests/'+designRequest.id,'PATCH',{operation:'status',expectedRevision:1,status:'In behandeling'},club)).status,403);
});
test('status workflow records immutable history, uses compare-and-swap and requires a rejection explanation',async()=>{
 const first=await change(designRequest,{operation:'status',status:'In behandeling'});assert.equal(first.status,200);designRequest=first.body.request;assert.equal(designRequest.history.length,2);
 assert.equal((await request('/api/admin/template-requests/'+designRequest.id,'PATCH',{operation:'status',expectedRevision:1,status:'Afgewezen',reviewNote:'Stale'})).status,409);
 assert.equal((await change(designRequest,{operation:'status',status:'Gereed'})).status,400);
 assert.equal((await change(designRequest,{operation:'status',status:'Afgewezen'})).status,400);
 const pair=await Promise.all([change(designRequest,{operation:'status',status:'Afgewezen',reviewNote:'Maak de ontwerpbrief concreter.'}),change(designRequest,{operation:'status',status:'Afgewezen',reviewNote:'Ander antwoord.'})]);assert.deepEqual(pair.map(item=>item.status).sort(),[200,409]);designRequest=pair.find(item=>item.status===200).body.request;
 assert.equal(designRequest.status,'Afgewezen');assert.equal(designRequest.revision,3);assert.equal(designRequest.history.length,3);
 const own=(await request('/api/template-requests','GET',undefined,club)).body.requests[0];assert.equal(own.reviewNote,designRequest.reviewNote);
 const reopened=await change(designRequest,{operation:'status',status:'Nieuw',reviewNote:'De aanvullende ontwerpbrief is ontvangen.'});assert.equal(reopened.status,200);designRequest=reopened.body.request;
 await assert.rejects(pool.query("UPDATE castiq.template_request_events SET action='forged'"),/immutable history/);await assert.rejects(pool.query('DELETE FROM castiq.template_request_events'),/immutable history/);
});
async function templateChange(template:any,operation:string,input:any={}){const result=await request('/api/admin/templates/'+template.id,'PATCH',{operation,expectedRevision:template.revision,...input});assert.equal(result.status,200,JSON.stringify(result.body));return result.body.template;}
test('completion assigns the exact published central template atomically and rejects drafts, built-ins and stale revisions',async()=>{
 const seed=(await request('/api/admin/templates')).body.templates[0];const created=await request('/api/admin/templates','POST',{name:'Jubileumontwerp exact',family:seed.family,postType:'news',layouts:seed.versions[0].layouts});assert.equal(created.status,201);custom=created.body.template;
 const assignment=()=>({operation:'assign',templateId:custom.id,expectedTemplateRevision:custom.revision,restrictToClub:true,reviewNote:'Het jubileumontwerp staat klaar.'});
 assert.equal((await change(designRequest,assignment())).status,400);
 custom=await templateChange(custom,'publish',{layouts:custom.draft.layouts});custom=await templateChange(custom,'availability',{enabled:true});
 assert.equal((await change(designRequest,{operation:'assign',templateId:seed.id,expectedTemplateRevision:seed.revision,restrictToClub:true})).status,400);
 assert.equal((await change(designRequest,{...assignment(),expectedTemplateRevision:custom.revision-1})).status,409);
 assert.equal((await change(designRequest,{...assignment(),restrictToClub:false})).status,400);
 assert.equal((await list()).body.requests[0].revision,designRequest.revision);assert.equal((await pool.query('SELECT audience FROM castiq.templates WHERE id=$1',[custom.id])).rows[0].audience,'all');
 const assigned=await change(designRequest,assignment());assert.equal(assigned.status,200);designRequest=assigned.body.request;assert.equal(designRequest.status,'Gereed');assert.equal(designRequest.templateId,custom.id);assert.equal(designRequest.templateName,custom.name);
 custom=(await request('/api/admin/templates')).body.templates.find((item:any)=>item.id===custom.id);assert.equal(custom.audience,'selected');assert.deepEqual(custom.clubIds,['cl1']);assert.equal(custom.revision,4);
 const own=(await request('/api/templates','GET',undefined,club)).body.templates,foreign=(await request('/api/templates','GET',undefined,other)).body.templates;assert(own.some((item:any)=>item.id===custom.id));assert(!foreign.some((item:any)=>item.id===custom.id));
 const snapshot=await stampContentTemplate(pool as any,{id:'getijde-club',name:'Synthetic',role:'club',clubId:'cl1'},{type:'Clubnieuws',templateId:custom.id,family:custom.family});assert.equal(snapshot.templateId,custom.id);assert.equal(snapshot.templateSnapshot.name,'Jubileumontwerp exact');assert.equal(snapshot.templateSnapshot.version,1);
 assert.equal((await pool.query("SELECT count(*)::integer AS n FROM castiq.template_audit WHERE template_id=$1 AND action='request-assigned'",[custom.id])).rows[0].n,1);
 assert.equal((await change(designRequest,{operation:'status',status:'Nieuw'})).status,409);
});
test('assigning another request preserves existing selected-club access and refused work cannot be completed silently',async()=>{
 let second=(await request('/api/template-requests','POST',{title:'Tweede clubvariant',brief:'Ook voor deze club beschikbaar.'},other)).body.request;
 let rejected=await change(second,{operation:'status',status:'Afgewezen',reviewNote:'Eerst heropenen.'});assert.equal(rejected.status,200);second=rejected.body.request;
 assert.equal((await change(second,{operation:'assign',templateId:custom.id,expectedTemplateRevision:custom.revision})).status,409);
 second=(await change(second,{operation:'status',status:'Nieuw'})).body.request;
 assert.equal((await change(second,{operation:'assign',templateId:custom.id,expectedTemplateRevision:custom.revision})).status,200);
 const saved=(await request('/api/admin/templates')).body.templates.find((item:any)=>item.id===custom.id);assert.deepEqual(saved.clubIds,['cl1','cl2']);
});
test('personal erasure removes request free text and actor references while retaining a non-identifying audit trail',async()=>{
 const db=await pool.connect();try{await db.query('BEGIN');await pseudonymizeTemplateRequestActor(db,'getijde-club','erased:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');await db.query('COMMIT');}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 const row=(await pool.query('SELECT * FROM castiq.template_requests WHERE id=$1',[designRequest.id])).rows[0];assert.equal(row.created_by,'erased:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');assert.equal(row.title,'Verwijderde aanvraag');assert.equal(row.brief,'');assert.equal(row.template_id,custom.id);
 assert.equal((await pool.query("SELECT count(*)::integer AS n FROM castiq.template_request_events WHERE actor_id='getijde-club'")).rows[0].n,0);
 assert.equal((await pool.query("SELECT count(*)::integer AS n FROM castiq.template_request_events WHERE actor_id='erased:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'")).rows[0].n,1);
 const reviewer=await pool.connect();try{await reviewer.query('BEGIN');await pseudonymizeTemplateRequestActor(reviewer,'platform','erased:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');await reviewer.query('COMMIT');}catch(error){await reviewer.query('ROLLBACK');throw error;}finally{reviewer.release();}
 assert.equal((await pool.query('SELECT review_note FROM castiq.template_requests WHERE id=$1',[designRequest.id])).rows[0].review_note,'');
});
test('new tables use RLS and the server runtime cannot rewrite immutable event details',async()=>{
 const tables=(await pool.query("SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='castiq' AND relname IN ('template_requests','template_request_events')")).rows;assert.equal(tables.length,2);assert(tables.every(item=>item.relrowsecurity));
 limitedRole='castiq_requests_limited_'+randomUUID().replaceAll('-','');await admin.query(`CREATE ROLE ${limitedRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);await pool.query(`GRANT USAGE ON SCHEMA castiq TO ${limitedRole}`);
 const sql=await readFile(new URL('../database/migrations/011_template_requests.sql',import.meta.url),'utf8');await pool.query(sql.slice(sql.indexOf('DO $$ DECLARE tab'),sql.lastIndexOf('COMMIT;')).replaceAll('castiq_runtime',limitedRole));
 const db=await pool.connect();try{for(const statement of["UPDATE castiq.template_request_events SET action='forged'",'DELETE FROM castiq.template_request_events',"UPDATE castiq.template_request_events SET actor_id='forged'"]){await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);await assert.rejects(db.query(statement),error=>['42501','P0001'].includes((error as any).code));await db.query('ROLLBACK');}
 await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);assert((await db.query('SELECT count(*)::integer AS n FROM castiq.template_requests')).rows[0].n>=2);await db.query("SELECT set_config('castiq.privacy_erasure','on',true)");await db.query("UPDATE castiq.template_request_events SET actor_id='erased:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' WHERE actor_id='erased:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'");await db.query('ROLLBACK');
 }finally{await db.query('ROLLBACK');db.release();}
});
