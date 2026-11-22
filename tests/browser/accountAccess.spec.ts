import {test,expect,type Page} from '@playwright/test';
import {LEGAL_DOCUMENTS} from '../../shared/legalDocuments';
const actor={id:'verified-account',name:'Eigen beheerder',clubId:'club-verified',role:'club'};
const documents=Object.values(LEGAL_DOCUMENTS).map(({kind,version,sha256,effectiveDate})=>({kind,version,sha256,effectiveDate}));
const acceptance=(scope:'personal'|'club',kind:'terms'|'processor',clubId:string|null=null)=>({scope,kind,version:LEGAL_DOCUMENTS[kind].version,sha256:LEGAL_DOCUMENTS[kind].sha256,club_id:clubId,accepted_at:'2026-11-22T10:00:00Z'});
const legalReady={documents,acceptances:[acceptance('personal','terms'),acceptance('club','terms',actor.clubId),acceptance('club','processor',actor.clubId)]};
function workspace(selected=actor){return {version:1,actor:selected,state:{activeMatchId:'',club:{id:selected.clubId,name:'Eigen vereniging',color:'#124e78',accent:'#f4ce31',hashtags:'',youthNames:'Voornaam + initiaal',plan:'',trial:false},teams:[],content:[],matches:[],players:[],users:[],events:[],clubs:[],connections:[],activity:[],rules:{},templateRequests:[],customTemplates:[],v1:{drafts:{},weekPlans:[],weekendReports:[],sponsorAgreements:[],audit:[],publicationPaused:true}}};}
async function mockSession(page:Page,getSession:()=>any){await page.route('**/api/session',route=>route.fulfill({json:{accounts:[],authMode:'supabase',environment:'staging',...getSession()}}));}

