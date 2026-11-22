import {test,expect} from '@playwright/test';

test('public website uses real access and studio information without fictional club records or checkout',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toContainText('ELK TEAM.');
 const text=await page.locator('body').innerText();
 expect(text).not.toMatch(/SC Getijde|FC Havenlicht|Jack Morauw|Goedemiddag, Sam|Noor ·|14 dagen|Voorstelprijzen|Gepubliceerd|Interactief productprototype|DEMO-KOPPELING/i);
 await expect(page.locator('#m-pricing')).toHaveCount(0);
 await expect(page.locator('#m-access')).toBeVisible();
 await expect(page.locator('.m-template-strip>button')).toHaveCount(27);
 await expect(page.getByRole('link',{name:'Voorwaarden',exact:true})).toHaveAttribute('href','/algemene-voorwaarden');
 await page.getByRole('tab',{name:'04 Opvolgen'}).click();
 await expect(page.locator('.m-tour-principle').filter({hasText:'Externe publicatiekanalen zijn nog niet aangesloten.'})).toBeVisible();
 await page.locator('.m-header-cta').click();
 await expect(page).toHaveURL(/#\/club\//);
});
