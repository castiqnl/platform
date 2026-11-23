import {test, expect, type Page} from '@playwright/test';
const policy = {version: 1, discountPercent: 10, currency: 'EUR', tax: 'exclusive', billingActivated: false as const, plans: [
  {name: 'Gratis', baseCents: 0, teamLimit: null, description: 'Met Castiq-partnerlogo'},
  {name: 'Start', baseCents: 3900, teamLimit: 5, description: 'Een basis voor kleine clubs'},
  {name: 'Club', baseCents: 6900, teamLimit: 20, description: 'Voor alle clubteams'},
  {name: 'Pro', baseCents: 11900, teamLimit: 50, description: 'Meer ruimte voor je vereniging'},
]};
function quote(planName = 'Gratis', optedIn = false, choiceVersion = 0, current = policy) {
  const plan = current.plans.find(value => value.name === planName)!;
  const required = planName === 'Gratis', discountPercent = !required && optedIn ? current.discountPercent : 0;
  const savingsCents = Math.floor((plan.baseCents * discountPercent + 50) / 100);
  return {plan: planName, baseCents: plan.baseCents, savingsCents, netCents: plan.baseCents - savingsCents, teamLimit: plan.teamLimit, discountPercent, partnerLogo: required || optedIn, required, optedIn, policyVersion: current.version, choiceVersion, capturedAt: '2026-11-23T12:00:00Z', billingStatus: 'not_activated'};
}
const clubs = Array.from({length: 42}, (_, index) => ({id: 'club-' + index, name: 'Vereniging ' + String(index + 1).padStart(2, '0'), activeTeams: index, choiceVersion: index % 3, members: index % 2 ? 2 : 0, hasClubManager: index % 2 === 1, status: index % 2 ? 'active' : 'setup', trial: index % 7 === 0, snapshot: quote(policy.plans[index % 4].name)}));
async function session(page: Page, role: 'platform' | 'club' = 'platform') {
  const actor = {id: 'synthetic-plan-' + role, name: 'Testbeheerder', role, clubId: role === 'platform' ? '__platform__' : 'synthetic-club'};
  await page.route('**/api/session', route => route.fulfill({json: {actor, identity: {id: actor.id, status: 'active'}, memberships: [actor], accounts: [], authMode: 'local', environment: 'local', legal: null}}));
  await page.route('**/api/workspace', route => route.fulfill({json: {version: 1, actor, state: {activeMatchId: '', club: {id: actor.clubId, name: 'Testvereniging', color: '#124e78', accent: '#ffffff', hashtags: '', plan: '', trial: false}, teams: [], content: [], matches: [], players: [], users: [], events: [], clubs: [], connections: [], activity: [], rules: {}, templateRequests: [], customTemplates: [], templates: [], v1: {drafts: {}, weekPlans: [], weekendReports: [], sponsorAgreements: [], audit: [], publicationPaused: true}}}}));
}
async function noOverflow(page: Page) {expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);}

