import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {publicConfigurationNames,resolvePublicConfiguration,validateBuildConfiguration,validateRuntimeConfiguration} from '../scripts/configuration.mjs';

const staging={CASTIQ_APP_ORIGIN:'https://fixture.castiq.invalid',CASTIQ_DATA_MODE:'supabase',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture_only',NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.invalid'};
const runtime={...staging,APP_ENV:'staging',AUTH_MODE:'supabase',HOST:'127.0.0.1',PORT:'44173',DATABASE_URL:'postgresql://fixture:fixture@127.0.0.1:55439/fixture',UPLOAD_DIR:'/var/lib/castiq-fixture/uploads',PUBLICATION_MODE:'sandbox',RELEASE_SHA:'a'.repeat(40)};

test('the public build contract contains exactly the four requested names and needs no runtime secret',()=>{
 assert.deepEqual(publicConfigurationNames,['CASTIQ_APP_ORIGIN','CASTIQ_DATA_MODE','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','NEXT_PUBLIC_SUPABASE_URL']);
 const result=validateBuildConfiguration(staging,{target:'staging'});
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.configuration,staging);
 assert.equal('DATABASE_URL' in result.configuration,false);
});

test('every staging public variable must be supplied under its canonical name',()=>{
 for(const name of publicConfigurationNames){const environment={...staging};delete environment[name];assert.ok(validateBuildConfiguration(environment,{target:'staging'}).errors.some(error=>error.startsWith(name+':')));}
 const aliases={APP_ORIGIN:staging.CASTIQ_APP_ORIGIN,VITE_DATA_MODE:'server',SUPABASE_URL:staging.NEXT_PUBLIC_SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:staging.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY};
 assert.equal(validateBuildConfiguration(aliases,{target:'staging'}).errors.filter(error=>error.includes('publieke buildcontract')).length,4);
});

test('local legacy aliases remain usable and are never silently preferred over conflicting new values',()=>{
 const local={APP_ORIGIN:'http://127.0.0.1:4173',VITE_DATA_MODE:'demo'};
 assert.deepEqual(validateBuildConfiguration(local).errors,[]);
 assert.equal(resolvePublicConfiguration(local).configuration.CASTIQ_DATA_MODE,'demo');
 const conflicted=resolvePublicConfiguration({...staging,SUPABASE_URL:'https://other.supabase.invalid'});
 assert.ok(conflicted.errors.some(error=>error.startsWith('NEXT_PUBLIC_SUPABASE_URL:')));
 assert.ok(conflicted.errors.every(error=>!error.includes('other.supabase.invalid')));
 assert.deepEqual(local,{APP_ORIGIN:'http://127.0.0.1:4173',VITE_DATA_MODE:'demo'});
});

test('staging refuses demo mode, HTTP, credentials, URL paths and private or legacy Supabase keys',()=>{
 for(const patch of [
  {CASTIQ_DATA_MODE:'demo'},{CASTIQ_DATA_MODE:'server'},
  {CASTIQ_APP_ORIGIN:'http://fixture.castiq.invalid'},{CASTIQ_APP_ORIGIN:'https://fixture.castiq.invalid/path'},
  {CASTIQ_APP_ORIGIN:'https://fixture:password@fixture.castiq.invalid'},
  {NEXT_PUBLIC_SUPABASE_URL:'http://fixture.supabase.invalid'},{NEXT_PUBLIC_SUPABASE_URL:'https://fixture.supabase.invalid/rest/v1'},
  {NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_must_never_escape'},{NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'eyJlegacy_jwt'},
 ])assert.ok(validateBuildConfiguration({...staging,...patch},{target:'staging'}).errors.length,JSON.stringify(Object.keys(patch)));
});

test('partial authentication and secret-like public variable names fail closed',()=>{
 assert.ok(validateBuildConfiguration({NEXT_PUBLIC_SUPABASE_URL:staging.NEXT_PUBLIC_SUPABASE_URL}).errors.length);
 for(const name of ['NEXT_PUBLIC_DATABASE_URL','VITE_SUPABASE_SERVICE_ROLE_KEY','NEXT_PUBLIC_SUPABASE_SECRET_KEY','VITE_ACCESS_TOKEN','NEXT_PUBLIC_REFRESH_TOKEN']){
  const result=validateBuildConfiguration({...staging,[name]:'must-not-appear'},{target:'staging'});
  assert.ok(result.errors.some(error=>error.startsWith(name+':')));assert.ok(result.errors.every(error=>!error.includes('must-not-appear')));
 }
});

test('runtime validates the same public configuration plus isolated server requirements',()=>{
 assert.deepEqual(validateRuntimeConfiguration(runtime).errors,[]);
 const local={APP_ENV:'local',AUTH_MODE:'local',HOST:'127.0.0.1',PORT:'4174',APP_ORIGIN:'http://127.0.0.1:4173',DATABASE_URL:runtime.DATABASE_URL,UPLOAD_DIR:'.local/uploads',PUBLICATION_MODE:'sandbox'};
 assert.deepEqual(validateRuntimeConfiguration(local).errors,[]);
 for(const patch of [{AUTH_MODE:'local'},{HOST:'0.0.0.0'},{PUBLICATION_MODE:'live'},{PORT:'0'},{PORT:'4.2'},{DATABASE_URL:'https://fixture.invalid'},{RELEASE_SHA:'a'.repeat(7)}])assert.ok(validateRuntimeConfiguration({...runtime,...patch}).errors.length);
 assert.ok(validateRuntimeConfiguration({...local,HOST:'0.0.0.0'}).errors.length);
 assert.ok(validateRuntimeConfiguration({...runtime,SUPABASE_PUBLISHABLE_KEY:'sb_publishable_other'}).errors.length);
});

test('build-only CLI validates without database credentials and never prints configuration values',()=>{
 const execute=environment=>spawnSync(process.execPath,['scripts/check-config.mjs','--scope=build','--target=staging'],{cwd:new URL('..',import.meta.url),env:environment,encoding:'utf8'});
 const success=execute(staging);assert.equal(success.status,0,success.stderr);assert.ok(success.stdout.includes('(build, staging)'));
 const failure=execute({...staging,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_secret_must_never_escape'});assert.equal(failure.status,1);
 for(const result of [success,failure])for(const input of Object.values(staging))if(input!=='server')assert.ok(!(result.stdout+result.stderr).includes(input));
 assert.ok(!failure.stderr.includes('must_never_escape'));
});

test('provider publication requires explicit mode and distinct private runtime keys',()=>{
 const provider={...runtime,PUBLICATION_MODE:'provider',CHANNEL_TOKEN_ENCRYPTION_KEY:'d'.repeat(64),PUBLICATION_MEDIA_SIGNING_KEY:'e'.repeat(64)};
 assert.deepEqual(validateRuntimeConfiguration(provider).errors,[]);
 for(const patch of [{CHANNEL_TOKEN_ENCRYPTION_KEY:''},{PUBLICATION_MEDIA_SIGNING_KEY:'d'.repeat(64)}])assert.ok(validateRuntimeConfiguration({...provider,...patch}).errors.length);
 assert.ok(validateRuntimeConfiguration({...runtime,PUBLICATION_MODE:'provider'}).errors.length);
});
