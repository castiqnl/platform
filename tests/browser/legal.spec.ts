import {test, expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {LEGAL_DOCUMENTS} from '../../shared/legalDocuments';

test('legal routes work without login, provide exact version downloads and fit mobile', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  for (const document of Object.values(LEGAL_DOCUMENTS)) {
    await page.goto(document.path);
    await expect(page.getByRole('heading', {level:1, name:document.title, exact:true})).toBeVisible();
    await expect(page.getByText('Versie 2026-11-22.1 · Ingangsdatum 22 november 2026', {exact:true})).toBeVisible();
    await expect(page.getByRole('link', {name:'Deze versie opslaan'})).toHaveAttribute('href',document.downloadPath);
    await expect(page.getByRole('button', {name:'Afdrukken / PDF'})).toBeVisible();
    expect(await page.locator('body').evaluate(body=>body.scrollWidth<=window.innerWidth+1)).toBe(true);
    const download=await page.request.get(document.downloadPath);
    expect(download.ok()).toBe(true);
    expect(createHash('sha256').update(await download.body()).digest('hex')).toBe(document.sha256);
    expect(await page.locator('main').innerText()).not.toMatch(/GEVERIFIEERD|VESTIGINGSADRES|Concept voor publicatie|Â·|â€/);
  }
  await page.goto('/bedrijfsgegevens');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Naar de inhoud'})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading',{name:'Bedrijfsgegevens',exact:true})).toBeVisible();
  await expect(page.getByText('88135713')).toBeVisible();
  await page.goto('/cookiebeleid');
  await expect(page.getByRole('heading',{level:1,name:'Cookies en browseropslag',exact:true})).toBeVisible();
  await page.goto('/subverwerkers');
  await expect(page.getByRole('heading',{level:1,name:'Leveranciers en verwerking',exact:true})).toBeVisible();
  await expect(page.getByText(/Frankfurt, Duitsland/)).toBeVisible();
});

test('public privacy request includes non-account users and gives a neutral receipt', async ({page}) => {
  let submitted:any;
  await page.route('**/api/privacy/requests',async route=>{
    submitted=route.request().postDataJSON();
    await route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({received:true})});
  });
  await page.goto('/account-verwijderen');
  await expect(page.getByRole('heading',{level:1,name:'Account en privacyverzoeken',exact:true})).toBeVisible();
  await page.getByLabel('Wat wil je aanvragen?').selectOption('erasure');
  await page.getByLabel('Je e-mailadres',{exact:true}).fill('privacy-qa@example.invalid');
  await page.getByLabel('Toelichting',{exact:true}).fill('Ik vraag namens een betrokkene om eerdere verwijdering.');
  await page.getByRole('button',{name:'Verzoek versturen',exact:true}).click();
  await expect(page.getByText('Je verzoek is ontvangen.',{exact:true})).toBeVisible();
  expect(submitted).toEqual({kind:'erasure',email:'privacy-qa@example.invalid',message:'Ik vraag namens een betrokkene om eerdere verwijdering.'});
  await expect(page.getByText('We geven via dit formulier geen informatie over het bestaan van een account.',{exact:false})).toBeVisible();
});
