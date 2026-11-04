import {test,expect,type Page} from '@playwright/test';
import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
async function login(page:Page,account:string){await page.goto('/#/team/dashboard');await page.getByLabel('Testaccount',{exact:true}).selectOption(account);await page.getByRole('button',{name:'Open clubomgeving'}).click();await expect(page.locator('.v1-save-strip')).toContainText('Bewaard in clubomgeving');}

test('offline typing survives reload and does not claim a received submission',async({page,context})=>{
 await page.setViewportSize({width:390,height:844});await login(page,'havenlicht-team');
 await page.getByRole('button',{name:'Moment aanleveren',exact:true}).first().click();const dialog=page.getByRole('dialog');
 await dialog.locator('.ed-stepper button').first().click();await dialog.getByRole('combobox',{name:'Soort moment',exact:true}).selectOption('Clubnieuws');
 await dialog.locator('.ed-stepper button').nth(2).click();const title='Offline herstel '+Date.now();
 await context.setOffline(true);await dialog.getByLabel('Titel',{exact:true}).fill(title);await dialog.getByLabel('Korte toelichting').fill('Deze eigen tekst mag niet verloren gaan zonder verbinding.');
 await expect(page.locator('.v1-save-strip')).toContainText(/nog niet gesynchroniseerd|Bewaren mislukt/);
 await expect(dialog.getByRole('alert')).toContainText(/Geen verbinding/);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('castiq-recovery:havenlicht-team:')).length)).toBeGreaterThan(0);
 await context.setOffline(false);await page.reload();await page.getByRole('button',{name:'Moment aanleveren',exact:true}).first().click();
 await expect(page.getByRole('dialog').getByLabel('Titel',{exact:true})).toHaveValue(title);
 await expect(page.getByRole('dialog').getByLabel('Korte toelichting')).toHaveValue('Deze eigen tekst mag niet verloren gaan zonder verbinding.');
 await expect(page.locator('.v1-save-strip')).toContainText('Bewaard in clubomgeving');
 const workspace=await(await context.request.get('/api/workspace')).json();expect(workspace.state.content.filter((c:any)=>c.title===title)).toHaveLength(0);
 await page.getByRole('dialog').getByRole('button',{name:'Sluiten',exact:true}).click();
});

test('O10 public rendering hides scores and preserves the 27 default choices',async({page,context})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await login(page,'noordhaven-o10');
 const id=crypto.randomUUID();let workspace=await(await context.request.get('/api/workspace')).json();
 const result=await context.request.post('/api/commands',{data:{type:'content.save',expectedVersion:workspace.version,data:{item:{id,team:'O10-1',type:'Einduitslag',title:`Robin Bakker 2–1 · ${id}`,caption:'Robin Bakker speelde samen. Uitslag 2–1.',rawPlayerName:'Robin Bakker',namePolicy:'full',photoUsage:'no_photo',photoConsent:'unknown',homeScore:2,awayScore:1,scoreConfirmed:true,family:'Penseelkracht',date:'2026-11-07T12:00:00+01:00'}}}});
 expect(result.ok(),await result.text()).toBeTruthy();workspace=await result.json();const item=workspace.state.content.find((c:any)=>c.id===id);expect(item.namePolicy).toBe('anonymous');expect(item.homeScore).toBeUndefined();
 await page.goto('/#/team/content');await page.reload();await page.getByRole('button').filter({has:page.getByRole('heading',{name:item.title,exact:true})}).click();
 const poster=page.getByRole('dialog').locator('.ed-poster');await expect(poster).toContainText(/SAMEN\s*GESPEELD/);await expect(poster).not.toContainText(/2\s*[–-]\s*1|ROBIN BAKKER/);
 for(const [format,width,height] of [['Portret',1080,1350],['Vierkant',1080,1080],['Story',1080,1920],['Breed',1600,900]] as const){
  await page.getByRole('dialog').getByRole('button',{name:format,exact:true}).click();await expect(poster).toContainText(/SAMEN\s*GESPEELD/);await expect(poster).not.toContainText(/2\s*[–-]\s*1|ROBIN BAKKER/);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Afbeelding downloaden',exact:true}).click();const download=await downloadPromise;const metadata=await sharp(await readFile((await download.path())!)).metadata();expect(metadata.width).toBe(width);expect(metadata.height).toBe(height);
 }
 await page.getByRole('dialog').getByRole('button',{name:'Sluiten',exact:true}).click();await page.goto('/#/team/dashboard');
 await page.getByRole('button',{name:'Moment aanleveren',exact:true}).first().click();await page.getByRole('dialog').locator('.ed-stepper button').nth(2).click();
 const choices=page.getByRole('dialog').getByRole('combobox',{name:'Clubtemplate',exact:true});await expect(choices.locator('option')).toHaveCount(27);
 await page.getByRole('dialog').getByRole('button',{name:'Sluiten',exact:true}).click();
});
