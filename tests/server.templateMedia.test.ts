import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import sharp from 'sharp';
import {migrate} from '../database/migrate.ts';
import {seedFixtures} from '../server/fixtures.ts';
import {createApplication} from '../server/application.ts';
import {stampContentTemplate,normalizeTemplateLayouts} from '../server/templateLibrary.ts';
import {uploadTemplateMedia} from '../server/templateMedia.ts';
import {renderPublicationMedia} from '../server/publicationMedia.ts';
import {canonicalPayloadHash} from '../server/publicationIntegrity.ts';
const connection=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
let pool:pg.Pool,admin:pg.Pool,server:Server,base:string,dir:string,database:string,club:string,team:string,other:string,platform:string,upload:any,template:any,payload:any,job:any;
async function request(path:string,method='GET',data?:any,session=platform){const response=await fetch(base+path,{method,headers:{...(session?{Cookie:session}:{}),...(data!==undefined?{'Content-Type':'application/json'}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||''};}
async function change(operation:string,extra:any={}){const result=await request('/api/admin/templates/'+template.id,'PATCH',{operation,expectedRevision:template.revision,...extra});assert.equal(result.status,200,JSON.stringify(result.body));template=result.body.template;return template;}
before(async()=>{if(!connection)throw new Error('Lokale testdatabase ontbreekt.');const url=new URL(connection);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new Error('Templatebeeldtests gebruiken uitsluitend een eigen tijdelijke localhostdatabase.');admin=new pg.Pool({connectionString:connection});database='castiq_template_media_'+randomUUID().replaceAll('-','');await admin.query(`CREATE DATABASE ${database}`);url.pathname='/'+database;pool=new pg.Pool({connectionString:url.href});await migrate(pool);await seedFixtures(pool);dir=await mkdtemp(join(tmpdir(),'castiq-template-media-'));server=createServer(createApplication({pool,uploadDir:dir,authMode:'local',appEnv:'local',host:'127.0.0.1',origin:'http://127.0.0.1:4173'}));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;for(const[id,set]of[['getijde-club',(value:string)=>club=value],['getijde-team',(value:string)=>team=value],['havenlicht-club',(value:string)=>other=value],['platform',(value:string)=>platform=value]] as const){const result=await request('/api/session','POST',{accountId:id},'');assert.equal(result.status,200);set(result.cookie);}});
after(async()=>{if(server)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));if(pool)await pool.end();if(admin){try{if(database)await admin.query(`DROP DATABASE IF EXISTS ${database}`);}finally{await admin.end();}}if(dir)await rm(dir,{recursive:true,force:true});});

test('only recently authenticated platform administrators upload sanitized private template media',async()=>{
 const bytes=await sharp({create:{width:80,height:60,channels:3,background:'#ff0088'}}).png().toBuffer();
 for(const session of[club,team,'']){const response=await fetch(base+'/api/admin/template-media',{method:'POST',headers:{...(session?{Cookie:session}:{}),'Content-Type':'image/png'},body:bytes});assert.equal(response.status,session?403:401);}
 await assert.rejects(uploadTemplateMedia(pool,{id:'platform',name:'Synthetic',role:'platform',clubId:'__platform__'},bytes,'image/png',{uploadDir:dir},false),error=>(error as any).code==='recent_auth_required');
 const uploaded=await fetch(base+'/api/admin/template-media',{method:'POST',headers:{Cookie:platform,'Content-Type':'image/png'},body:bytes});assert.equal(uploaded.status,201);upload=await uploaded.json();assert.match(upload.url,/^\/api\/template-media\/[a-f0-9-]{36}$/);assert.equal(upload.mime,'image/webp');assert.equal(upload.width,80);assert.match(upload.sha256,/^[a-f0-9]{64}$/);
 const read=await fetch(base+upload.url,{headers:{Cookie:platform}});assert.equal(read.status,200);assert.equal(read.headers.get('content-type'),'image/webp');assert.equal((await sharp(Buffer.from(await read.arrayBuffer())).metadata()).format,'webp');
 for(const session of[club,team,other])assert.equal((await fetch(base+upload.url,{headers:{Cookie:session}})).status,404);
 const invalid=await fetch(base+'/api/admin/template-media',{method:'POST',headers:{Cookie:platform,'Content-Type':'image/jpeg'},body:bytes});assert.equal(invalid.status,400);
});
test('static private images are validated, published and exposed only through exact accessible central templates',async()=>{
 const seed=(await request('/api/admin/templates')).body.templates[0],layouts=structuredClone(seed.versions[0].layouts);for(const layers of Object.values(layouts) as any[][])layers.splice(layers.length-1,0,{id:'club-visual',name:'Vaste clubafbeelding',type:'image',binding:null,text:upload.url,x:300,y:400,width:360,height:270,rotation:0,fontSize:54,fontWeight:700,align:'left',color:'#ffffff',opacity:1,locked:false,visible:true,clubEditable:false,shape:'rect',fit:'contain',radius:0});
 const external=structuredClone(layouts);external['4:5'].find((layer:any)=>layer.id==='club-visual').text='https://example.invalid/external.png';assert.throws(()=>normalizeTemplateLayouts(external),/Upload vaste afbeeldingen/);
 const missing=structuredClone(layouts);missing['4:5'].find((layer:any)=>layer.id==='club-visual').text='/api/template-media/'+randomUUID();assert.equal((await request('/api/admin/templates','POST',{name:'Missing image',postType:'news',family:seed.family,layouts:missing})).status,400);
 const created=await request('/api/admin/templates','POST',{name:'Uploaded club design',postType:'news',family:seed.family,layouts});assert.equal(created.status,201);template=created.body.template;await change('publish',{layouts:template.draft.layouts});await change('availability',{enabled:true});await change('configure',{name:template.name,audience:'selected',clubIds:['cl1'],defaultFor:false});
 for(const session of[club,team])assert.equal((await fetch(base+upload.url,{headers:{Cookie:session}})).status,200);assert.equal((await fetch(base+upload.url,{headers:{Cookie:other}})).status,404);
 const snapshot=await stampContentTemplate(pool as any,{id:'getijde-club',name:'Synthetic',role:'club',clubId:'cl1'},{type:'Clubnieuws',templateId:template.id,family:template.family});assert.equal(snapshot.templateSnapshot.media.length,1);assert.deepEqual(snapshot.templateSnapshot.media[0],{url:upload.url,sha256:upload.sha256,width:80,height:60,bytes:Number((await pool.query('SELECT byte_size FROM castiq.media WHERE id=$1',[upload.id])).rows[0].byte_size)});
 payload={type:'Clubnieuws',team:'Hele club',title:'Synthetic template proof',caption:'Synthetic text',photoUsage:'no_photo',render:{family:template.family,templateSnapshot:snapshot.templateSnapshot,media:snapshot.templateSnapshot.media,primary:'#2463eb',secondary:'#ffffff',partnerLogo:false,data:{clubName:'Synthetic club',clubLogo:'',fixtureLabel:'Samen vooruit'}}};job={channel:'Instagram-feed',payload,providerPayloadHash:canonicalPayloadHash(payload)};
});
test('server renderer embeds the frozen central image bytes, rejects hash tampering and never fetches external URLs',async()=>{
 const bytes=await renderPublicationMedia(pool,'cl1',job,{origin:'https://synthetic.invalid',environment:'local',uploadDir:dir,staticDir:'public'});const metadata=await sharp(bytes).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.width,1080);assert.equal(metadata.height,1350);
 const row=(await pool.query('SELECT object_key FROM castiq.media WHERE id=$1',[upload.id])).rows[0];await writeFile(join(dir,row.object_key),await sharp({create:{width:80,height:60,channels:3,background:'#00ff00'}}).webp().toBuffer());await assert.rejects(renderPublicationMedia(pool,'cl1',job,{origin:'https://synthetic.invalid',environment:'local',uploadDir:dir,staticDir:'public'}),/publication_media_hash_mismatch/);
});

