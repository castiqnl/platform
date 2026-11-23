import {test,expect,type Page} from '@playwright/test';
import type {PlatformOperations,OperationalJob} from '../../src/platformOperationsTypes';
const platform={id:'synthetic-platform',name:'Testbeheerder',clubId:'__platform__',role:'platform'};
function workspace(actor=platform){return {version:1,actor,state:{activeMatchId:'',club:{id:actor.clubId,name:actor.role==='platform'?'Platform':'Testvereniging',color:'#124e78',accent:'#f4ce31',hashtags:'',youthNames:'Voornaam + initiaal',plan:'',trial:false},teams:[],content:[],matches:[],players:[],users:[],events:[],clubs:[],connections:[],activity:[],rules:{},templateRequests:[],customTemplates:[],v1:{drafts:{},weekPlans:[],weekendReports:[],sponsorAgreements:[],audit:[],publicationPaused:true}}};}
function operations():PlatformOperations{return {generatedAt:'2026-11-23T10:00:00Z',sources:{jobs:{status:'ok',data:{total:0,counts:{failed:0,awaiting_confirmation:0,in_progress:0,paused:0,published:0,cancelled:0,other:0},items:[],limit:200,truncated:false}},registrations:{status:'ok',data:{total:0,pending:0}},privacy:{status:'ok',data:{open:0,nextDeadline:null}},mail:{status:'ok',data:{incidents:0}},templates:{status:'ok',data:{total:0,active:0,drafts:0,recent:[]}}}};}
function job(id:string,group:OperationalJob['group']):OperationalJob{return {id,clubId:'club-a',clubName:'Testvereniging Alfa',channel:'Instagram-feed',status:group==='in_progress'?'queued':group,group,revision:4,attempt:2,scheduledAt:null,confirmedAt:group==='published'?'2026-11-23T10:00:00Z':null,confirmation:group==='published'?'sandbox':null,providerMode:'demo'};}
async function session(page:Page,actor=platform){await page.route('**/api/session',route=>route.fulfill({json:{actor,identity:{id:actor.id,status:'active'},memberships:[actor],accounts:[],authMode:'local',environment:'local',legal:null}}));await page.route('**/api/workspace',route=>route.fulfill({json:workspace(actor)}));await page.route('**/api/templates',route=>route.fulfill({json:{templates:[]}}));}
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);}

test('server cockpit shows actual zero values and never substitutes the local template library',async({page})=>{
  await session(page);await page.route('**/api/admin/clubs',route=>route.fulfill({json:{clubs:[]}}));
  await page.route('**/api/admin/operations',route=>route.fulfill({json:operations()}));
  await page.goto('/#/platform/dashboard');await expect(page.getByRole('heading',{name:'Platformcockpit'})).toBeVisible();
  for(const label of ['Verenigingen','Actieve templates','Kanaalopdrachten','Open privacyzaken'])await expect(page.locator('.pco-metric').filter({hasText:label}).locator('strong')).toHaveText('0');
  await expect(page.getByText('Er zijn geen kanaalopdrachten.',{exact:true})).toBeVisible();
  await expect(page.getByText('Er zijn nog geen templateversies gepubliceerd.',{exact:true})).toBeVisible();
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await noOverflow(page);}
});

test('cockpit refresh retains successful source values, distinguishes unavailable sources and counts paused jobs',async({page})=>{
  await session(page);await page.route('**/api/admin/clubs',route=>route.fulfill({json:{clubs:[{id:'club-a',name:'Testvereniging Alfa',members:2,version:1}]}}));
  let refresh=false;await page.route('**/api/admin/operations',route=>{const result=operations();if(refresh){result.sources.jobs={status:'unavailable'};result.sources.templates={status:'unavailable'};}else{result.sources.jobs={status:'ok',data:{total:3,counts:{failed:1,awaiting_confirmation:0,in_progress:0,paused:1,published:1,cancelled:0,other:0},items:[job('failed-job','failed'),job('paused-job','paused'),job('sandbox-job','published')],limit:200,truncated:false}};result.sources.templates={status:'ok',data:{total:2,active:1,drafts:1,recent:[{id:'template-a',name:'Centraal ontwerp',version:3,publishedAt:'2026-11-23T10:00:00Z'}]}};}return route.fulfill({json:result});});
  await page.goto('/#/platform/dashboard');await expect(page.locator('.pco-metric').filter({hasText:'Kanaalopdrachten'}).locator('strong')).toHaveText('3');
  await expect(page.locator('.pco-channel-list').getByText('Gepauzeerd')).toBeVisible();await expect(page.getByText('Centraal ontwerp',{exact:true})).toBeVisible();
  refresh=true;await page.getByRole('button',{name:'Vernieuwen',exact:true}).click();
  await expect(page.getByText(/Niet ververst: kanaalopdrachten, templates/)).toBeVisible();
  await expect(page.locator('.pco-metric').filter({hasText:'Kanaalopdrachten'}).locator('strong')).toHaveText('3');
  await expect(page.locator('.pco-metric').filter({hasText:'Actieve templates'}).locator('strong')).toHaveText('1');
  await expect(page.getByText('Centraal ontwerp',{exact:true})).toBeVisible();
});