test('personal registration requires exact explicit acceptance before any workspace is opened',async({page})=>{
 let accepted=false,workspaceRequests=0;const submitted:any[]=[];
 await mockSession(page,()=>({actor:null,identity:{id:actor.id,email:'owner@example.invalid',status:accepted?'active':'registration_pending',deadline:accepted?null:'2099-11-29T10:00:00Z'},memberships:[],legal:{documents,acceptances:accepted?[acceptance('personal','terms')]:[]}}));
 await page.route('**/api/workspace',async route=>{workspaceRequests++;await route.fulfill({json:workspace()});});
 await page.route('**/api/legal/accept',async route=>{submitted.push(route.request().postDataJSON());accepted=true;await route.fulfill({json:{accepted:true}});});
 await page.goto('/#/club/dashboard');
 await expect(page.getByRole('heading',{name:'Je persoonlijke toegang',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Aanvaarden en verder'})).toBeDisabled();
 await expect(page.getByText('De privacyverklaring is informatie en vraagt geen akkoord.',{exact:false})).toBeVisible();
 expect(workspaceRequests).toBe(0);
 await page.getByRole('checkbox',{name:/Ik aanvaard de algemene voorwaarden voor mijn persoonlijke/}).check();
 await page.getByRole('button',{name:'Aanvaarden en verder'}).click();
 await expect(page.getByRole('heading',{name:'Je persoonlijke account staat klaar.',exact:true})).toBeVisible();
 expect(submitted).toHaveLength(1);expect(submitted[0]).toEqual({scope:'personal',documents:[{kind:'terms',version:LEGAL_DOCUMENTS.terms.version,sha256:LEGAL_DOCUMENTS.terms.sha256}]});
 expect(workspaceRequests).toBe(0);
 await expect(page.locator('body')).not.toContainText(/SC Getijde|FC Havenlicht|Sam de Wit|Fictieve testclubs/);
});

test('club acceptance is separate and requires explicit representative authority',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 let clubAccepted=false;const submitted:any[]=[];
 await mockSession(page,()=>({actor,identity:{id:actor.id,email:'owner@example.invalid',status:'active'},memberships:[{...actor,clubName:'Eigen vereniging'}],legal:clubAccepted?legalReady:{documents,acceptances:[acceptance('personal','terms')]}}));
 await page.route('**/api/workspace',route=>route.fulfill({json:workspace()}));
 await page.route('**/api/legal/accept',async route=>{submitted.push(route.request().postDataJSON());clubAccepted=true;await route.fulfill({json:{accepted:true}});});
 await page.goto('/#/club/dashboard');
 await expect(page.getByRole('heading',{name:'De afspraken voor jouw club',exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:/Ik aanvaard de algemene voorwaarden en verwerkersovereenkomst/}).check();
 await expect(page.getByRole('button',{name:'Afspraken namens de club vastleggen'})).toBeDisabled();
 await page.getByRole('checkbox',{name:/Ik ben bevoegd om deze club/}).check();
 await page.getByRole('button',{name:'Afspraken namens de club vastleggen'}).click();
 await expect(page.locator('.workspace-selector')).toContainText('Eigen vereniging');
 expect(submitted[0].scope).toBe('club');expect(submitted[0].clubId).toBe(actor.clubId);expect(submitted[0].authorizedRepresentative).toBe(true);expect(submitted[0].documents.map((item:any)=>item.kind)).toEqual(['terms','processor']);
 await expect(page.locator('a[href*="demo=1"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Castiq Studio',exact:false}).click();
 await expect(page.getByRole('heading',{name:'Alle 27 standaardstijlen',exact:true})).toBeVisible();
 await expect(page.locator('.live-studio-tile')).toHaveCount(27);
 await expect(page.locator('.live-studio')).not.toContainText(/SC GETIJDE|FC HAVENLICHT|ROBIN BAKKER|3 – 2/);
 expect(await page.locator('.live-studio image[href*="club-getijde"]')).toHaveCount(0);
 await page.getByRole('button',{name:'Bekijk Carbon',exact:true}).click();
 await expect(page.getByLabel('Standaardstijl',{exact:true})).toHaveValue('Carbon');
 await page.setViewportSize({width:390,height:844});expect(await page.locator('body').evaluate(body=>body.scrollWidth<=window.innerWidth+1)).toBe(true);await page.screenshot({path:'test-results/evidence/live-studio-mobile.png',fullPage:false,animations:'disabled'});
});

test('membership selection scopes all workspace requests and does not invent a role',async({page})=>{
 const second={...actor,clubId:'second-club',name:'Eigen beheerder'};const memberships=[{...actor,clubName:'Eerste vereniging'},{...second,clubName:'Tweede vereniging'}];let workspaceClub:string|undefined;
 await page.route('**/api/session',route=>{const selected=route.request().headers()['x-castiq-club-id'];return route.fulfill({json:{actor:selected?memberships.find(item=>item.clubId===selected):null,identity:{id:actor.id,email:'owner@example.invalid',status:'active'},memberships,legal:{documents,acceptances:[...legalReady.acceptances,acceptance('club','terms',second.clubId),acceptance('club','processor',second.clubId)]},environment:'staging',authMode:'supabase',accounts:[]}});});
 await page.route('**/api/workspace',route=>{workspaceClub=route.request().headers()['x-castiq-club-id'];return route.fulfill({json:workspace(workspaceClub===second.clubId?second:actor)});});
 await page.goto('/#/club/dashboard');await expect(page.getByRole('heading',{name:'Kies je clubomgeving.',exact:true})).toBeVisible();
 expect(workspaceClub).toBeUndefined();
 await page.getByRole('button',{name:/Tweede vereniging/}).click();
 await expect(page.locator('.workspace-selector')).toBeVisible();expect(workspaceClub).toBe(second.clubId);
 await expect(page.locator('.prototype-pill')).toContainText('STAGING');
});

test('a blocked personal account stays blocked until an explicit recovery request',async({page})=>{
 let recovered=false,recoveryRequests=0,workspaceRequests=0;
 await mockSession(page,()=>({actor,identity:{id:actor.id,email:'owner@example.invalid',status:recovered?'active':'deletion_pending',recoverable:!recovered,deletionReason:'self',deadline:recovered?null:'2099-12-22T10:00:00Z'},memberships:[{...actor,clubName:'Eigen vereniging'}],legal:legalReady}));
 await page.route('**/api/workspace',async route=>{workspaceRequests++;await route.fulfill({json:workspace()});});
 await page.route('**/api/privacy/recover',async route=>{recoveryRequests++;recovered=true;await route.fulfill({json:{recovered:true}});});
 await page.goto('/#/club/dashboard');await expect(page.getByRole('heading',{name:'Je account is geblokkeerd.',exact:true})).toBeVisible();expect(recoveryRequests).toBe(0);expect(workspaceRequests).toBe(0);
 await page.getByRole('button',{name:'Mijn persoonlijke account herstellen',exact:true}).click();await expect(page.locator('.workspace-selector')).toBeVisible();expect(recoveryRequests).toBe(1);expect(workspaceRequests).toBe(1);
});

test('platform administration shows actual metadata and exposes write-only mail settings',async({page})=>{
 const platform={...actor,role:'platform',clubId:'__platform__'};
 await mockSession(page,()=>({actor:platform,identity:{id:actor.id,email:'info@dgwebservices.nl',status:'active'},memberships:[{...platform,clubName:'Castiq Platform'}],legal:legalReady}));
 await page.route('**/api/workspace',route=>route.fulfill({json:workspace(platform)}));
 await page.route('**/api/admin/clubs',route=>route.fulfill({json:{clubs:[]}}));await page.route('**/api/admin/users',route=>route.fulfill({json:{accounts:[{id:actor.id,email:'info@dgwebservices.nl',status:'active',isPlatform:true,registeredAt:'2026-11-22T10:00:00Z'}]}}));
 await page.route('**/api/admin/mail',route=>route.fulfill({json:{configuration:{version:0,fromEmail:'',fromName:'Castiq',replyTo:'',apiKeyConfigured:false,webhookConfigured:false,encryptionReady:true},templates:[],outbox:[],deliveryProof:'Alleen een geverifieerd afleverbericht telt als bewijs.'}}));
 await page.goto('/#/platform/dashboard');await expect(page.getByRole('heading',{name:'Castiq beheer',exact:true})).toBeVisible();await expect(page.getByText('Er zijn nog geen clubomgevingen.',{exact:false})).toBeVisible();await expect(page.locator('.platform-tenant strong').filter({hasText:'info@dgwebservices.nl'})).toBeVisible();await expect(page.getByRole('combobox',{name:'Geregistreerde gebruiker',exact:true}).locator(`option[value="${actor.id}"]`)).toHaveCount(0);
 await page.getByRole('button',{name:'E-mail',exact:true}).click();await expect(page.getByRole('heading',{name:'Iedere mail herkenbaar Castiq.',exact:true})).toBeVisible();await expect(page.getByLabel('Nieuwe Resend API-sleutel',{exact:true})).toHaveAttribute('type','password');await expect(page.getByLabel('Nieuwe Resend API-sleutel',{exact:true})).toHaveValue('');await expect(page.locator('body')).not.toContainText(/Fictieve testclubs|SC Getijde|Sam de Wit/);
 await page.setViewportSize({width:390,height:844});expect(await page.locator('body').evaluate(body=>body.scrollWidth<=window.innerWidth+1)).toBe(true);await page.screenshot({path:'test-results/evidence/mail-admin-mobile.png',fullPage:false,animations:'disabled'});
});

test('Supabase access accepts exactly six OTP digits and offers Google below email',async({page})=>{
 await page.addInitScript(()=>{(window as any).__authCalls=[];});
 await page.route('**/src/authClient.ts*',route=>route.fulfill({contentType:'text/javascript',body:`
 export const authConfigurationError='';export const googleAuthEnabled=true;
 export const authRedirect=()=>location.origin+'/#/club/dashboard';
 export async function authorizationHeaders(){return {};}
 export async function fetchPrivateImage(){throw new Error('Geen media in deze authproef');}
 export const authClient={auth:{
  onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},
  async signInWithOtp(input){window.__authCalls.push({type:'email',input});return {error:null};},
  async verifyOtp(input){window.__authCalls.push({type:'verify',input});return {error:null};},
  async signInWithOAuth(input){window.__authCalls.push({type:'google',input});return {error:null};},
  async signOut(){return {error:null};}
 }};` }));
 await mockSession(page,()=>({actor:null,identity:null,memberships:[],legal:{documents,acceptances:[]}}));
 await page.goto('/#/club/dashboard');
 await expect(page.getByText('AFGESCHERMDE STAGING',{exact:true})).toBeVisible();
 const google=page.getByRole('button',{name:'Doorgaan met Google',exact:true});await expect(google).toBeVisible();await expect(google.locator('svg')).toBeVisible();
 await page.getByLabel('E-mailadres',{exact:true}).fill('otp-qa@example.invalid');await page.getByRole('button',{name:'Aanmelden via e-mail',exact:true}).click();
 const code=page.getByLabel('Aanmeldcode',{exact:true});await expect(code).toHaveAttribute('maxlength','6');await expect(code).toHaveAttribute('pattern','[0-9]{6}');
 await code.fill('12345');await expect(page.getByRole('button',{name:'Code bevestigen',exact:true})).toBeDisabled();await code.fill('123456');await expect(page.getByRole('button',{name:'Code bevestigen',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Code bevestigen',exact:true}).click();
 const calls=await page.evaluate(()=>(window as any).__authCalls);expect(calls[0]).toMatchObject({type:'email',input:{email:'otp-qa@example.invalid',options:{shouldCreateUser:true}}});expect(calls[1]).toEqual({type:'verify',input:{email:'otp-qa@example.invalid',token:'123456',type:'email'}});
 await google.click();expect((await page.evaluate(()=>(window as any).__authCalls)).at(-1)).toMatchObject({type:'google',input:{provider:'google',options:{redirectTo:'http://127.0.0.1:4173/#/club/dashboard'}}});
});

test('inactivity deletion has no self-service recovery extension',async({page})=>{
 await mockSession(page,()=>({actor:null,identity:{id:actor.id,email:'owner@example.invalid',status:'deletion_pending',recoverable:false,deletionReason:'inactivity',deadline:'2099-12-22T10:00:00Z'},memberships:[],legal:legalReady}));
 await page.goto('/#/club/dashboard');await expect(page.getByRole('heading',{name:'Je account is geblokkeerd.',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Mijn persoonlijke account herstellen',exact:true})).toHaveCount(0);await expect(page.locator('.workspace-selector')).toHaveCount(0);
});

test('account deletion requires confirmation and closes ordinary access without deleting the club',async({page})=>{
 let blocked=false;const submissions:any[]=[];
 await mockSession(page,()=>({actor,identity:{id:actor.id,email:'owner@example.invalid',status:blocked?'deletion_pending':'active',recoverable:blocked,deletionReason:blocked?'self':null,deadline:blocked?'2099-12-22T10:00:00Z':null},memberships:[{...actor,clubName:'Eigen vereniging'}],legal:legalReady}));
 await page.route('**/api/workspace',route=>route.fulfill({json:workspace()}));await page.route('**/api/privacy/account',route=>route.fulfill({json:{status:'active',deadline:'2099-12-22T10:00:00Z',lastConsciousAt:'2026-11-22T10:00:00Z',recoveryDeadline:'2099-12-22T10:00:00Z',memberships:[{club_id:actor.clubId,role:'club',other_admins:0}],requiresOwnershipTransfer:true,clubContentRetained:true}}));await page.route('**/api/privacy/successors',route=>route.fulfill({json:{accounts:[]}}));await page.route('**/api/privacy/delete',async route=>{submissions.push(route.request().postDataJSON());blocked=true;await route.fulfill({json:{blocked:true,deadline:'2099-12-22T10:00:00Z'}});});
 await page.setViewportSize({width:390,height:844});await page.goto('/#/club/account');await expect(page.getByRole('heading',{name:'Je persoonlijke account',exact:true})).toBeVisible();
 const remove=page.getByRole('button',{name:'Persoonlijk account verwijderen',exact:true});await expect(remove).toBeDisabled();await expect(page.getByText('Je bent de laatste beheerder voor Eigen vereniging.',{exact:true})).toBeVisible();await expect(page.getByText('Je persoonlijke account sluiten beëindigt geen clubovereenkomst.',{exact:false})).toBeVisible();
 expect(await page.locator('body').evaluate(body=>body.scrollWidth<=window.innerWidth+1)).toBe(true);await page.screenshot({path:'test-results/evidence/account-mobile.png',fullPage:false,animations:'disabled'});
 await page.getByRole('checkbox',{name:/Ik begrijp dat mijn gewone toegang direct stopt/}).check();await remove.click();await expect(page.getByRole('heading',{name:'Je account is geblokkeerd.',exact:true})).toBeVisible();expect(submissions).toEqual([{}]);await expect(page.locator('.workspace-selector')).toHaveCount(0);
});

test('conscious usage is recorded from real interaction rather than passive refresh',async({page})=>{
 const actions:any[]=[];
 await mockSession(page,()=>({actor,identity:{id:actor.id,email:'owner@example.invalid',status:'active'},memberships:[{...actor,clubName:'Eigen vereniging'}],legal:legalReady}));await page.route('**/api/workspace',route=>route.fulfill({json:workspace()}));await page.route('**/api/privacy/activity',async route=>{actions.push(route.request().postDataJSON());await route.fulfill({json:{accepted:true}});});
 await page.goto('/#/club/dashboard');await expect(page.locator('.workspace-selector')).toBeVisible();expect(actions).toHaveLength(0);const refreshed=page.waitForResponse(response=>response.url().endsWith('/api/workspace'));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;expect(actions).toHaveLength(0);
 await page.getByRole('button',{name:'Meldingen',exact:true}).click();await expect.poll(()=>actions.length).toBe(1);expect(actions[0]).toMatchObject({kind:'user_action'});expect(typeof actions[0].eventId).toBe('string');expect(actions[0].occurredAt).toBeUndefined();await page.getByRole('button',{name:'Meldingen sluiten',exact:true}).click();expect(actions).toHaveLength(1);
});
