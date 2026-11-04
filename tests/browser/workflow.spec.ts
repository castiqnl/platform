import {test,expect,type Page,type BrowserContext} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const label=`Mobiele proef ${Date.now()}`;
async function login(page:Page,account:string){await page.goto('/#/club/dashboard');await page.getByLabel('Testaccount',{exact:true}).selectOption(account);await page.getByRole('button',{name:'Open clubomgeving'}).click();await expect(page.locator('.prototype-pill')).toContainText('LOKALE TESTOMGEVING');await expect(page.locator('.v1-save-strip')).toContainText('Bewaard in clubomgeving');}
async function saved(page:Page){await expect(page.locator('.v1-save-strip')).toContainText('Bewaard in clubomgeving');}
async function openCreator(page:Page){await page.getByRole('button',{name:'Moment aanleveren',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();}
async function openItem(page:Page,title:string){await page.goto('/#/club/content');await page.reload();await page.getByRole('textbox',{name:'Zoek bijdragen',exact:true}).fill(title);await page.getByRole('button').filter({has:page.getByRole('heading',{name:title,exact:true})}).click();await expect(page.getByRole('dialog')).toBeVisible();}
async function command(context:BrowserContext,type:string,data:any){const response=await context.request.get('/api/workspace');const current=await response.json();const result=await context.request.post('/api/commands',{data:{type,data,expectedVersion:current.version}});expect(result.ok(),await result.text()).toBeTruthy();return result.json();}

test('mobiele foto en herstel op tweede apparaat, feedback, exacte goedkeuring, sandbox en conflict',async({browser})=>{
 const evidenceDir=process.env.CASTIQ_EVIDENCE_DIR||'test-results/evidence';await mkdir(evidenceDir,{recursive:true});
 const managerContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),clubContext=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const manager=await managerContext.newPage(),club=await clubContext.newPage();
 const errors:string[]=[];manager.on('pageerror',e=>errors.push(e.message));club.on('pageerror',e=>errors.push(e.message));
 await login(manager,'getijde-team');await openCreator(manager);const form=manager.getByRole('dialog');await form.locator('.ed-stepper button').first().click();
 await form.getByRole('combobox',{name:'Soort moment',exact:true}).selectOption('Wedstrijdverslag');await form.getByRole('button',{name:'Verder',exact:true}).click();
 const uploadResponse=manager.waitForResponse(response=>response.url().includes('/api/uploads'));await form.getByLabel('Foto toevoegen aan bijdrage',{exact:true}).setInputFiles('public/assets/team-photo.webp');expect((await uploadResponse).ok()).toBeTruthy();
 await expect(form.getByRole('combobox',{name:/Beeldvoorkeur/})).toBeVisible();await form.getByRole('combobox',{name:/Beeldvoorkeur/}).selectOption('approved');
 await expect(form.locator('.ed-poster image').first()).toHaveAttribute('href',/\/api\/media\//);await form.getByRole('button',{name:'Verder',exact:true}).click();
 await form.getByLabel('Titel',{exact:true}).fill(label);await form.getByLabel('Korte toelichting').fill('Samen speelden we een mooie wedstrijd. Bedankt aan de vrijwilligers.');
 await saved(manager);await manager.screenshot({path:`${evidenceDir}/local-mobile.png`,fullPage:false});
 expect(await manager.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 const secondContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});const second=await secondContext.newPage();await login(second,'getijde-team');await openCreator(second);
 await expect(second.getByRole('dialog').getByLabel('Titel',{exact:true})).toHaveValue(label);await expect(second.getByRole('dialog').getByLabel('Korte toelichting')).toHaveValue('Samen speelden we een mooie wedstrijd. Bedankt aan de vrijwilligers.');
 await second.getByRole('dialog').getByRole('button',{name:'Sluiten',exact:true}).click();await saved(second);await secondContext.close();
 await manager.reload();await openCreator(manager);await expect(manager.getByRole('dialog').getByLabel('Titel',{exact:true})).toHaveValue(label);
 await manager.getByRole('dialog').getByRole('button',{name:'Verder',exact:true}).click();await manager.getByRole('button',{name:'Naar clubredactie',exact:true}).click();
 await expect(manager.getByRole('dialog')).toContainText('nog niet goedgekeurd');await saved(manager);
 let workspace=await (await managerContext.request.get('/api/workspace')).json();const item=workspace.state.content.find((c:any)=>c.title===label);expect(item).toBeTruthy();expect(workspace.state.content.filter((c:any)=>c.title===label)).toHaveLength(1);
 await login(club,'getijde-club');await openItem(club,label);
 await club.getByLabel('Feedback voor de maker',{exact:true}).fill('Voeg de dank aan onze supporters toe.');await club.getByRole('button',{name:/Aanpassing vragen/}).click();await expect(club.getByRole('dialog')).toContainText('Aanpassing gevraagd');await saved(club);
 await openItem(manager,label);await expect(manager.getByRole('dialog')).toContainText('Voeg de dank aan onze supporters toe.');
 await manager.getByRole('button',{name:'Aanpassen',exact:true}).click();await manager.getByRole('textbox',{name:'Berichttekst wijzigen',exact:true}).fill('Samen speelden we een mooie wedstrijd. Bedankt aan de vrijwilligers en onze supporters.');await manager.getByRole('button',{name:'Nieuwe versie bewaren',exact:true}).click();await saved(manager);
 await manager.getByRole('button',{name:'Opnieuw ter beoordeling',exact:true}).click();await saved(manager);
 await openItem(club,label);await club.getByRole('button',{name:/Versie \d+ goedkeuren/}).click();await saved(club);await expect(club.getByRole('dialog')).toContainText('· goedgekeurd');
 await club.getByRole('button',{name:'Naar kanaalwachtrij',exact:true}).click();await expect(club.locator('.ed-job')).toHaveCount(1);await expect(club.locator('.ed-job')).not.toContainText('Demo-kanaalbevestiging ontvangen');
 await club.getByRole('button',{name:'Geen bevestiging (demo)',exact:true}).click();await expect(club.locator('.ed-job')).toContainText('Wacht op bevestiging');
 await club.getByRole('button',{name:'Bevestiging ontvangen (demo)',exact:true}).click();await expect(club.locator('.ed-receipt')).toContainText('geen externe publicatie');await saved(club);
 await club.screenshot({path:`${evidenceDir}/local-desktop.png`,fullPage:false});
 // Keep a local edit buffer while another editor changes the canonical revision.
 await club.getByRole('button',{name:'Aanpassen',exact:true}).click();await club.getByLabel('Titel wijzigen',{exact:true}).fill(label+' · mijn bewerking');await saved(club);
 workspace=await(await managerContext.request.get('/api/workspace')).json();const current=workspace.state.content.find((c:any)=>c.id===item.id);
 await command(managerContext,'content.save',{item:{...current,title:label+' · andere redacteur'},expectedRevision:current.version});
 await club.getByRole('button',{name:'Nieuwe versie bewaren',exact:true}).click();await expect(club.getByRole('dialog').getByRole('alert')).toBeVisible();await expect(club.getByLabel('Titel wijzigen',{exact:true})).toHaveValue(label+' · mijn bewerking');
 await expect(club.getByRole('button',{name:/Eigen wijzigingen opnieuw toepassen/})).toBeVisible();
 // Logging out preserves account-bound recovery without opening it for another tenant.
 await club.getByRole('dialog').getByRole('button',{name:'Sluiten',exact:true}).click();await saved(club);
 let releaseLate:()=>void=()=>{},oldFetched:()=>void=()=>{};const delayed=new Promise<void>(resolve=>{releaseLate=resolve}),fetched=new Promise<void>(resolve=>{oldFetched=resolve});let delayNext=true;
 await club.route('**/api/workspace',async route=>{if(!delayNext){await route.continue();return;}delayNext=false;const response=await route.fetch();oldFetched();await delayed;await route.fulfill({response});});
 await club.evaluate(()=>window.dispatchEvent(new Event('focus')));await fetched;
 await club.getByRole('button',{name:'Afmelden',exact:true}).click();await club.getByLabel('Testaccount',{exact:true}).selectOption('havenlicht-club');await club.getByRole('button',{name:'Open clubomgeving',exact:true}).click();await expect(club.locator('.workspace-selector')).toContainText('FC Havenlicht');
 const lateResponse=club.waitForResponse(response=>response.url().endsWith('/api/workspace')&&response.request().method()==='GET');releaseLate();await(await lateResponse).finished();await club.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await expect(club.locator('.workspace-selector')).toContainText('FC Havenlicht');await expect(club.locator('.app-content')).not.toContainText(label);await expect(club.getByRole('dialog')).toHaveCount(0);await club.unroute('**/api/workspace');
 for(const status of [401,403]){if(status===403)await login(club,'havenlicht-club');await club.route('**/api/workspace',route=>route.fulfill({status,json:{error:'De sessie of het clubrecht is verlopen. Meld opnieuw aan.',code:'unauthorized'}}),{times:1});await club.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(club.getByLabel('Testaccount',{exact:true})).toBeVisible();await expect(club.locator('.workspace-selector')).toHaveCount(0);}

 expect(errors).toEqual([]);await managerContext.close();await clubContext.close();
});

test('staging zonder publieke authconfiguratie blijft afgeschermd',async({page})=>{
 await page.route('**/api/session',route=>route.fulfill({json:{actor:null,accounts:[],authMode:'supabase',environment:'staging'}}));
 await page.goto('/#/club/dashboard');await expect(page.getByText('AFGESCHERMDE STAGING',{exact:true})).toBeVisible();
 await expect(page.getByRole('alert')).toContainText('nog niet geconfigureerd');await expect(page.getByLabel('Testaccount',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Open clubomgeving',exact:true})).toHaveCount(0);
});
