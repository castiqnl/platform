import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeContent,reviseContent,submitContent,approveContent,queuePublication,processPublication,retryPublication,correctMatchScore,publicContentPayload,normalizeV1,reconcileDerivedContent} from '../src/v1Workflow.ts';
const content=(patch:any={})=>normalizeContent({id:'test-content',title:'Wedstrijd',caption:'Robin Bakker scoort. 3–2.',type:'Einduitslag',matchId:'m1',team:'O14-1',image:'/assets/team-photo.webp',photoConsent:'approved',photoUsage:'photo',namePolicy:'initials',rawPlayerName:'Robin Bakker',status:'draft',version:1,homeScore:3,awayScore:2,jobs:[],...patch});
const approved=(patch:any={})=>approveContent(submitContent(content(patch)));

test('only the exact reviewed revision may be queued and published',()=>{
 const draft=content();assert.throws(()=>queuePublication(draft,'Instagram-feed'),/goedkeuring/);
 assert.throws(()=>approveContent(draft),/indienen|Dien/);
 const reviewed=approved();assert.equal(reviewed.approvedVersion,1);assert.equal(reviewed.status,'approved');
 const queued=queuePublication(reviewed,'Instagram-feed');assert.equal(queued.status,'queued');assert.equal(queued.jobs[0].status,'queued');assert.equal(queued.jobs[0].receipt,undefined);
 const edited=reviseContent(queued,{caption:'Nieuwe inhoud'},'Sam');assert.equal(edited.version,2);assert.equal(edited.status,'review');assert.equal(edited.approvedVersion,undefined);assert.equal(edited.jobs[0].status,'cancelled');
 assert.equal(processPublication(edited,queued.jobs[0].id,'confirmed').jobs[0].status,'cancelled');
 assert.throws(()=>queuePublication(edited,'Instagram-feed'),/goedkeuring/);
});

test('approval metadata cannot be injected via edit patches and no-op edits retain approval',()=>{
 const item=approved();const unchanged=reviseContent(item,{caption:item.caption,approvedVersion:999,version:999});assert.equal(unchanged.approvedVersion,1);assert.equal(unchanged.version,1);
 const changed=reviseContent(item,{caption:'Wijziging',approvedVersion:2,jobs:[]});assert.equal(changed.version,2);assert.equal(changed.approvedVersion,undefined);
});

test('photo and name preferences gate approval and sanitize frozen public payload',()=>{
 for(const photoConsent of ['unknown','denied'])assert.throws(()=>approveContent(submitContent(content({photoConsent}))),/foto/);
 const noPhoto=approved({photoConsent:'denied',photoUsage:'no_photo',namePolicy:'first'});assert.equal(publicContentPayload(noPhoto).image,'');assert.equal(publicContentPayload(noPhoto).caption,'Robin scoort. 3–2.');
 assert.throws(()=>approveContent(submitContent(content({namePolicy:'invalid'}))),/naamvoorkeur/);
 assert.throws(()=>approveContent(submitContent(content({scoreConfirmed:false}))),/uitslag/);
 const queued=queuePublication(noPhoto,'Facebook-feed');assert.equal(queued.jobs[0].payload.image,'');assert.equal(queued.jobs[0].payload.playerName,'Robin');
});

test('publication is only complete after a channel-specific, explicitly simulated receipt',()=>{
 let item=queuePublication(queuePublication(approved(),'Instagram-feed'),'Facebook-feed');const [a,b]=item.jobs;
 item=processPublication(item,a.id,'confirmed');assert.equal(item.status,'queued');assert.equal(item.jobs[0].receipt.kind,'demo');assert.equal(item.jobs[0].providerMode,'demo');assert.equal(item.jobs[1].receipt,undefined);
 item=processPublication(item,b.id,'failed');assert.equal(item.status,'failed');assert.ok(item.jobs[1].error);assert.equal(item.jobs[0].status,'published');
 item=retryPublication(item,b.id);assert.equal(item.jobs.length,2);assert.equal(item.jobs[1].attempt,2);
 item=processPublication(item,b.id,'confirmed');assert.equal(item.status,'published');assert.equal(item.jobs[1].receipt.kind,'demo');
 const repeated=processPublication(item,b.id,'confirmed');assert.equal(repeated.jobs[1].receipts.length,1);
});

