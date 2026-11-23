// This explicit allowlist is the complete GitHub public configuration contract.
// NEXT_PUBLIC_* names are mapped deliberately; this remains a Vite application.
export const publicConfigurationNames=Object.freeze(['CASTIQ_APP_ORIGIN','CASTIQ_DATA_MODE','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_URL']);
const aliases={CASTIQ_APP_ORIGIN:['APP_ORIGIN'],CASTIQ_DATA_MODE:['VITE_DATA_MODE'],NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:['SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY'],NEXT_PUBLIC_SUPABASE_URL:['SUPABASE_URL','VITE_SUPABASE_URL']};
const value=(environment,name)=>String(environment[name]??'').trim();

export function resolvePublicConfiguration(environment){
 const configuration={},errors=[];
 for(const name of publicConfigurationNames){
  const supplied=[name,...aliases[name]].filter(key=>value(environment,key));
  if(new Set(supplied.map(key=>value(environment,key))).size>1)errors.push(`${name}: tegenstrijdige configuratie via ${supplied.join(', ')}`);
  configuration[name]=supplied.length?value(environment,supplied[0]):'';
 }
 configuration.CASTIQ_DATA_MODE||='server';
 return {configuration,errors};
}

function exactOrigin(input,https){
 try{const parsed=new URL(input);return parsed.origin===input&&!parsed.username&&!parsed.password&&(!https||parsed.protocol==='https:')&&['http:','https:'].includes(parsed.protocol);}catch{return false;}
}

export function validateBuildConfiguration(environment,{target=environment.APP_ENV||'local'}={}){
 const {configuration,errors}=resolvePublicConfiguration(environment);
 const deployed=['staging','production'].includes(target);
 if(!['local','staging','production'].includes(target))errors.push('target: gebruik local, staging of production');
 if(deployed)for(const name of publicConfigurationNames)if(!value(environment,name))errors.push(`${name}: ontbreekt in het publieke buildcontract`);
 if(!['server','supabase','demo'].includes(configuration.CASTIQ_DATA_MODE))errors.push('CASTIQ_DATA_MODE: gebruik supabase, server (alleen lokaal) of demo');
 if(deployed&&configuration.CASTIQ_DATA_MODE!=='supabase')errors.push('CASTIQ_DATA_MODE: staging en productie vereisen supabase');
 if((configuration.CASTIQ_APP_ORIGIN||deployed)&&!exactOrigin(configuration.CASTIQ_APP_ORIGIN,deployed))errors.push('CASTIQ_APP_ORIGIN: exacte HTTP(S)-origin vereist; HTTPS buiten lokaal');
 const url=configuration.NEXT_PUBLIC_SUPABASE_URL,key=configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if((url||key||deployed)&&(!url||!key))errors.push('NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: samen vereist');
 if(url&&!exactOrigin(url,true))errors.push('NEXT_PUBLIC_SUPABASE_URL: exacte HTTPS-origin vereist');
 if(key&&!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: uitsluitend een publishable key toegestaan');
 for(const name of Object.keys(environment))if(/^(VITE_|NEXT_PUBLIC_).*(DATABASE_URL|SERVICE_ROLE|SECRET|ACCESS_TOKEN|REFRESH_TOKEN)/i.test(name))errors.push(`${name}: serversecret onder publieke prefix`);
 return {configuration,errors};
}

export function validateRuntimeConfiguration(environment){
 const {configuration,errors}=validateBuildConfiguration(environment);
 const required=['APP_ENV','AUTH_MODE','HOST','PORT','DATABASE_URL','UPLOAD_DIR','PUBLICATION_MODE'];
 for(const name of required)if(!value(environment,name))errors.push(`${name}: ontbreekt`);
 if(!['local','staging','production'].includes(environment.APP_ENV))errors.push('APP_ENV: ongeldig');
 if(!['local','supabase'].includes(environment.AUTH_MODE))errors.push('AUTH_MODE: ongeldig');
 if(!['sandbox','provider'].includes(environment.PUBLICATION_MODE))errors.push('PUBLICATION_MODE: gebruik sandbox of provider');
 if(environment.PUBLICATION_MODE==='provider'){for(const name of ['CHANNEL_TOKEN_ENCRYPTION_KEY','PUBLICATION_MEDIA_SIGNING_KEY'])if(!/^[a-f0-9]{64}$/i.test(value(environment,name)))errors.push(name+': afzonderlijke 32-byte hexsleutel vereist voor providerpublicatie');if(value(environment,'CHANNEL_TOKEN_ENCRYPTION_KEY')===value(environment,'PUBLICATION_MEDIA_SIGNING_KEY'))errors.push('PUBLICATION_MEDIA_SIGNING_KEY: gebruik een afzonderlijke sleutel');}
 if(!/^\d+$/.test(environment.PORT||'')||Number(environment.PORT)<1024||Number(environment.PORT)>65535)errors.push('PORT: ongeldig');
 if(environment.AUTH_MODE==='local'&&(environment.APP_ENV!=='local'||!['127.0.0.1','localhost','::1'].includes(environment.HOST)))errors.push('AUTH_MODE: lokale testaccounts vereisen lokale loopbackbinding');
 if(environment.APP_ENV!=='local'&&(environment.AUTH_MODE!=='supabase'||!['127.0.0.1','::1'].includes(environment.HOST)))errors.push('AUTH_MODE/HOST: staging en productie vereisen Supabase en loopbackbinding');
 if(environment.APP_ENV!=='local'&&!/^[a-f0-9]{40}$/.test(environment.RELEASE_SHA||''))errors.push('RELEASE_SHA: volledige commit-SHA vereist buiten lokaal');
 if(!configuration.CASTIQ_APP_ORIGIN)errors.push('CASTIQ_APP_ORIGIN: ontbreekt (lokaal is APP_ORIGIN nog toegestaan)');
 if(environment.AUTH_MODE==='supabase'&&(!configuration.NEXT_PUBLIC_SUPABASE_URL||!configuration.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY))errors.push('NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: vereist voor Supabase-authenticatie');
 try{if(!['postgres:','postgresql:'].includes(new URL(environment.DATABASE_URL).protocol))errors.push('DATABASE_URL: ongeldige database-URL');}catch{errors.push('DATABASE_URL: ongeldige URL');}
 return {configuration,errors};
}
