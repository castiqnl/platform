import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';

test('centrale studio bewaart groepen, effecten en alle formaten; resize, slot en vaste partnerlaag',async({page,context})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 expect((await context.request.post('/api/session',{data:{accountId:'platform'}})).ok()).toBeTruthy();
 await page.setViewportSize({width:1600,height:1100});
 await page.goto('/#/platform/template-studio');
 await expect(page.getByText('Concepten en gepubliceerde versies worden centraal opgeslagen.')).toBeVisible();
 const name='Centrale canvasproef '+Date.now();
 await page.getByRole('button',{name:'Nieuw template',exact:true}).click();await page.getByLabel('Templatenaam',{exact:true}).fill(name);await page.getByRole('button',{name:'Canvas openen',exact:true}).click();
 const studio=page.locator('.cq-studio');await expect(studio).toBeVisible();
 const layer=(id:string)=>studio.locator(`[data-layer="${id}"]`);
 await layer('label').click();
 const width=studio.locator('[data-field="width"]'),height=studio.locator('[data-field="height"]');
 const originalWidth=Number(await width.inputValue()),originalHeight=Number(await height.inputValue());
 await width.fill('620');await width.press('Tab');await height.fill('180');await height.press('Tab');
 await expect(width).toHaveValue('620');await expect(height).toHaveValue('180');
 const handle=studio.locator('[data-resize-layer]').first();let box=await handle.boundingBox();expect(box).toBeTruthy();
 await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+45,box!.y+box!.height/2+25,{steps:6});await page.mouse.up();
 const freeWidth=Number(await width.inputValue()),freeHeight=Number(await height.inputValue());expect(freeWidth).toBeGreaterThan(620);expect(freeHeight).toBeGreaterThan(180);
 box=await studio.locator('[data-resize-layer]').first().boundingBox();await page.keyboard.down('Shift');await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2-25,box!.y+box!.height/2-15,{steps:6});await page.mouse.up();await page.keyboard.up('Shift');
 const proportion=Number(await width.inputValue())/Number(await height.inputValue());expect(proportion).toBeCloseTo(freeWidth/freeHeight,1);
 await studio.getByRole('button',{name:'Positie vergrendelen',exact:true}).click();await expect(width).toBeDisabled();await studio.getByRole('button',{name:'Positie ontgrendelen',exact:true}).click();
 await layer('score').click({modifiers:['Control']});await expect(studio.locator('[data-part="inspector-count"]')).toHaveText('2 lagen');
 await studio.getByRole('button',{name:'Groeperen',exact:true}).click();await studio.locator('[data-group-name]').fill('Gezamenlijk verhaal');await studio.locator('[data-group-name]').press('Tab');
 const order=await studio.locator('[data-part="layers"] [data-layer]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.layer));
 await studio.getByRole('button',{name:'Selectie naar voren',exact:true}).click();expect(await studio.locator('[data-part="layers"] [data-layer]').evaluateAll(nodes=>nodes.map(node=>(node as HTMLElement).dataset.layer))).not.toEqual(order);
 await width.fill('900');await width.press('Tab');await expect(width).toHaveValue('900');
 const groupHeight=Number(await height.inputValue());await height.fill(String(groupHeight+100));await height.press('Tab');await expect(height).toHaveValue(String(groupHeight+100));
 const groupWidth=Number(await width.inputValue()),afterHeight=Number(await height.inputValue());box=await studio.locator('[data-resize-layer]').first().boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2-20,box!.y+box!.height/2-10,{steps:6});await page.mouse.up();expect(Number(await width.inputValue())).toBeLessThan(groupWidth);
 const beforeShiftRatio=Number(await width.inputValue())/Number(await height.inputValue());box=await studio.locator('[data-resize-layer]').first().boundingBox();await page.keyboard.down('Shift');await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.down();await page.mouse.move(box!.x+box!.width/2+20,box!.y+box!.height/2+10,{steps:6});await page.mouse.up();await page.keyboard.up('Shift');expect(Number(await width.inputValue())/Number(await height.inputValue())).toBeCloseTo(beforeShiftRatio,1);expect(afterHeight).toBeGreaterThan(groupHeight);
 await studio.getByRole('button',{name:'Effecten',exact:true}).click();await studio.locator('[data-field="outlineEnabled"]').check();await studio.locator('[data-field="outlineWidth"]').fill('7');await studio.locator('[data-field="outlineWidth"]').press('Tab');await studio.locator('[data-field="shadowEnabled"]').check();await studio.locator('[data-field="shadowBlur"]').fill('20');await studio.locator('[data-field="shadowBlur"]').press('Tab');
 await studio.getByRole('button',{name:'Concept opslaan',exact:true}).click();await expect(studio.locator('[data-part="draft-status"]')).toHaveText('Concept opgeslagen');
 const response=await context.request.get('/api/admin/templates');expect(response.ok()).toBeTruthy();const saved=(await response.json()).templates.find((template:any)=>template.name===name);expect(saved).toBeTruthy();
 const edited=saved.draft.layouts['4:5'].filter((entry:any)=>['label','score'].includes(entry.id));expect(edited.every((entry:any)=>entry.groupName==='Gezamenlijk verhaal'&&entry.outlineWidth===7&&entry.shadowBlur===20)).toBeTruthy();
 const otherWidth=saved.draft.layouts['9:16'].find((entry:any)=>entry.id==='label').width;expect(otherWidth).not.toBe(900);
 await page.reload();await page.getByRole('button',{name:new RegExp(name)}).first().click();await expect(studio).toBeVisible();
 for(const format of['4:5','9:16','1:1','16:9']){await studio.locator(`[data-format="${format}"]`).click();await layer('castiq-partner-logo').click();await expect(studio.getByRole('heading',{name:'Verplichte partnerlaag'})).toBeVisible();await expect(studio.locator('[data-part="viewport"] [data-castiq-partner="true"]')).toHaveCount(1);await expect(studio.locator('[data-field="width"]')).toHaveCount(0);}
 await studio.getByRole('button',{name:'Versie publiceren',exact:true}).click();await studio.getByRole('button',{name:'Versie 1 publiceren',exact:true}).click();await expect(studio.locator('[data-part="draft-status"]')).toHaveText('Versie 1 gepubliceerd');
 let published=(await(await context.request.get('/api/admin/templates')).json()).templates.find((template:any)=>template.id===saved.id);const first=structuredClone(published.versions[0]);expect(published.publishedVersion).toBe(1);for(const layers of Object.values(first.layouts) as any[][])expect(layers.filter(layer=>layer.id==='castiq-partner-logo')).toHaveLength(1);
 await studio.locator('[data-format="4:5"]').click();await layer('label').click();await studio.getByRole('button',{name:'Groep opheffen',exact:true}).click();await layer('label').click();await studio.locator('[data-field="text"]').fill('Blijvend tweede ontwerp');await studio.locator('[data-field="text"]').press('Tab');await studio.getByRole('button',{name:'Versie publiceren',exact:true}).click();await studio.getByRole('button',{name:'Versie 2 publiceren',exact:true}).click();await expect(studio.locator('[data-part="draft-status"]')).toHaveText('Versie 2 gepubliceerd');published=(await(await context.request.get('/api/admin/templates')).json()).templates.find((template:any)=>template.id===saved.id);expect(published.versions[0]).toEqual(first);expect(published.versions[1].layouts['4:5'].find((entry:any)=>entry.id==='label').text).toBe('Blijvend tweede ontwerp');
 await studio.getByRole('button',{name:'Versies',exact:true}).click();await studio.locator('[data-version="1"]').click();await expect(studio.locator('[data-part="dialog-art"] [data-castiq-partner="true"]')).toHaveCount(1);
 expect(originalWidth).toBeGreaterThan(0);expect(originalHeight).toBeGreaterThan(0);expect(errors).toEqual([]);
});

test('bestaande SVG- en PNG-export blijven werken voor alle vier demoformaten',async({page})=>{
 await page.setViewportSize({width:1600,height:1100});await page.goto('/?demo=1#/club/studio-lab/editor');
 await expect(page.getByRole('button',{name:'Exporteren',exact:true})).toBeVisible();
 for(const[format,w,h]of[['Feed',1080,1350],['Story',1080,1920],['Vierkant',1080,1080],['Breed',1600,900]]as const)for(const kind of['svg','png']){
  await page.getByRole('button',{name:'Exporteren',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:new RegExp('^'+format+' ')}).click();await dialog.locator('select').selectOption(kind);
  const download=page.waitForEvent('download');await dialog.getByRole('button',{name:new RegExp('^Download '+kind.toUpperCase())}).click();const file=await download;expect(file.suggestedFilename()).toMatch(new RegExp('-'+w+'x'+h+'\\.'+kind+'$'));const path=await file.path();expect(path).toBeTruthy();const bytes=await readFile(path!);if(kind==='png'){expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);expect(bytes.readUInt32BE(16)).toBe(w);expect(bytes.readUInt32BE(20)).toBe(h);}else expect(bytes.toString('utf8')).toContain('<svg');
 }
});