test('server plan directory restores usage, bundle/status filters, trimmed search, sorting and pagination at desktop and mobile widths', async ({page}) => {
  await session(page); await page.route('**/api/admin/plans', route => route.fulfill({json: {policy, clubs}}));
  await page.setViewportSize({width: 1400, height: 1000}); await page.goto('/#/platform/plans');
  const bundles = page.getByRole('region', {name: 'Bundels', exact: true});
  await expect(bundles.locator('tr[data-plan="Gratis"] td').last()).toHaveText('11');
  await expect(bundles.locator('tr[data-plan="Pro"] td').last()).toHaveText('10');
  await expect(page.getByText('Pagina 1 van 3', {exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Volgende', exact: true}).click(); await expect(page.getByText('Pagina 2 van 3', {exact: true})).toBeVisible();
  await page.getByRole('combobox', {name: 'Filter op bundel'}).selectOption('Start');
  await expect(page.locator('.platform-plans-result')).toHaveText('11 van 42 verenigingen');
  await expect(page.locator('.platform-club-plans-table tbody tr')).toHaveCount(11);
  await page.getByRole('textbox', {name: 'Zoek vereniging', exact: true}).fill('   vereniging 02  ');
  await expect(page.locator('.platform-club-plans-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.platform-club-plans-table tbody')).toContainText('Vereniging 02');
  await page.getByRole('textbox', {name: 'Zoek vereniging', exact: true}).fill('');
  await page.getByRole('combobox', {name: 'Filter op bundel'}).selectOption('');
  await page.getByRole('combobox', {name: 'Filter op clubstatus'}).selectOption('setup');
  await expect(page.locator('.platform-plans-result')).toContainText('21 van 42');
  await page.getByRole('combobox', {name: 'Sorteer verenigingen'}).selectOption('teams');
  await expect(page.locator('.platform-club-plans-table tbody tr').first()).toContainText('Vereniging 41');
  await page.getByRole('combobox', {name: 'Filter op clubstatus'}).selectOption('trial');
  await expect(page.locator('.platform-plans-result')).toHaveText('6 van 42 verenigingen');
  await page.setViewportSize({width: 390, height: 844}); await noOverflow(page);
  await page.getByRole('button', {name: 'Prijzen en korting instellen'}).click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox(); expect(bounds!.x).toBeGreaterThanOrEqual(0); expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(391);
  await noOverflow(page); await page.screenshot({path: '.local/plan-completion-visual/platform-mobile-form.png', fullPage: true});
});

test('policy conflicts preserve entered amounts and require comparison before a fresh version can be saved', async ({page}) => {
  await session(page); let current = structuredClone(policy), attempts = 0; const sent: any[] = [];
  await page.route('**/api/admin/plans', async route => {
    if (route.request().method() === 'PUT') {
      const input = route.request().postDataJSON(); sent.push(input); attempts++;
      if (attempts === 1) {current = {...current, version: 2, discountPercent: 15}; current.plans[1].baseCents = 5000; await route.fulfill({status: 409, json: {code: 'conflict', error: 'De tarieven zijn intussen gewijzigd. Herlaad eerst.'}});}
      else {current = {...current, version: 3, plans: input.plans, discountPercent: input.discountPercent}; await route.fulfill({json: {policy: current, clubs}});}
    } else await route.fulfill({json: {policy: current, clubs}});
  });
  await page.goto('/#/platform/plans'); await page.getByRole('button', {name: 'Prijzen en korting instellen'}).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Maandprijs Start', {exact: true}).fill('44,95');
  await dialog.getByRole('button', {name: 'Nieuwe tariefversie opslaan'}).click();
  await expect(dialog.getByLabel('Maandprijs Start', {exact: true})).toHaveValue('44,95');
  await expect(dialog.locator('.platform-plan-conflict')).toContainText('versie 2');
  await expect(dialog.locator('.platform-plan-conflict')).toContainText('50,00');
  await expect(dialog.getByRole('button', {name: 'Nieuwe tariefversie opslaan'})).toBeDisabled();
  await dialog.getByRole('button', {name: 'Vergelijking bevestigd — mijn invoer behouden'}).click();
  await expect(dialog.getByLabel('Maandprijs Start', {exact: true})).toHaveValue('44,95');
  await dialog.getByRole('button', {name: 'Nieuwe tariefversie opslaan'}).click();
  await expect(dialog).not.toBeVisible(); expect(sent[0].expectedVersion).toBe(1); expect(sent[1].expectedVersion).toBe(2); expect(sent[1].plans.find((plan: any) => plan.name === 'Start').baseCents).toBe(4495);
  await expect(page.getByRole('region', {name: 'Bundels', exact: true})).toContainText('44,95');
});

test('a delayed refresh cannot overwrite a newly saved central policy and a refresh failure keeps the directory available', async ({page}) => {
  await session(page); let current = structuredClone(policy), reads = 0, release: () => void = () => {}, held = false, fail = false;
  const pending = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/admin/plans', async route => {
    if (route.request().method() === 'PUT') {const input = route.request().postDataJSON(); current = {...current, version: 2, plans: input.plans}; await route.fulfill({json: {policy: current, clubs}}); return;}
    reads++;
    if (reads === 2) {const previous = structuredClone(current); held = true; await pending; await route.fulfill({json: {policy: previous, clubs}}); return;}
    if (fail) await route.fulfill({status: 503, json: {error: 'Tijdelijk niet bereikbaar', code: 'unavailable'}});
    else await route.fulfill({json: {policy: current, clubs}});
  });
  await page.goto('/#/platform/plans'); await expect(page.locator('.platform-plans-result')).toContainText('42 van 42');
  await page.getByRole('button', {name: 'Verversen', exact: true}).click(); await expect.poll(() => held).toBe(true);
  await page.getByRole('button', {name: 'Prijzen en korting instellen'}).click();
  await page.getByRole('dialog').getByLabel('Maandprijs Start', {exact: true}).fill('47.50');
  await page.getByRole('button', {name: 'Nieuwe tariefversie opslaan'}).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  const response = page.waitForResponse(value => value.url().endsWith('/api/admin/plans') && value.request().method() === 'GET'); release(); await (await response).finished();
  await expect(page.getByRole('region', {name: 'Bundels', exact: true})).toContainText('tarieven versie 2');
  await expect(page.getByRole('region', {name: 'Bundels', exact: true})).toContainText('47,50');
  fail = true; await page.getByRole('button', {name: 'Verversen', exact: true}).click();
  await expect(page.getByRole('alert')).toContainText('Tijdelijk niet bereikbaar');
  await expect(page.locator('.platform-club-plans-table tbody tr')).toHaveCount(20);
});

test('club plan conflict shows current rates and preserves the intended choice for explicit confirmation', async ({page}) => {
  await session(page, 'club'); let current = structuredClone(policy), snapshot = quote('Gratis'), attempts = 0; const sent: any[] = [];
  await page.route('**/api/club/plan', async route => {
    if (route.request().method() === 'PUT') {
      const input = route.request().postDataJSON(); sent.push(input); attempts++;
      if (attempts === 1) {current = {...current, version: 2}; current.plans[2].baseCents = 7500; snapshot = quote('Pro', false, 1, current); await route.fulfill({status: 409, json: {error: 'Bundel of tarieven zijn gewijzigd. Herlaad en bevestig opnieuw.', code: 'conflict'}}); return;}
      snapshot = quote(input.plan, input.optedIn, 2, current);
    }
    await route.fulfill({json: {policy: current, snapshot, activeTeams: 6, financialProcessing: 'Online betalen is nog niet beschikbaar.'}});
  });
  await page.goto('/#/club/subscription');
  await expect(page.locator('.cp-plan-list li').filter({hasText: 'Castiq Start'}).getByRole('button', {name: 'Kies', exact: true})).toBeDisabled();
  await page.locator('.cp-plan-list li').filter({hasText: 'Castiq Club'}).getByRole('button', {name: 'Kies', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Controleer je keuze opnieuw'})).toContainText('75,00');
  await expect(page.getByRole('region', {name: 'Centrale bundelkeuze'})).toContainText('Castiq Pro');
  expect(sent).toHaveLength(1); await page.getByRole('button', {name: 'Keuze opnieuw bevestigen', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Controleer je keuze opnieuw'})).toHaveCount(0);
  expect(sent[1]).toMatchObject({plan: 'Club', optedIn: false, expectedVersion: 1, expectedPolicyVersion: 2});
  await expect(page.getByRole('region', {name: 'Centrale bundelkeuze'})).toContainText('Castiq Club');
  await page.setViewportSize({width: 390, height: 844}); await noOverflow(page);
  await page.screenshot({path: '.local/plan-completion-visual/club-mobile.png', fullPage: true});
});
