/** Castiq V1 browser demo domain. All receipts are simulated; real adapters belong on the server. */
export type PhotoConsent='approved'|'unknown'|'denied';
export type PhotoUsage='photo'|'no_photo';
export type NamePolicy='full'|'first'|'initials'|'anonymous';
export type DemoOutcome='confirmed'|'failed'|'timeout';
export type Persistence={status:'saved'|'saving'|'error';savedAt:string|null;error?:string};
export type V1State={drafts:Record<string,any>;sponsorAgreements:any[];weekPlans:any[];weekendReports:any[];audit:any[];storageStatus?:string};
const namePolicies:NamePolicy[]=['full','first','initials','anonymous'];
const terminalJobs=new Set(['published','cancelled']);
const now=()=>new Date().toISOString();
const id=(prefix:string)=>`${prefix}-${globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
function addHistory(item:any,action:string,actor='Clubredactie',detail=''){return [{id:id('history'),action,actor,detail,version:item.version,at:now()},...(item.history||[])].slice(0,200);}
function keyFor(item:any,channel:string){return `${item.id}:v${item.version}:${channel}`;}
export function displayContentPlayer(item:any){const full=String(item.rawPlayerName||item.playerName||'').trim();if(!full)return '';if(item.namePolicy==='anonymous')return 'Speler';if(item.namePolicy==='first')return full.split(/\s+/)[0];if(item.namePolicy==='initials'){const bits=full.split(/\s+/);return bits[0]+(bits.length>1?` ${bits.at(-1)![0]}.`:'');}return full;}
/** Shared by captions, report entries and renderer payloads; youth restrictions cannot be bypassed by hand-made content. */
export function hidesPublicScore(item:any){return item.noScore===true||item.publishScores===false||/^O(?:[6-9]|10)(?:\D|$)/i.test(String(item.team||'').trim());}
function privateNamePolicy(...policies:any[]):NamePolicy {const ranked:NamePolicy[]=['full','initials','first','anonymous'];return policies.filter(policy=>namePolicies.includes(policy)).reduce((strictest,policy)=>ranked.indexOf(policy)>ranked.indexOf(strictest)?policy:strictest,'full');}
function replaceLiteral(text:string,find:string,replacement:string){return find?text.replace(new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),()=>replacement):text;}
function publicText(text:any,item:any){let result=String(text||'');const raw=String(item.rawPlayerName||item.playerName||'').trim();if(raw&&item.namePolicy!=='full')result=replaceLiteral(result,raw,displayContentPlayer(item));if(hidesPublicScore(item)&&item.type!=='Matchday')result=result.replace(/\b\d{1,2}\s*[–—:\-]\s*\d{1,2}\b/g,'samen gespeeld');return result;}
export function contentPrivacyErrors(item:any):string[]{
 const errors:string[]=[];
 if(item.photoUsage!=='no_photo'&&item.image&&item.photoConsent!=='approved')errors.push(item.photoConsent==='denied'?'Deze foto is niet vrijgegeven. Kies zonder foto of een goedgekeurde foto.':'Bevestig eerst dat deze foto gebruikt mag worden, of kies zonder foto.');
 if(!namePolicies.includes(item.namePolicy))errors.push('Kies een geldige naamvoorkeur.');
 if(item.staleDerived)errors.push('De bronnen van dit overzicht zijn gewijzigd. Kies Weekendoverzicht en stel het opnieuw samen voordat je het goedkeurt.');
 if((item.reportEntries||[]).some((entry:any)=>entry.photoUsage!=='no_photo'&&entry.image&&entry.photoConsent!=='approved'))errors.push('Een foto in het overzicht is niet vrijgegeven. Maak het overzicht opnieuw met goedgekeurde beelden.');
 if((item.reportEntries||[]).some((entry:any)=>entry.namePolicy!==undefined&&!namePolicies.includes(entry.namePolicy)))errors.push('Een bron in het overzicht heeft geen geldige naamvoorkeur.');
 if(['Einduitslag','Ruststand','Toernooiresultaat'].includes(item.type)&&!hidesPublicScore(item)){
  if(item.scoreConfirmed===false)errors.push('Bevestig eerst de uitslag voordat je deze versie goedkeurt of publiceert.');
  if(![item.homeScore,item.awayScore].every(score=>Number.isInteger(score)&&score>=0&&score<=99))errors.push('Gebruik voor de uitslag hele scores tussen 0 en 99; ontbrekende scores worden niet als 0 ingevuld.');
 }
 return errors;
}
function assertPrivacy(item:any){const errors=contentPrivacyErrors(item);if(errors.length)throw new Error(errors.join(' '));}
function invalidatePublicationJob(job:any,message:string){if(terminalJobs.has(job.status))return job;if(job.providerMode==='provider'&&job.adapter==='official-provider'&&(['processing','awaiting_confirmation'].includes(job.status)||job.dispatchStartedAt))return {...job,status:'awaiting_confirmation',error:'Eerdere verzending is mogelijk uitgevoerd. Controleer dezelfde opdracht; de gewijzigde versie wordt niet opnieuw verstuurd.'};return {...job,status:'cancelled',cancelledAt:now(),error:message};}
function aggregateStatus(item:any){const jobs=(item.jobs||[]).filter((job:any)=>job.version===item.version&&job.status!=='cancelled');if(!jobs.length)return item.approvedVersion===item.version?'approved':item.status==='review'?'review':'draft';if(jobs.some((job:any)=>['queued','scheduled','awaiting_confirmation','processing'].includes(job.status)))return jobs.every((job:any)=>job.status==='scheduled')?'scheduled':'queued';if(jobs.some((job:any)=>job.status==='failed'))return 'failed';if(jobs.every((job:any)=>job.status==='published'&&(job.receipt?.kind==='demo'&&job.providerMode!=='provider'||job.receipt?.kind==='provider'&&job.providerMode==='provider'&&job.adapter==='official-provider')))return 'published';return 'approved';}
export function normalizeContent(value:any):any {
 const item={...value,id:value?.id||id('content'),version:Math.max(1,Number(value?.version)||1),jobs:[] as any[],history:Array.isArray(value?.history)?value.history:[],photoUsage:value?.photoUsage==='no_photo'?'no_photo':'photo',photoConsent:['approved','unknown','denied'].includes(value?.photoConsent)?value.photoConsent:(String(value?.image||'').startsWith('/assets/')?'approved':'unknown'),namePolicy:value?.namePolicy||'initials',providerMode:value?.providerMode==='provider'?'provider':'demo'};
 item.jobs=(Array.isArray(value?.jobs)?value.jobs:[]).map((j:any,index:number)=>{
  const version=Math.max(1,Number(j.version)||item.version),dedupeKey=j.dedupeKey||`${item.id}:v${version}:${j.channel}`,at=j.createdAt||value?.date||now();
  const job={...j,id:j.id||`legacy-${item.id}-${index}`,version,attempt:Math.max(1,Number(j.attempt)||1),requestId:j.requestId||dedupeKey,dedupeKey,providerMode:j.providerMode==='provider'&&j.adapter==='official-provider'?'provider':'demo',createdAt:at,mode:j.mode||'success',scheduledAt:j.scheduledAt||(j.status==='scheduled'?value?.date:undefined)};
  if(job.status==='published'&&job.providerMode!=='provider')job.receipt={...(j.receipt||{}),kind:'demo',provider:'castiq-demo',providerPostId:j.receipt?.providerPostId||`demo-legacy-${item.id}-${index}`,confirmedAt:j.receipt?.confirmedAt||at,notice:'Gesimuleerde kanaalbevestiging; niet extern gepubliceerd.'};
  if(job.status==='failed'&&!job.error)job.error='Voorbeeldpublicatie mislukt. Controleer het kanaal en probeer opnieuw.';
  return job;
 });
 if(item.approvedVersion!==undefined&&item.approvedVersion!==item.version){item.approvedVersion=undefined;item.status='review';item.jobs=item.jobs.map((j:any)=>invalidatePublicationJob(j,'Goedkeuring hoort bij een vorige versie.'));}
 if(item.approvedVersion===item.version&&['published','scheduled','queued','failed','approved'].includes(item.status))item.status=aggregateStatus(item);
 return item;
}
export function reviseContent(value:any,patch:any,actor='Clubredactie'):any {
 const item=normalizeContent(value),safe={...patch};for(const key of ['id','version','approvedVersion','approvedBy','approvedAt','jobs','history','providerMode'])delete safe[key];
 const changed=Object.keys(safe).some(key=>JSON.stringify(item[key])!==JSON.stringify(safe[key]));if(!changed)return item;
 const reviewed=item.approvedVersion===item.version||item.status==='review'||item.jobs.length>0;
 const next={...item,...safe,version:item.version+1,approvedVersion:undefined,approvedBy:undefined,approvedAt:undefined,status:reviewed?'review':'draft',updatedAt:now(),jobs:item.jobs.map((job:any)=>invalidatePublicationJob(job,'Inhoud gewijzigd; deze versie moet opnieuw worden beoordeeld.'))};
 next.history=addHistory(next,'revision',actor,`Versie ${item.version} → ${next.version}. Vorige goedkeuring vervallen.`);return next;
}
export function submitContent(value:any,actor='Teammanager'):any{const item=normalizeContent(value);if(!String(item.title||'').trim()&&!String(item.caption||'').trim())throw new Error('Vul eerst een titel of toelichting in.');if(item.approvedVersion===item.version)return item;const next={...item,status:'review',submittedAt:now(),updatedAt:now()};next.history=addHistory(next,'submitted',actor,'Ingediend bij de clubredactie.');return next;}
export function approveContent(value:any,actor='Clubredactie'):any {const item=normalizeContent(value);if(item.status!=='review'&&item.approvedVersion!==item.version)throw new Error('Dien deze versie eerst in ter beoordeling.');assertPrivacy(item);if(item.approvedVersion===item.version)return item;const next={...item,approvedVersion:item.version,approvedBy:actor,approvedAt:now(),status:'approved'};next.history=addHistory(next,'approved',actor,`Exacte versie ${item.version} goedgekeurd.`);return next;}
export function publicContentPayload(item:any){
 let caption=publicText(item.caption,item),title=publicText(item.title,item);
 const reportEntries=(item.reportEntries||[]).map((entry:any)=>{
  const context={...entry,namePolicy:privateNamePolicy(item.namePolicy,entry.namePolicy||'initials')},noScore=hidesPublicScore(context),safeCaption=publicText(entry.caption,context);
  // Apply the source's stricter name preference to reused prose as well as the entry itself.
  if(noScore){caption=replaceLiteral(caption,String(entry.caption||''),safeCaption);if(entry.home&&entry.away&&entry.score)caption=replaceLiteral(caption,`${entry.home} – ${entry.away}: ${entry.score}`,`${entry.home} – ${entry.away}`);}
  const nameContext={...context,noScore:false,publishScores:true,team:''};caption=publicText(caption,nameContext);title=publicText(title,nameContext);
  return {id:entry.id,team:entry.team,contentId:entry.contentId,sourceVersion:entry.sourceVersion,matchId:entry.matchId,title:publicText(entry.title,context),caption:safeCaption,home:entry.home,away:entry.away,score:noScore?undefined:entry.score,homeScore:noScore?undefined:entry.homeScore,awayScore:noScore?undefined:entry.awayScore,image:entry.photoUsage!=='no_photo'&&entry.photoConsent==='approved'?entry.image:'',photoConsent:entry.photoConsent,photoUsage:entry.photoUsage,noScore,namePolicy:context.namePolicy,playerName:displayContentPlayer(context)};
 });
 const noScore=hidesPublicScore(item);
 return {id:item.id,version:item.version,title,caption,team:item.team,type:item.type,image:item.photoUsage!=='no_photo'&&item.photoConsent==='approved'?item.image:'',photoUsage:item.photoUsage,photoConsent:item.photoConsent,namePolicy:item.namePolicy,playerName:displayContentPlayer(item),reportEntries,noScore,score:noScore?undefined:item.score,homeScore:noScore?undefined:item.homeScore,awayScore:noScore?undefined:item.awayScore,opponent:item.opponent,sponsorId:item.sponsorId,sponsorAgreementId:item.sponsorAgreementId||item.snapshot?.sponsorAgreementId,sponsorName:item.sponsorName,sponsorLogo:item.sponsorLogo,...(item.templateSnapshot?{templateId:item.templateId,templateSnapshot:structuredClone(item.templateSnapshot)}:{}),...(item.planSnapshot?{planSnapshot:structuredClone(item.planSnapshot)}:{}),...(typeof item.partnerLogo==='boolean'?{partnerLogo:item.partnerLogo}:{})};
}
export function queuePublication(value:any,channel:string,options:{scheduledAt?:string;mode?:'success'|'failure'|'timeout';now?:string}={}):any {
 const item=normalizeContent(value);if(item.approvedVersion!==item.version)throw new Error('Deze versie heeft nog geen geldige goedkeuring.');assertPrivacy(item);if(!channel?.trim())throw new Error('Kies een kanaal.');
 const dedupeKey=keyFor(item,channel),existing=item.jobs.find((job:any)=>job.dedupeKey===dedupeKey&&job.status!=='cancelled');if(existing)return item;
 const at=options.now||now();if(options.scheduledAt&&!Number.isFinite(Date.parse(options.scheduledAt)))throw new Error('Kies een geldig publicatiemoment.');
 const scheduled=!!options.scheduledAt&&Date.parse(options.scheduledAt)>Date.parse(at);
 const payload=structuredClone(publicContentPayload(item));
 const job={id:id('job'),channel,status:scheduled?'scheduled':'queued',version:item.version,attempt:1,requestId:dedupeKey,dedupeKey,providerMode:'demo',mode:options.mode||'success',createdAt:at,scheduledAt:options.scheduledAt,payload,sponsorAgreementId:payload.sponsorAgreementId,sponsorName:payload.sponsorName,sponsorLogo:payload.sponsorLogo,title:payload.title,team:item.team,type:item.type,receipts:[]};
 const next={...item,jobs:[...item.jobs,job]};next.status=aggregateStatus(next);next.history=addHistory(next,scheduled?'scheduled':'queued','Clubredactie',`${channel} · v${item.version} · wacht op gesimuleerde kanaalbevestiging.`);return next;
}
export function processPublication(value:any,jobId:string,outcome:DemoOutcome,options:{now?:string;providerPostId?:string;url?:string}={}):any{
 const item=normalizeContent(value),job=item.jobs.find((j:any)=>j.id===jobId);if(!job)throw new Error('Publicatiejob niet gevonden.');if(job.status==='published'||job.status==='cancelled')return item;
 if(job.providerMode==='provider')throw new Error('Echte provideropdrachten kunnen niet via de sandbox worden bevestigd.');
 if(job.version!==item.version||item.approvedVersion!==item.version){const next={...item,jobs:item.jobs.map((j:any)=>j.id===jobId?{...j,status:'cancelled',error:'Verouderde versie: opnieuw beoordelen voordat je publiceert.'}:j)};next.status=aggregateStatus(next);return next;}
 assertPrivacy(item);const at=options.now||now();if(job.scheduledAt&&Date.parse(job.scheduledAt)>Date.parse(at))throw new Error('Dit publicatiemoment ligt nog in de toekomst.');
 let nextJob:any={...job,updatedAt:at};
 if(outcome==='confirmed'){
  const receipt={kind:'demo',provider:'castiq-demo',providerPostId:options.providerPostId||`demo-${job.id}`,url:options.url||'',confirmedAt:at,requestId:job.requestId,version:job.version,sponsorAgreementId:job.sponsorAgreementId,sponsorName:job.sponsorName,sponsorLogo:job.sponsorLogo,notice:'Gesimuleerde kanaalbevestiging; niet extern gepubliceerd.'};
  nextJob={...nextJob,status:'published',error:undefined,receipt,receipts:[...(job.receipts||[]),receipt]};
 }else if(outcome==='timeout')nextJob={...nextJob,status:'awaiting_confirmation',error:'Nog geen kanaalbevestiging ontvangen. Controleer dezelfde aanvraag voordat je opnieuw verzendt.'};
 else nextJob={...nextJob,status:'failed',error:'De demo van het kanaal heeft de publicatie geweigerd. Controleer de koppeling en probeer opnieuw.'};
 const next={...item,jobs:item.jobs.map((j:any)=>j.id===jobId?nextJob:j)};next.status=aggregateStatus(next);next.history=addHistory(next,`publication_${outcome}`,'Demo-kanaal',`${job.channel} · aanvraag ${job.requestId}`);return next;
}
export function retryPublication(value:any,jobId:string):any {
 const item=normalizeContent(value),job=item.jobs.find((j:any)=>j.id===jobId);if(!job)throw new Error('Publicatiejob niet gevonden.');if(job.status==='published'||['queued','scheduled'].includes(job.status))return item;
 if(job.version!==item.version||item.approvedVersion!==item.version||job.status==='cancelled')throw new Error('Een vorige versie kan niet opnieuw worden gepubliceerd. Beoordeel de huidige versie.');assertPrivacy(item);
 if(!['failed','awaiting_confirmation'].includes(job.status))throw new Error('Deze aanvraag kan nu niet opnieuw worden geprobeerd.');
 const next={...item,jobs:item.jobs.map((j:any)=>j.id===jobId?{...j,status:'queued',attempt:j.attempt+1,error:undefined,updatedAt:now(),reconciling:job.status==='awaiting_confirmation'}:j)};next.status=aggregateStatus(next);next.history=addHistory(next,'publication_retry','Clubredactie',`${job.channel} · dezelfde aanvraag behouden om dubbel plaatsen te voorkomen.`);return next;
}
/** Reject stale derived snapshots after any contributing post or match changes. */
export function reconcileDerivedContent(state:any):any {
 const matches=new Map((state.matches||[]).map((match:any)=>[match.id,match]));let content=state.content||[],changed=false;
 // A report can itself be a source. Reach a fixed point so array order cannot leave a downstream job approved.
 for(let pass=0;pass<content.length;pass++){
  const byId=new Map(content.map((item:any)=>[item.id,item]));let passChanged=false;
  content=content.map((item:any)=>{
   if(item.staleDerived)return item;
   const refs=[...(Array.isArray(item.reportSourceVersions)?item.reportSourceVersions:[]),...(item.reportEntries||[]).filter((entry:any)=>entry.contentId).map((entry:any)=>({contentId:entry.contentId,version:entry.sourceVersion}))];
   const staleSource=refs.some((ref:any)=>{const source:any=byId.get(ref.contentId);return !source||source.version!==ref.version||source.approvedVersion!==source.version||contentPrivacyErrors(source).length>0;});
   const staleMatch=(item.reportEntries||[]).some((entry:any)=>{
    const matchId=entry.matchId||entry.id;if(!matchId)return false;const match:any=matches.get(matchId);if(!match)return true;
    const hasScore=entry.homeScore!==undefined||entry.awayScore!==undefined;
    return (entry.matchVersion!==undefined&&entry.matchVersion!==(match.sourceVersion??match.version))||(entry.home!==undefined&&match.home!==undefined&&entry.home!==match.home)||(entry.away!==undefined&&match.away!==undefined&&entry.away!==match.away)||(hasScore&&match.status!==undefined&&match.status!=='finished')||(!hidesPublicScore(entry)&&hasScore&&(entry.homeScore!==match.homeScore||entry.awayScore!==match.awayScore));
   });
   if(!staleSource&&!staleMatch)return item;passChanged=true;changed=true;
   return reviseContent(item,{staleDerived:true,derivedWarning:'Een bronbijdrage of uitslag is gewijzigd. Kies Weekendoverzicht en stel het opnieuw samen; de vorige versie wordt niet meer gepubliceerd.'},'Broncontrole');
  });
  if(!passChanged)break;
 }
 if(!changed)return state;
 const staleIds=new Set(content.filter((item:any)=>item.staleDerived).map((item:any)=>item.id));
 return {...state,content,...(state.v1?{v1:{...state.v1,weekendReports:(state.v1.weekendReports||[]).map((report:any)=>staleIds.has(report.contentId)?{...report,stale:true,staleReason:'Een gebruikte bron is gewijzigd of niet meer vrijgegeven.'}:report)}}:{})};
}
export function correctMatchScore(state:any,matchId:string,home:number,away:number,reason:string):any {
 if(!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0||home>99||away>99)throw new Error('Gebruik hele scores tussen 0 en 99.');if(!reason?.trim())throw new Error('Geef een reden voor deze scorecorrectie.');const match=state.matches.find((m:any)=>m.id===matchId);if(!match)throw new Error('Wedstrijd niet gevonden.');if(home===match.homeScore&&away===match.awayScore)return state;
 const detail=`${match.homeScore}–${match.awayScore} → ${home}–${away}: ${reason.trim()}`;
 const oldScore=new RegExp(`${match.homeScore}\\s*[–—:\\-]\\s*${match.awayScore}`,'g');const replaceScore=(text:any)=>String(text||'').replace(oldScore,`${home}–${away}`);
 const direct=(state.content||[]).map((item:any)=>item.matchId!==matchId?item:reviseContent(item,{homeScore:home,awayScore:away,score:item.score&&replaceScore(item.score),scoreConfirmed:true,caption:replaceScore(item.caption),scoreCorrectionReason:reason.trim()},'Scorecorrectie'));
 const byId=new Map(direct.map((item:any)=>[item.id,item]));const affectedReports=new Set<string>();
 const updateEntries=(entries:any[])=>entries.map((entry:any)=>{
  if((entry.matchId||entry.id)!==matchId)return entry;const source:any=entry.contentId?byId.get(entry.contentId):null;
  const showScore=!hidesPublicScore(entry)&&(entry.score!==undefined||entry.homeScore!==undefined||entry.awayScore!==undefined);
  return {...entry,homeScore:showScore?home:undefined,awayScore:showScore?away:undefined,score:showScore?`${home} – ${away}`:undefined,caption:source?publicContentPayload(source).caption:replaceScore(entry.caption),sourceVersion:source?.version??entry.sourceVersion};
 });
 const content=direct.map((item:any)=>{
  const aggregate=(item.reportEntries||[]).some((entry:any)=>(entry.matchId||entry.id)===matchId);let revised=item;
  if(aggregate){
   affectedReports.add(item.id);const entries=updateEntries(item.reportEntries);let caption=item.caption;
   // Rebuild the per-team sections so another match with the same old score remains unchanged.
   if(typeof item.summaryIntro==='string')caption=[String(item.caption||'').split('\n\n')[0],item.summaryIntro,...entries.map((entry:any)=>[entry.team,entry.home&&entry.away?`${entry.home} – ${entry.away}${entry.score?`: ${entry.score}`:''}`:'',entry.caption].filter(Boolean).join('\n')),state.club?.hashtags||''].filter(Boolean).join('\n\n');
   revised=reviseContent(item,{reportEntries:entries,reportSourceVersions:entries.filter((entry:any)=>entry.contentId).map((entry:any)=>({contentId:entry.contentId,version:entry.sourceVersion})),caption,scoreCorrectionReason:reason.trim(),staleDerived:true,derivedWarning:'Een bronuitslag is gewijzigd. Stel het weekendoverzicht opnieuw samen voordat je het goedkeurt.'},'Scorecorrectie in weekendoverzicht');
  }
  if(item.matchId!==matchId&&!aggregate)return revised;
  return {...revised,correctionNotice:(item.jobs||[]).some((job:any)=>job.status==='published')?'Een vorige versie is al gedeeld. Publiceer een correctiebericht; eerdere berichten worden niet stilzwijgend gewijzigd.':undefined};
 });
 const next={...state,matches:state.matches.map((m:any)=>m.id===matchId?{...m,homeScore:home,awayScore:away,correctedAt:now(),correctionReason:reason.trim()}:m),content,v1:{...state.v1,weekendReports:(state.v1?.weekendReports||[]).map((report:any)=>(report.entries||[]).some((entry:any)=>(entry.matchId||entry.id)===matchId)||affectedReports.has(report.contentId)?{...report,entries:updateEntries(report.entries||[]),stale:true,staleReason:'Bronuitslag gecorrigeerd; controleer de nieuwe contentversie.'}:report),audit:[{id:id('audit'),action:'score_corrected',matchId,detail,at:now()},...(state.v1?.audit||[])]}};
 return reconcileDerivedContent(next);
}

export function createDemoV1():V1State {const year=new Date().getFullYear();return {drafts:{},sponsorAgreements:[{id:'sa1',clubId:'cl1',name:'Duin & Zee Makelaars',sponsorName:'Duin & Zee Makelaars',teams:['Eerste elftal','O14-1'],types:['Matchday','Einduitslag','Weekenduitslagen'],start:`${year}-01-01`,end:`${year}-12-31`,target:8,frequency:'month',logo:'',priority:1,active:true,description:'Wedstrijdpartner · jeugd en eerste elftal',logoText:'DUIN & ZEE'}],weekPlans:[],weekendReports:[],audit:[]};}
export function normalizeV1(value:any):V1State {const seed=createDemoV1();return {...seed,...value,drafts:value?.drafts&&typeof value.drafts==='object'&&!Array.isArray(value.drafts)?value.drafts:{},sponsorAgreements:Array.isArray(value?.sponsorAgreements)?value.sponsorAgreements:seed.sponsorAgreements,weekPlans:Array.isArray(value?.weekPlans)?value.weekPlans:[],weekendReports:Array.isArray(value?.weekendReports)?value.weekendReports:[],audit:Array.isArray(value?.audit)?value.audit:[]};}
