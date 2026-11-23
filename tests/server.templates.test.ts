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
import {normalizeTemplateLayouts,stampContentTemplate} from '../server/templateLibrary.ts';

const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let pool:pg.Pool,admin:pg.Pool,server:Server,base:string,dir:string,database:string,club:string,team:string,other:string,platform:string,limitedRole:string;
async function request(path:string,method='GET',data?:any,session=platform){const response=await fetch(base+path,{method,headers:{...(session?{Cookie:session}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)});return{status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
const list=()=>request('/api/admin/templates');
const change=(template:any,operation:string,input:any={})=>request('/api/admin/templates/'+template.id,'PATCH',{operation,expectedRevision:template.revision,...input});
before(async()=>{if(!connection)throw new Error('Een tijdelijke lokale testdatabase is verplicht.');const url=new URL(connection);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Templatetests gebruiken uitsluitend een geïsoleerde lokale database.');admin=new pg.Pool({connectionString:connection});database='castiq_templates_test_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${database}`);url.pathname='/'+database;pool=new pg.Pool({connectionString:url.href});await migrate(pool);await seedFixtures(pool);dir=await mkdtemp(join(tmpdir(),'castiq-templates-'));server=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',host:'127.0.0.1',origin:'http://127.0.0.1:4173'}));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;for(const[id,set]of[['getijde-club',(value:string)=>club=value],['getijde-team',(value:string)=>team=value],['havenlicht-club',(value:string)=>other=value],['platform',(value:string)=>platform=value]] as const){const response=await request('/api/session','POST',{accountId:id},'');assert.equal(response.status,200);set(response.cookie);}});
after(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));if(pool)await pool.end();if(admin){try{if(database)await admin.query(`DROP DATABASE IF EXISTS ${database}`);if(limitedRole)await admin.query(`DROP ROLE IF EXISTS ${limitedRole}`);}finally{await admin.end();}}if(dir)await rm(dir,{recursive:true,force:true});});

test('platform-only administration; 27 seeds with four normalized partner layouts; private table RLS',async()=>{
 for(const session of[club,team,other,'']){assert.equal((await request('/api/admin/templates','GET',undefined,session)).status,session?403:401);assert.equal((await request('/api/admin/templates','POST',{name:'Denied'},session)).status,session?403:401);}
 const response=await list();assert.equal(response.status,200);assert.equal(response.body.templates.length,27);assert.equal(response.body.clubs.length,3);
 for(const template of response.body.templates)for(const layers of Object.values(template.versions[0].layouts) as any[][]){const marks=layers.filter(layer=>layer.id==='castiq-partner-logo');assert.equal(marks.length,1);assert.equal(layers.at(-1).id,'castiq-partner-logo');assert.equal(marks[0].locked,true);}
 const tables=(await pool.query("SELECT relname,relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='castiq' AND relname IN ('templates','template_versions','template_assignments','template_audit')")).rows;assert.equal(tables.length,4);assert(tables.every(row=>row.relrowsecurity));
});
let custom:any,v1:any;
test('draft, publish, activation and real tenant assignment are central and optimistic',async()=>{
 const original=(await list()).body.templates[0];
 let result=await request('/api/admin/templates','POST',{name:'Centrale clubvariant',description:'Alleen de juiste vereniging',postType:'news',family:original.family,layouts:original.versions[0].layouts});assert.equal(result.status,201);custom=result.body.template;assert.equal(custom.enabled,false);assert.equal(custom.publishedVersion,null);
 assert.equal((await change(custom,'availability',{enabled:true})).status,400);
 result=await change(custom,'publish',{layouts:custom.draft.layouts});assert.equal(result.status,200);custom=result.body.template;assert.equal(custom.publishedVersion,1);v1=structuredClone(custom.versions[0]);
 result=await change(custom,'availability',{enabled:true});assert.equal(result.status,200);custom=result.body.template;
 const stale=custom.revision;
 result=await change(custom,'configure',{name:custom.name,audience:'selected',clubIds:['cl1'],defaultFor:true});assert.equal(result.status,200);custom=result.body.template;
 assert.equal((await request('/api/admin/templates/'+custom.id,'PATCH',{operation:'availability',enabled:false,expectedRevision:stale})).status,409);
 assert.equal((await request('/api/admin/templates/'+custom.id,'PATCH',{operation:'availability',enabled:false,expectedRevision:custom.revision},club)).status,403);
 const own=(await request('/api/templates','GET',undefined,club)).body.templates,foreign=(await request('/api/templates','GET',undefined,other)).body.templates;assert(own.some((t:any)=>t.id===custom.id));assert(!foreign.some((t:any)=>t.id===custom.id));assert(own.every((t:any)=>t.draft===null));
});
test('schema validates types, group fields, image protocols, effects and dimensions; fixed mark is reconstructed',async()=>{
 const layouts=structuredClone(v1.layouts);layouts['4:5'].find((layer:any)=>layer.type==='text').shadowBlur=121;assert.equal((await change(custom,'save-draft',{layouts})).status,400);
 delete layouts['4:5'][0].unknown;layouts['4:5'][0].width=Number.MAX_SAFE_INTEGER;assert.throws(()=>normalizeTemplateLayouts(layouts));
 const unsafe=structuredClone(v1.layouts);unsafe['4:5'][0].text='javascript:alert(1)';assert.throws(()=>normalizeTemplateLayouts(unsafe));
 const fixed=structuredClone(v1.layouts);for(const format of Object.keys(fixed)){const mark=fixed[format].at(-1);mark.x=0;mark.locked=false;mark.visible=false;mark.groupId='broken';fixed[format].push({...mark});}const normalized=normalizeTemplateLayouts(fixed);for(const layers of Object.values(normalized)){assert.equal(layers.filter((layer:any)=>layer.id==='castiq-partner-logo').length,1);assert(layers.at(-1).x>0);assert.equal(layers.at(-1).locked,true);assert.equal(layers.at(-1).groupId,undefined);}
});
test('a trusted historical contribution keeps exact v1 after v2, reassignment and disable; new use fails closed',async()=>{
 const actor={id:'getijde-club',name:'Synthetische beheerder',clubId:'cl1',role:'club' as const};
 const frozen=await stampContentTemplate(pool as any,actor,{type:'Clubnieuws',family:custom.family,templateId:custom.id});assert.equal(frozen.templateSnapshot.version,1);
 const layouts=structuredClone(v1.layouts);layouts['4:5'].find((layer:any)=>layer.id==='label').text='Versie twee';let result=await change(custom,'publish',{layouts});assert.equal(result.status,200);custom=result.body.template;assert.equal(custom.publishedVersion,2);assert.deepEqual(custom.versions[0],v1);
 const current=await stampContentTemplate(pool as any,actor,{type:'Clubnieuws',family:custom.family,templateId:custom.id});assert.equal(current.templateSnapshot.version,2);
 result=await change(custom,'availability',{enabled:false});assert.equal(result.status,200);custom=result.body.template;
 assert(!((await request('/api/templates','GET',undefined,club)).body.templates).some((t:any)=>t.id===custom.id));
 await assert.rejects(stampContentTemplate(pool as any,actor,{type:'Clubnieuws',templateId:custom.id}),error=>(error as any).status===403);
 const preserved=await stampContentTemplate(pool as any,actor,{type:'Clubnieuws',family:custom.family,...frozen},{type:'Clubnieuws',family:custom.family,...frozen});assert.deepEqual(preserved,frozen);
 await assert.rejects(pool.query('UPDATE castiq.template_versions SET layouts=$1 WHERE template_id=$2 AND number=1',[JSON.stringify(layouts),custom.id]),/immutable history/);
 assert((await pool.query('SELECT count(*)::integer AS n FROM castiq.template_audit WHERE template_id=$1',[custom.id])).rows[0].n>=5);
});
test('simultaneous metadata writes have one winner and nonexistent tenant assignment rolls back',async()=>{
 const input={operation:'configure',expectedRevision:custom.revision,name:'Gelijktijdig',audience:'all',clubIds:[],defaultFor:false};const responses=await Promise.all([request('/api/admin/templates/'+custom.id,'PATCH',input),request('/api/admin/templates/'+custom.id,'PATCH',input)]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);custom=responses.find(r=>r.status===200).body.template;
 assert.equal((await change(custom,'configure',{name:'Onbekende club',audience:'selected',clubIds:['not-a-club'],defaultFor:false})).status,400);assert.equal((await list()).body.templates.find((t:any)=>t.id===custom.id).revision,custom.revision);
});

test('the migration runtime grant block works under a unique non-owner role and forbids immutable writes',async()=>{
 limitedRole='castiq_template_limited_'+randomUUID().replaceAll('-','');await admin.query(`CREATE ROLE ${limitedRole} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
 await pool.query(`GRANT USAGE ON SCHEMA castiq TO ${limitedRole}`);
 const migration=await readFile(new URL('../database/migrations/009_template_library.sql',import.meta.url),'utf8');const grants=migration.slice(migration.indexOf('-- Match the established private server role.'),migration.lastIndexOf('COMMIT;')).replaceAll('castiq_runtime',limitedRole);await pool.query(grants);
 const db=await pool.connect();try{await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);assert.equal((await db.query('SELECT count(*)::integer AS n FROM castiq.templates')).rows[0].n,28);await db.query("UPDATE castiq.templates SET description=description WHERE id='familie-1'");await db.query('ROLLBACK');
 for(const statement of["DELETE FROM castiq.templates WHERE id='familie-1'","UPDATE castiq.template_versions SET actor_id='forged' WHERE template_id='familie-1'","DELETE FROM castiq.template_audit"]){await db.query('BEGIN');await db.query(`SET LOCAL ROLE ${limitedRole}`);await assert.rejects(db.query(statement),error=>(error as any).code==='42501');await db.query('ROLLBACK');}
 }finally{await db.query('ROLLBACK');db.release();}
});
