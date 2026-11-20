import {publicConfigurationNames,validateBuildConfiguration,validateRuntimeConfiguration} from './configuration.mjs';
const options=Object.fromEntries(process.argv.slice(2).map(argument=>{const match=/^--(scope|target)=(.+)$/.exec(argument);if(!match)throw new Error('Gebruik --scope=build|runtime en optioneel --target=local|staging|production');return [match[1],match[2]];}));
const scope=options.scope||'runtime';
if(!['build','runtime'].includes(scope))throw new Error('scope: gebruik build of runtime');
if(scope==='runtime'&&options.target&&options.target!==process.env.APP_ENV)throw new Error('Runtime target moet overeenkomen met APP_ENV');
const result=scope==='build'?validateBuildConfiguration(process.env,{target:options.target||process.env.APP_ENV||'local'}):validateRuntimeConfiguration(process.env);
if(result.errors.length){console.error(result.errors.join('\n'));process.exit(1);}
console.log(`Configuratie geldig (${scope}${scope==='build'?`, ${options.target||process.env.APP_ENV||'local'}`:''}). Publiek contract: ${publicConfigurationNames.join(', ')}. Waarden zijn niet getoond; externe infrastructuur is niet gecontroleerd.`);
