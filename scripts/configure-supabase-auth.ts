import {createHash} from 'node:crypto';
import {writeFile,mkdir} from 'node:fs/promises';
import {supabaseTemplateConfiguration} from '../server/mailTemplates.ts';
const targets={staging:{ref:'zovwrexlzmhyejnfnmid',origin:'https://staging.castiq.nl'},production:{ref:'jyqajjfyksasehdlzfuf',origin:'https://castiq.nl'}};
const args=process.argv.slice(2),environment=args[args.indexOf('--environment')+1];
if(!Object.hasOwn(targets,environment)||args.some((a,i)=>!['--environment','--apply','--export-only',environment].includes(a)))throw new Error('Gebruik --environment staging|production [--export-only | --apply]');
const target=targets[environment],configuration={site_url:target.origin,uri_allow_list:target.origin+'/**',mailer_otp_length:6,mailer_autoconfirm:false,...supabaseTemplateConfiguration()};
const hash=()=>createHash('sha256').update(JSON.stringify(configuration)).digest('hex');
if(args.includes('--export-only')){
 await mkdir('emails/configuration',{recursive:true});await writeFile(`emails/configuration/${environment}.json`,JSON.stringify(configuration,null,2)+'\n');
 console.log(JSON.stringify({environment,configurationSha256:hash(),exported:true,applied:false}));
}else{
 const token=process.env.SUPABASE_ACCESS_TOKEN;if(!token)throw new Error('SUPABASE_ACCESS_TOKEN ontbreekt; geen wijzigingen uitgevoerd. Gebruik --export-only voor de handmatige configuratie.');
 async function request(method:string,body?:unknown){const response=await fetch(`https://api.supabase.com/v1/projects/${target.ref}/config/auth`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000),redirect:'error'});if(!response.ok)throw new Error(`Auth-configuratie ${method} niet bevestigd (HTTP ${response.status}); antwoordbody niet gelogd.`);return response.json();}
 const before=await request('GET');
 if(!before.external_google_enabled)throw new Error('Google-provider staat niet ingeschakeld; controleer de bestaande projectcredentials.');
 console.log(JSON.stringify({environment,project:target.ref,phase:'before',siteUrl:before.site_url,otpLength:before.mailer_otp_length,emailConfirmationRequired:!before.mailer_autoconfirm,googleEnabled:true,smtpConfigured:Boolean(before.smtp_host&&before.smtp_user),configurationSha256:hash()}));
 if(!args.includes('--apply')){console.log('Alleen controle. Gebruik --apply voor de beperkte Auth-configuratiepatch.');}
 else{
  await request('PATCH',configuration);const after=await request('GET');
  for(const [name,value]of Object.entries(configuration))if(after[name]!==value)throw new Error(`Configuratieveld ${name} is na PATCH niet gelijk; controleer het project.`);
  console.log(JSON.stringify({environment,phase:'verified',configurationSha256:hash(),otpLength:after.mailer_otp_length,siteUrl:after.site_url,templatesVerified:Object.keys(configuration).filter(k=>k.startsWith('mailer_templates_')).length,applied:true}));
 }
}
