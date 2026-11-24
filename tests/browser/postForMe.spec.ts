import {test, expect, type Page} from '@playwright/test';

const callback = 'https://staging.castiq.nl/api/integrations/post-for-me/callback';
const webhook = 'https://staging.castiq.nl/api/integrations/post-for-me/webhook';
function workspace(actor: any) {
  return {actor, version: 1, state: {club: {id: actor.clubId, name: actor.clubId === 'club-b' ? 'Testclub Bravo' : 'Testclub Alfa', color: '#123456', accent: '#abcdef', hashtags: '', namePolicy: 'initials', plan: ''}, teams: [], players: [], matches: [], content: [], users: [], events: [], clubs: [], connections: [], activity: [], rules: {}, templateRequests: [], customTemplates: [], templates: [], v1: {drafts: {}, weekPlans: [], weekendReports: [], sponsorAgreements: [], publicationPaused: false, audit: []}}};
}
async function session(page: Page, role: 'club' | 'platform' = 'club') {
  const actor = {id: 'synthetic-pfm-user', name: 'Testbeheerder', role, clubId: role === 'platform' ? '__platform__' : 'club-a'};
  const memberships = role === 'club' ? [actor, {...actor, clubId: 'club-b', clubName: 'Testclub Bravo'}] : [actor];
  const selected = (headers: Record<string, string>) => memberships.find(item => item.clubId === headers['x-castiq-club-id']) || actor;
  await page.route('**/api/session', route => route.fulfill({json: {actor: selected(route.request().headers()), identity: {id: actor.id, status: 'active'}, memberships, accounts: [], authMode: 'local', environment: 'staging', legal: null}}));
  await page.route('**/api/workspace', route => route.fulfill({json: workspace(selected(route.request().headers()))}));
  return actor;
}
async function noOverflow(page: Page) {expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);}
function integration() {
  return {available: true, provider: 'post-for-me', mode: 'quickstart', projectId: 'synthetic-staging-project', version: 1, configured: false, enabled: false, secureStorageConfigured: true, apiTest: {status: 'untested', checkedAt: null, message: ''}, webhook: {status: 'unconfigured', checkedAt: null, message: ''}, redirectUrl: callback, webhookUrl: webhook};
}

test('platform Post for Me settings preserve a blank key, separate API testing and webhook registration, and require a tested key before enabling', async ({page}) => {
  await session(page, 'platform'); let row = integration(); const writes: any[] = [], actions: string[] = [];
  await page.route('**/api/admin/integrations', route => route.fulfill({json: {integrations: []}}));
  await page.route('**/api/admin/integrations/post-for-me', async route => {
    if (route.request().method() === 'PUT') {const body = route.request().postDataJSON(); writes.push(body); expect(body.expectedVersion).toBe(row.version); row = {...row, version: row.version + 1, configured: true, projectId: body.projectId, enabled: body.enabled, ...(body.apiKey ? {apiTest: {status: 'untested', checkedAt: null, message: ''}} : {})};}
    await route.fulfill({json: {integration: row}});
  });
  for (const action of ['test', 'webhook']) await page.route('**/api/admin/integrations/post-for-me/' + action, async route => {actions.push(action); expect(route.request().postDataJSON()).toEqual({expectedVersion: row.version}); row = {...row, version: row.version + 1, ...(action === 'test' ? {apiTest: {status: 'success', checkedAt: '2026-11-24T09:00:00Z', message: 'De API-sleutel werkt.'}} : {webhook: {status: 'registered', checkedAt: '2026-11-24T09:01:00Z', message: 'Bestaande registratie behouden.'}})}; await route.fulfill({json: {integration: row}});});
  await page.goto('/#/platform/providers'); const card = page.locator('.post-for-me-settings');
  await expect(card.getByLabel('Project Redirect URL', {exact: true})).toHaveValue(callback); await expect(card.getByLabel('Webhook URL', {exact: true})).toHaveValue(webhook);
  const enable = card.getByRole('checkbox'); await expect(enable).toBeDisabled(); await expect(card.getByRole('button', {name: 'Test API-verbinding', exact: true})).toBeDisabled(); await expect(card).toContainText('Post for Me');
  await card.getByLabel('API-sleutel stagingproject', {exact: true}).fill('synthetic-not-a-live-secret'); await card.getByRole('button', {name: 'Post for Me-instellingen bewaren'}).click(); await expect(card.getByLabel('API-sleutel stagingproject', {exact: true})).toHaveValue(''); expect(writes[0].apiKey).toBe('synthetic-not-a-live-secret'); expect(writes[0].enabled).toBe(false);
  await card.getByRole('button', {name: 'Test API-verbinding', exact: true}).click(); await expect(card).toContainText('Verbinding geslaagd'); await expect(enable).toBeEnabled(); expect(actions).toEqual(['test']);
  await enable.check(); await card.getByRole('button', {name: 'Post for Me-instellingen bewaren'}).click(); await expect(card).toContainText('Ingeschakeld'); expect(writes[1]).not.toHaveProperty('apiKey'); expect(writes[1].enabled).toBe(true);
  await card.getByRole('button', {name: 'Webhook registreren', exact: true}).click(); await expect(card).toContainText('Webhook geregistreerd'); expect(actions).toEqual(['test', 'webhook']);
  await card.getByLabel('API-sleutel stagingproject', {exact: true}).fill('synthetic-replacement'); await expect(enable).not.toBeChecked(); await expect(enable).toBeDisabled(); await card.getByRole('button', {name: 'Post for Me-instellingen bewaren'}).click(); await expect(card).toContainText('Nog niet getest'); expect(writes[2].enabled).toBe(false);
  await page.setViewportSize({width: 390, height: 844}); await noOverflow(page); await expect(card.getByLabel('Project Redirect URL', {exact: true})).toBeVisible(); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({path: '.local/post-for-me-visual/platform-mobile.png', fullPage: true});
});

