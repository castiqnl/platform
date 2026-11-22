import {mkdir,writeFile} from 'node:fs/promises';
import {defaultMailTemplates,renderMail,supabaseTemplateConfiguration} from '../server/mailTemplates.ts';
await mkdir(new URL('../emails/supabase/',import.meta.url),{recursive:true});
for(const template of defaultMailTemplates.filter(t=>t.auth))await writeFile(new URL(`../emails/supabase/${template.key}.html`,import.meta.url),renderMail(template,{origin:'https://castiq.nl',supabase:true}).html+'\n');
await writeFile(new URL('../emails/supabase/auth-template-config.json',import.meta.url),JSON.stringify(supabaseTemplateConfiguration(),null,2)+'\n');
console.log('13 Supabase HTML-templates en Management API-configuratie geëxporteerd.');