test('unavailable first load is unknown, with a retry that can resolve to a real zero',async({page})=>{
  await session(page);await page.route('**/api/admin/clubs',route=>route.fulfill({json:{clubs:[]}}));let unavailable=true;
  await page.route('**/api/admin/operations',route=>{const result=operations();if(unavailable)result.sources.jobs={status:'unavailable'};return route.fulfill({json:result});});
  await page.goto('/#/platform/dashboard');await expect(page.locator('.pco-metric').filter({hasText:'Kanaalopdrachten'}).locator('strong')).toHaveText('–');
  await expect(page.getByText('Kanaalgegevens nog niet beschikbaar.',{exact:true})).toBeVisible();
  unavailable=false;await page.getByRole('button',{name:'Vernieuwen',exact:true}).click();await expect(page.locator('.pco-metric').filter({hasText:'Kanaalopdrachten'}).locator('strong')).toHaveText('0');
});

test('server job monitor shows only operational details and no simulator, and preserves stale rows on refresh failure',async({page})=>{
  await session(page);let failed=false;await page.route('**/api/admin/operations',route=>{const result=operations();result.sources.jobs=failed?{status:'unavailable'}:{status:'ok',data:{total:2,counts:{failed:0,awaiting_confirmation:0,in_progress:0,paused:1,published:1,cancelled:0,other:0},items:[job('job-sandbox','published'),job('job-paused','paused')],limit:200,truncated:false}};return route.fulfill({json:result});});
  await page.goto('/#/platform/system');await expect(page.getByRole('heading',{name:'Kanaaljobs',exact:true})).toBeVisible();await expect(page.getByText('Sandbox bevestigd',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Demo bevestigen'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Fout simuleren'})).toHaveCount(0);
  await page.getByRole('button',{name:'Details Instagram-feed, job-sandbox'}).click();await expect(page.getByRole('dialog').locator('dd').filter({hasText:'Sandboxbewijs'})).toBeVisible();await expect(page.getByText('v4',{exact:true})).toHaveCount(3);
  await expect(page.getByText('Huidige versie',{exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Sluiten',exact:true}).click();
  await page.getByRole('combobox',{name:'Filter op opdrachtstatus'}).selectOption('paused');await expect(page.getByRole('button',{name:'Details Instagram-feed, job-paused'})).toBeVisible();await expect(page.getByRole('button',{name:'Details Instagram-feed, job-sandbox'})).toHaveCount(0);
  failed=true;await page.getByRole('button',{name:'Vernieuwen',exact:true}).click();await expect(page.getByRole('alert')).toContainText('niet ververst');await expect(page.getByRole('button',{name:'Details Instagram-feed, job-paused'})).toBeVisible();
  await page.setViewportSize({width:390,height:844});await noOverflow(page);
});

test('association directory paginates eleven records, persists a new club and keeps role input after an authorization error',async({page})=>{
  await session(page);let clubs=Array.from({length:11},(_,index)=>({id:`club-${index}`,name:`Testvereniging ${String(index+1).padStart(2,'0')}`,version:1,members:index===0?0:2,updatedAt:'2026-11-23T10:00:00Z'}));
  const accounts=[{id:'eligible-user',email:'active@example.invalid',status:'active',registeredAt:'2026-11-23T10:00:00Z',isPlatform:false},{id:'pending-user',email:'pending@example.invalid',status:'registration_pending',registeredAt:'2026-11-23T10:00:00Z',isPlatform:false},{id:'platform-user',email:'platform@example.invalid',status:'active',registeredAt:'2026-11-23T10:00:00Z',isPlatform:true}];
  await page.route('**/api/admin/clubs',async route=>{if(route.request().method()==='POST'){const input=route.request().postDataJSON();const club={id:'00000000-0000-4000-8000-000000000001',name:input.name,version:1,members:0,updatedAt:'2026-11-23T11:00:00Z'};clubs=[...clubs,club];await route.fulfill({status:201,json:{club}});}else await route.fulfill({json:{clubs}});});
  await page.route('**/api/admin/users',route=>route.fulfill({json:{accounts,total:3,truncated:false}}));let roleError=true,assigned:any;
  await page.route('**/api/admin/clubs/*/memberships',async route=>{assigned=route.request().postDataJSON();if(roleError)await route.fulfill({status:401,json:{error:'Meld je opnieuw aan voordat je clubrechten wijzigt.',code:'recent_auth_required'}});else{clubs=clubs.map(club=>club.id.endsWith('000001')?{...club,members:1}:club);await route.fulfill({json:{membership:{id:assigned.actorId}}});}});
  await page.goto('/#/platform/clubs');await expect(page.getByText('1–10 van 11',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Volgende pagina',exact:true}).click();await expect(page.getByText('11–11 van 11',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Vereniging toevoegen',exact:true}).click();await page.getByLabel('Naam van de vereniging').fill('Nieuwe testvereniging');await page.getByLabel('Primaire clubkleur').fill('#123456');await page.getByLabel('Secundaire clubkleur').fill('#abcdef');await page.getByRole('button',{name:'Clubomgeving aanmaken',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Nieuwe testvereniging is aangemaakt'})).toBeVisible();await page.getByRole('searchbox',{name:'Zoek vereniging'}).fill('Nieuwe testvereniging');await expect(page.getByRole('row').filter({hasText:'Nieuwe testvereniging'})).toContainText('0');
  await page.getByRole('button',{name:'Clubrol toewijzen voor Nieuwe testvereniging'}).click();const accountSelect=page.getByLabel('Geregistreerde gebruiker');await expect(accountSelect.locator('option')).toHaveCount(2);await expect(accountSelect).not.toContainText('pending@example.invalid');await expect(accountSelect).not.toContainText('platform@example.invalid');
  await accountSelect.selectOption('eligible-user');await page.getByLabel('Weergavenaam').fill('Behouden naam');await page.getByRole('button',{name:'Clubrol opslaan',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Meld je opnieuw aan');await expect(page.getByLabel('Weergavenaam')).toHaveValue('Behouden naam');
  roleError=false;await page.getByRole('button',{name:'Clubrol opslaan',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Clubrol opgeslagen'})).toBeVisible();expect(assigned).toEqual({actorId:'eligible-user',role:'club',name:'Behouden naam'});
  await expect(page.getByRole('row').filter({hasText:'Nieuwe testvereniging'})).toContainText('1');await page.setViewportSize({width:390,height:844});await noOverflow(page);
});

test('a failed registrations source does not hide successfully loaded associations or pretend it is empty',async({page})=>{
  await session(page);await page.route('**/api/admin/clubs',route=>route.fulfill({json:{clubs:[{id:'club-a',name:'Testvereniging Alfa',version:1,members:0}]}}));await page.route('**/api/admin/users',route=>route.fulfill({status:503,json:{error:'Tijdelijk niet beschikbaar'}}));
  await page.goto('/#/platform/clubs');await expect(page.getByRole('row').filter({hasText:'Testvereniging Alfa'})).toBeVisible();await expect(page.getByRole('alert')).toContainText('registraties');
  await page.getByRole('button',{name:/Persoonlijke registraties/}).click();await expect(page.getByText('Registraties zijn nog niet beschikbaar. Probeer opnieuw te laden.',{exact:true})).toBeVisible();await expect(page.getByText('Er zijn nog geen registraties',{exact:true})).toHaveCount(0);
});

test('a club actor opening a platform route never requests operational platform metadata',async({page})=>{
  const club={id:'synthetic-club',name:'Testredactie',clubId:'club-a',role:'club'};await session(page,club);let operationsRequests=0;await page.route('**/api/admin/operations',route=>{operationsRequests++;return route.fulfill({status:403,json:{error:'Geen toegang'}});});
  await page.goto('/#/platform/dashboard');await expect(page.getByRole('heading',{name:'Een hele club. Eén herkenbaar verhaal.'})).toBeVisible();expect(operationsRequests).toBe(0);await expect(page.getByRole('heading',{name:'Platformcockpit'})).toHaveCount(0);
});