test('duplicate clicks and timeout retries preserve a single idempotent request',()=>{
 const queued=queuePublication(approved(),'Instagram-feed');assert.equal(queuePublication(queued,'Instagram-feed').jobs.length,1);
 const first=queued.jobs[0],timedout=processPublication(queued,first.id,'timeout');assert.equal(timedout.jobs[0].status,'awaiting_confirmation');assert.equal(timedout.jobs[0].receipt,undefined);
 const retry=retryPublication(timedout,first.id);assert.equal(retry.jobs.length,1);assert.equal(retry.jobs[0].id,first.id);assert.equal(retry.jobs[0].requestId,first.requestId);assert.equal(retry.jobs[0].dedupeKey,first.dedupeKey);assert.equal(retry.jobs[0].reconciling,true);
 assert.equal(retryPublication(retry,first.id).jobs[0].attempt,2);
});

test('a future scheduled job cannot confirm early; stale callbacks cannot resurrect edited content',()=>{
 const item=queuePublication(approved(),'Instagram-feed',{now:'2026-11-01T10:00:00Z',scheduledAt:'2026-11-07T09:00:00Z'}),job=item.jobs[0];assert.equal(job.status,'scheduled');
 assert.throws(()=>processPublication(item,job.id,'confirmed',{now:'2026-11-06T10:00:00Z'}),/toekomst/);
 const stale={...item,version:2,approvedVersion:2,status:'approved'};assert.equal(processPublication(stale,job.id,'confirmed',{now:'2026-11-08T10:00:00Z'}).jobs[0].status,'cancelled');
});

test('score correction requires a reason, updates dependent revisions, and preserves published history',()=>{
 let published=queuePublication(approved(),'Instagram-feed');published=processPublication(published,published.jobs[0].id,'confirmed');
 const state={matches:[{id:'m1',homeScore:3,awayScore:2}],content:[published,content({id:'unrelated',matchId:'m2'})],v1:normalizeV1(null)};
 assert.throws(()=>correctMatchScore(state,'m1',4,2,''),/reden/);assert.throws(()=>correctMatchScore(state,'m1',-1,2,'Fout'),/scores/);
 const corrected=correctMatchScore(state,'m1',4,2,'Doelpunt ontbrak');assert.equal(corrected.matches[0].homeScore,4);assert.equal(corrected.content[0].homeScore,4);assert.match(corrected.content[0].caption,/4–2/);assert.equal(corrected.content[0].version,2);assert.equal(corrected.content[0].approvedVersion,undefined);assert.equal(corrected.content[0].jobs[0].status,'published');assert.ok(corrected.content[0].correctionNotice);assert.equal(corrected.content[1].version,1);assert.equal(corrected.v1.audit[0].action,'score_corrected');
 assert.equal(state.matches[0].homeScore,3);assert.equal(state.content[0].version,1);
});

test('sponsor evidence is frozen per published revision and persists after edits',()=>{
 const base=approved({sponsorAgreementId:'sa1',sponsorName:'Sponsor één',sponsorLogo:'/assets/logo.svg'});let item=queuePublication(base,'Facebook-feed');const job=item.jobs[0];assert.equal(job.sponsorAgreementId,'sa1');assert.equal(job.payload.sponsorName,'Sponsor één');
 item=processPublication(item,job.id,'confirmed');assert.equal(item.jobs[0].receipt.sponsorAgreementId,'sa1');item=reviseContent(item,{sponsorAgreementId:'sa2',sponsorName:'Sponsor twee'});assert.equal(item.jobs[0].receipt.sponsorAgreementId,'sa1');assert.equal(item.jobs[0].sponsorName,'Sponsor één');
});