test('deleting a platform account preserves central image bytes referenced by draft or immutable template versions',async()=>{
 const {createPrivacyService}=await import('../server/privacy.ts'),{initializeFileDeletionLedger,createFileDeletionLedger}=await import('../server/privacyLedger.ts'),{LEGAL_DOCUMENTS}=await import('../shared/legalDocuments.ts');
 const ledgerDir=join(dir,'synthetic-ledger');await initializeFileDeletionLedger(ledgerDir,{environmentId:'isolated-template-media-privacy',confirmedEmptyScope:true});let now='2026-11-23T12:00:00.000Z';const removed:string[]=[];
 await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,status,registration_completed_at,last_conscious_at,reliable_activity) VALUES('platform','active',$1,$1,true) ON CONFLICT(actor_id) DO UPDATE SET status='active',last_conscious_at=$1",[now]);
 const privacy=createPrivacyService({pool,documents:LEGAL_DOCUMENTS,clock:()=>new Date(now),referenceKey:'synthetic-template-privacy-key-32-characters',ledger:createFileDeletionLedger(ledgerDir),revokeIdentitySessions:async()=>{},deleteIdentity:async()=>{},erasePersonalMail:async()=>{},deletePrivateMedia:async objectKey=>{removed.push(objectKey);}});
 const task=await privacy.blockDeletion({id:'platform',authenticatedAt:now});now=task.deadline;await pool.query('UPDATE castiq.privacy_retention_control SET destructive_enabled=true,dry_run_verified_at=$1,restore_verified_at=$1,transition_verified_at=$1,provider_retention_verified_at=$1 WHERE singleton=true',[now]);assert.equal((await privacy.executeDeletion(task.id)).completed,true);assert.deepEqual(removed,[]);const media=(await pool.query('SELECT actor_id,club_id FROM castiq.media WHERE id=$1',[upload.id])).rows[0];assert.equal(media.club_id,'__platform__');assert.match(media.actor_id,/^erased:[a-f0-9]{64}$/);
});
