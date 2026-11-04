const required=['APP_ENV','AUTH_MODE','HOST','PORT','APP_ORIGIN','DATABASE_URL','UPLOAD_DIR','PUBLICATION_MODE'];
if(process.env.AUTH_MODE==='supabase')required.push('SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY');
const failures=[];
for(const key of required)if(!process.env[key]?.trim())failures.push(`${key}: ontbreekt`);
if(!['local','staging','production'].includes(process.env.APP_ENV))failures.push('APP_ENV: ongeldig');
if(!['local','supabase'].includes(process.env.AUTH_MODE))failures.push('AUTH_MODE: ongeldig');
if(process.env.PUBLICATION_MODE!=='sandbox')failures.push('PUBLICATION_MODE: deze implementatie ondersteunt uitsluitend sandbox');
if(!Number.isInteger(Number(process.env.PORT))||Number(process.env.PORT)<1024||Number(process.env.PORT)>65535)failures.push('PORT: ongeldig');
if(process.env.AUTH_MODE==='local'&&(process.env.APP_ENV!=='local'||!['127.0.0.1','localhost','::1'].includes(process.env.HOST)))failures.push('AUTH_MODE: lokale testaccounts vereisen lokale loopbackbinding');
try{const origin=new URL(process.env.APP_ORIGIN);if(origin.origin!==process.env.APP_ORIGIN)failures.push('APP_ORIGIN: gebruik alleen de exacte origin zonder pad');if(process.env.APP_ENV!=='local'&&origin.protocol!=='https:')failures.push('APP_ORIGIN: HTTPS vereist buiten lokaal');}catch{failures.push('APP_ORIGIN: ongeldige URL');}
try{const database=new URL(process.env.DATABASE_URL);if(!['postgres:','postgresql:'].includes(database.protocol))failures.push('DATABASE_URL: ongeldige database-URL');}catch{failures.push('DATABASE_URL: ongeldige URL');}
if(process.env.AUTH_MODE==='supabase')try{if(new URL(process.env.SUPABASE_URL).protocol!=='https:')failures.push('SUPABASE_URL: HTTPS vereist');}catch{failures.push('SUPABASE_URL: ongeldige URL');}
if(process.env.AUTH_MODE==='supabase'&&process.env.VITE_SUPABASE_URL!==process.env.SUPABASE_URL)failures.push('VITE_SUPABASE_URL: browser en server moeten hetzelfde project gebruiken');
for(const name of ['SUPABASE_PUBLISHABLE_KEY','VITE_SUPABASE_PUBLISHABLE_KEY'])if(process.env[name]&&!process.env[name].startsWith('sb_publishable_'))failures.push(`${name}: uitsluitend een publishable key is toegestaan`);
if(process.env.VITE_AUTH_GOOGLE_ENABLED&&!['true','false'].includes(process.env.VITE_AUTH_GOOGLE_ENABLED))failures.push('VITE_AUTH_GOOGLE_ENABLED: gebruik true of false');
for(const key of Object.keys(process.env))if(/^(VITE_|NEXT_PUBLIC_).*(DATABASE_URL|SERVICE_ROLE|SECRET|ACCESS_TOKEN|REFRESH_TOKEN)/i.test(key))failures.push(`${key}: serversecret onder publieke prefix`);
if(failures.length){console.error(failures.join('\n'));process.exit(1);}
console.log(`Configuratie geldig: ${required.join(', ')} aanwezig. Waarden zijn niet getoond. Dit controleert geen externe infrastructuur.`);