test('club wizard identifies Post for Me, finishes authenticated callbacks and requires an eligible account and final confirmation', async ({page}) => {
  await session(page); const id = '11111111-1111-4111-8111-111111111111'; let status = 'pending', selected: any = null, finishCount = 0;
  const channel = {provider: 'facebook', name: 'Facebook', integration: 'post-for-me', configured: true, version: 0, status: 'disconnected', accountName: '', destinations: [] as string[], checkedAt: null, expiresAt: null, login: 'Post for Me Quickstart'};
  const candidates = [{id: 'synthetic-eligible-page', name: 'Eigen clubpagina', type: 'page', destinations: ['Facebook-post'], selectable: true}, {id: 'synthetic-blocked-page', name: 'Niet bevestigde kandidaat', type: 'page', destinations: ['Facebook-post'], selectable: false, blockedReason: 'Deze pagina kan niet betrouwbaar aan de actieve vereniging worden gekoppeld.'}];
  await page.route('**/api/channels', route => route.fulfill({json: {publicationMode: 'provider', providers: [channel]}}));
  await page.context().route('**/synthetic-pfm-consent', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><title>Post for Me test</title><p>Gesimuleerde toestemming.</p>'}));
  await page.route('**/api/channels/facebook/start', route => route.fulfill({status: 201, json: {flowId: id, authorizationUrl: new URL('/synthetic-pfm-consent', page.url()).href}}));
  await page.route('**/api/channels/flows/' + id, route => route.fulfill({json: {flowId: id, provider: 'facebook', status, candidates: status === 'select' ? candidates : []}}));
  await page.route('**/api/channels/post-for-me/finish', async route => {expect(route.request().postDataJSON()).toEqual({flowId: id}); finishCount++; status = 'select'; await route.fulfill({json: {flowId: id, provider: 'facebook', status, candidates}});});
  await page.route('**/api/channels/facebook/select', async route => {selected = route.request().postDataJSON(); expect(selected).toEqual({flowId: id, accountId: candidates[0].id}); Object.assign(channel, {version: 1, status: 'connected', accountName: candidates[0].name, destinations: candidates[0].destinations}); status = 'connected'; await route.fulfill({json: {publicationMode: 'provider', providers: [channel]}});});
  await page.goto('/#/club/channels'); await expect(page.getByLabel('API-sleutel stagingproject', {exact: true})).toHaveCount(0); await page.getByRole('button', {name: 'Facebook koppelen', exact: true}).click(); const dialog = page.getByRole('dialog'); await dialog.getByRole('button', {name: 'Verder', exact: true}).click(); await expect(dialog).toContainText('Op het toestemmingsscherm zie je de naam Post for Me');
  const popupPromise = page.waitForEvent('popup'); await dialog.getByRole('button', {name: 'Doorgaan naar Facebook', exact: true}).click(); const popup = await popupPromise; status = 'returned'; await dialog.getByRole('button', {name: 'Status controleren', exact: true}).click();
  await expect(dialog.getByRole('radio', {name: /Eigen clubpagina/})).toBeVisible(); await expect(dialog.getByRole('radio', {name: /Niet bevestigde kandidaat/})).toBeDisabled(); expect(finishCount).toBe(1); expect(selected).toBeNull();
  await dialog.getByRole('radio', {name: /Eigen clubpagina/}).check(); await dialog.getByRole('button', {name: 'Verder', exact: true}).click(); expect(selected).toBeNull(); await dialog.getByRole('button', {name: 'Account koppelen', exact: true}).click(); await expect(dialog.getByRole('heading', {name: 'Koppeling bevestigd', exact: true})).toBeVisible(); await popup.close();
  await page.setViewportSize({width: 390, height: 844}); await noOverflow(page); await page.screenshot({path: '.local/post-for-me-visual/club-confirmation-mobile.png', fullPage: true});
});

test('a callback reload restores the selected club and cannot treat the callback itself as a connection', async ({page}) => {
  const actor = await session(page), flowId = '22222222-2222-4222-8222-222222222222'; let finishes = 0; const observedClubs: string[] = [];
  await page.addInitScript(({id, flowId}) => {sessionStorage.setItem('castiq-active-club', 'club-b'); sessionStorage.setItem(`castiq-channel-flow:${id}:club-b`, flowId);}, {id: actor.id, flowId});
  await page.route('**/api/channels', route => {observedClubs.push(route.request().headers()['x-castiq-club-id']); return route.fulfill({json: {publicationMode: 'provider', providers: [{provider: 'instagram', name: 'Instagram', integration: 'post-for-me', configured: true, version: 0, status: 'disconnected', accountName: '', destinations: [], checkedAt: null, expiresAt: null, login: 'Post for Me'}]}});});
  await page.route('**/api/channels/flows/' + flowId, route => route.fulfill({json: {flowId, provider: 'instagram', status: 'returned', candidates: []}}));
  await page.route('**/api/channels/post-for-me/finish', route => {finishes++; expect(route.request().headers()['x-castiq-club-id']).toBe('club-b'); return route.fulfill({json: {flowId, provider: 'instagram', status: 'select', candidates: [{id: 'synthetic-bravo-account', name: '@club_bravo', type: 'professional', destinations: ['Instagram-feed']}]}});});
  await page.goto('/#/club/channels?postForMeReturn=1'); await expect(page.getByRole('heading', {name: 'Koppelingen', exact: true})).toBeVisible(); await expect(page.locator('.workspace-selector')).toContainText('Testclub Bravo'); await expect(page.getByRole('radio', {name: /@club_bravo/})).toBeVisible(); expect(observedClubs.every(id => id === 'club-b')).toBe(true); expect(finishes).toBe(1); await expect(page.locator('.social-server-directory')).toContainText('Niet gekoppeld'); await expect(page).toHaveURL(/#\/club\/channels$/);
});

test('disabled Post for Me cannot start club authorization and a pending attempt can be explicitly cancelled', async ({page}) => {
  await session(page); let configured = false, starts = 0, cancelled = false;
  await page.route('**/api/channels', route => route.fulfill({json: {publicationMode: 'provider', providers: [{provider: 'instagram', name: 'Instagram', integration: 'post-for-me', configured, version: 0, status: 'disconnected', accountName: '', destinations: [], checkedAt: null, expiresAt: null, login: 'Post for Me'}]}}));
  await page.context().route('**/synthetic-pfm-consent', route => route.fulfill({contentType: 'text/html', body: '<!doctype html><p>Gesimuleerd.</p>'}));
  const flowId = '33333333-3333-4333-8333-333333333333';
  await page.route('**/api/channels/instagram/start', route => {starts++; return route.fulfill({json: {flowId, authorizationUrl: new URL('/synthetic-pfm-consent', page.url()).href}});});
  await page.route('**/api/channels/flows/' + flowId, route => route.fulfill({json: {flowId, provider: 'instagram', status: 'pending', candidates: []}}));
  await page.route('**/api/channels/post-for-me/cancel', route => {cancelled = true; expect(route.request().postDataJSON()).toEqual({flowId}); return route.fulfill({json: {ok: true}});});
  await page.goto('/#/club/channels'); await page.getByRole('button', {name: 'Instagram koppelen', exact: true}).click(); const dialog = page.getByRole('dialog'); await dialog.getByRole('button', {name: 'Verder', exact: true}).click(); await expect(dialog.getByRole('button', {name: 'Doorgaan naar Instagram', exact: true})).toBeDisabled(); expect(starts).toBe(0); await dialog.getByRole('button', {name: 'Sluiten', exact: true}).click();
  configured = true; await page.getByRole('button', {name: 'Verversen', exact: true}).click(); await page.getByRole('button', {name: 'Instagram koppelen', exact: true}).click(); await dialog.getByRole('button', {name: 'Verder', exact: true}).click(); const popupPromise = page.waitForEvent('popup'); await dialog.getByRole('button', {name: 'Doorgaan naar Instagram', exact: true}).click(); const popup = await popupPromise; await dialog.getByRole('button', {name: 'Koppelpoging annuleren', exact: true}).click(); expect(cancelled).toBe(true); await expect(dialog.getByRole('button', {name: 'Doorgaan naar Instagram', exact: true})).toBeEnabled(); await expect(dialog.getByRole('radio')).toHaveCount(0); await popup.close();
});

test('partial publication shows the result per channel and retries only the failed channel without changing a confirmed post', async ({page}) => {
  const actor = await session(page), envelope: any = workspace(actor); let retried: any = null;
  envelope.state.publicationMode = 'provider'; envelope.state.connections = [{name: 'Facebook', connected: true, destinations: ['Facebook-post']}, {name: 'Instagram', connected: true, destinations: ['Instagram-feed']}];
  const confirmed = {id: 'facebook-confirmed', channel: 'Facebook-post', status: 'published', version: 1, attempt: 1, adapter: 'post-for-me', providerMode: 'provider', requestId: 'fb-request', receipt: {kind: 'provider', provider: 'facebook', providerPostId: 'synthetic-confirmed-fb', url: 'https://www.facebook.com/synthetic-page/posts/synthetic-post', confirmedAt: '2026-11-24T09:00:00Z', requestId: 'fb-request', version: 1}};
  envelope.state.content = [{id: 'partial-post', title: 'Gesimuleerd kanaalresultaat', caption: 'Een synthetisch bericht voor de browsercontrole.', type: 'Clubnieuws', team: 'Clubbreed', family: 'Penseelkracht', version: 1, approvedVersion: 1, status: 'failed', photoUsage: 'no_photo', photoConsent: 'unknown', namePolicy: 'initials', author: 'Clubredactie', date: '2026-11-24T09:00:00Z', jobs: [confirmed, {id: 'instagram-failed', channel: 'Instagram-feed', status: 'failed', version: 1, attempt: 1, adapter: 'post-for-me', providerMode: 'provider', requestId: 'ig-request', error: 'Instagram kon de afbeelding niet verwerken.'}]}];
  await page.route('**/api/workspace', route => route.fulfill({json: envelope}));
  await page.route('**/api/commands', route => {retried = route.request().postDataJSON(); expect(retried).toMatchObject({type: 'publication.retry', data: {id: 'partial-post', expectedRevision: 1, jobId: 'instagram-failed'}}); envelope.version++; envelope.state.content[0].jobs[1] = {...envelope.state.content[0].jobs[1], status: 'queued', attempt: 2, error: ''}; return route.fulfill({json: envelope});});
  await page.goto('/#/club/content'); await page.locator('.ed-card').filter({hasText: 'Gesimuleerd kanaalresultaat'}).click(); const dialog = page.getByRole('dialog'); const facebook = dialog.locator('.ed-job').filter({hasText: 'Facebook-post'}), instagram = dialog.locator('.ed-job').filter({hasText: 'Instagram-feed'});
  await expect(facebook).toContainText('Gepubliceerd'); await expect(facebook.getByRole('link', {name: 'Bekijk gepubliceerd bericht'})).toHaveAttribute('href', confirmed.receipt.url); await expect(facebook.getByRole('button', {name: 'Alleen dit kanaal opnieuw proberen'})).toHaveCount(0); await expect(instagram).toContainText('Mislukt'); await expect(instagram).toContainText('Instagram kon de afbeelding niet verwerken.');
  await instagram.getByRole('button', {name: 'Alleen dit kanaal opnieuw proberen'}).click(); await expect(instagram).toContainText('Bezig'); expect(retried.data.jobId).toBe('instagram-failed'); await expect(facebook).toContainText(confirmed.receipt.providerPostId); await expect(facebook.getByRole('link', {name: 'Bekijk gepubliceerd bericht'})).toHaveAttribute('href', confirmed.receipt.url);
  await page.goto('/#/club/stats'); await expect(page.locator('.scm-metrics .scm-panel').filter({hasText: 'Extern bevestigd'}).locator('strong')).toHaveText('1');
});