test('legacy prototype publications migrate to explicit demo receipts and old approvals expire',()=>{
 const legacy=normalizeContent({id:'legacy',status:'published',version:1,approvedVersion:1,jobs:[{channel:'Instagram-feed',status:'published'}]});assert.equal(legacy.jobs[0].receipt.kind,'demo');assert.match(legacy.jobs[0].receipt.notice,/niet extern/);
 const invalid=normalizeContent({id:'invalid',status:'scheduled',version:2,approvedVersion:1,jobs:[{channel:'Instagram-feed',status:'scheduled'}]});assert.equal(invalid.approvedVersion,undefined);assert.equal(invalid.status,'review');assert.equal(invalid.jobs[0].status,'cancelled');
});


test('score correction revises scheduled weekend aggregates while retaining unrelated scores and receipts',()=>{
 const entries=[{team:'O14-1',matchId:'m1',home:'SC Getijde',away:'SV Noordhaven',homeScore:3,awayScore:2,score:'3 – 2',caption:'Een mooi resultaat: 3–2.'},{team:'O19-1',matchId:'m2',home:'FC Havenlicht',away:'VV Duinrand',homeScore:3,awayScore:2,score:'3 – 2',caption:'Ook hier 3–2.'},{team:'O10-1',matchId:'m1',noScore:true,caption:'Samen gespeeld.'}];
 let report=queuePublication(approved({id:'report',type:'Weekenduitslagen',matchId:'',reportEntries:entries,summaryIntro:'Samen terugkijken.',caption:'HET CLUBWEEKEND\n\nSamen terugkijken.\n\nO14-1\nSC Getijde – SV Noordhaven: 3 – 2\nEen mooi resultaat: 3–2.\n\nO19-1\nFC Havenlicht – VV Duinrand: 3 – 2\nOok hier 3–2.'}),'Instagram-feed',{now:'2026-11-01T10:00:00Z',scheduledAt:'2026-11-07T12:00:00Z'});
 const state={club:{hashtags:'#Samen'},matches:[{id:'m1',homeScore:3,awayScore:2},{id:'m2',homeScore:3,awayScore:2}],content:[report],v1:{...normalizeV1(null),weekendReports:[{id:'report-source',contentId:'report',entries}]}};
 const next=correctMatchScore(state,'m1',4,2,'Een doelpunt ontbrak');report=next.content[0];assert.equal(report.version,2);assert.equal(report.approvedVersion,undefined);assert.equal(report.status,'review');assert.equal(report.jobs[0].status,'cancelled');assert.equal(report.reportEntries[0].score,'4 – 2');assert.equal(report.reportEntries[1].score,'3 – 2');assert.equal(report.reportEntries[2].score,undefined);assert.match(report.caption,/SC Getijde – SV Noordhaven: 4 – 2/);assert.match(report.caption,/FC Havenlicht – VV Duinrand: 3 – 2/);assert.equal(next.v1.weekendReports[0].stale,true);assert.throws(()=>queuePublication(report,'Facebook-feed'),/goedkeuring/);assert.equal(processPublication(report,report.jobs[0].id,'confirmed',{now:'2026-11-08T10:00:00Z'}).jobs[0].status,'cancelled');
});

test('editing a source photo or name invalidates a derived approved report exactly once',()=>{
 const source=approved({id:'source'}),report=queuePublication(approved({id:'report',type:'Weekenduitslagen',matchId:'',reportEntries:[{contentId:'source',sourceVersion:1}],reportSourceVersions:[{contentId:'source',version:1}]}),'Instagram-feed');
 const state={matches:[],content:[reviseContent(source,{namePolicy:'anonymous'}),report]};const next=reconcileDerivedContent(state);const derived=next.content[1];assert.equal(derived.version,2);assert.equal(derived.staleDerived,true);assert.equal(derived.approvedVersion,undefined);assert.equal(derived.jobs[0].status,'cancelled');assert.throws(()=>approveContent(derived),/bronnen|overzicht/);assert.equal(reconcileDerivedContent(next),next);
});

test('name masking also covers uppercase literal player names and escapes regex punctuation',()=>{
 const item=content({rawPlayerName:'Robin (Bakker)',namePolicy:'anonymous',title:'ROBIN (BAKKER) SCOORT',caption:'Robin (Bakker) is er. ROBIN (BAKKER)!'});const payload=publicContentPayload(item);assert.equal(payload.title,'Speler SCOORT');assert.equal(payload.caption,'Speler is er. Speler!');
});
