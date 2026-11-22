#!/usr/bin/env python3
"""Decrypt via SSH memory streams into a disposable networkless PG17 cluster."""
import argparse
import json
import re
import subprocess
import time
import uuid

SSH=['ssh','-i','/home/codex/.ssh/dg_vps_08_ed25519','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','StrictHostKeyChecking=yes','codex@100.65.51.108']
NODE='/opt/dg-toolchains/castiq-vps08-staging/node-v24.18.0-linux-x64/bin/node'
TOOL='/usr/local/libexec/castiq-vps08-staging/backup/staging-backup.mjs'
phase='initial'
IMAGE='postgres@sha256:8d174ddfb292f26b6ec8d97f55d944ccab547fa8bfe9e4fd3c24afdc819ee423'

def execute(arguments, **options):
    return subprocess.run(arguments,check=True,capture_output=True,**options)

def remote(operation,identifier):
    return SSH+['sudo',NODE,TOOL,operation,identifier]

def quoted(value):
    return '"'+value.replace('"','""')+'"'

def main():
    global phase
    parser=argparse.ArgumentParser()
    parser.add_argument('backup_id')
    parser.add_argument('--environment',choices=('staging','production'),default='staging')
    args=parser.parse_args()
    global NODE,TOOL
    site='castiq-vps08-'+args.environment
    NODE='/opt/dg-toolchains/'+site+'/node-v24.18.0-linux-x64/bin/node'
    TOOL='/usr/local/libexec/'+site+'/backup/staging-backup.mjs'
    assert args.backup_id.startswith('backup-') and all(c.isalnum() or c=='-' for c in args.backup_id)
    phase='manifest'
    manifest=json.loads(execute(remote('manifest',args.backup_id)).stdout)
    assert manifest['siteId']==site and manifest['schema']=='castiq'
    assert manifest['excludedControlPlaneTables']==['castiq.account_operation_keys']
    assert all(row['name']!='account_operation_keys' for row in manifest['tables'])
    phase='authenticate'
    execute(remote('verify',args.backup_id))
    container='castiq-encrypted-restore-'+uuid.uuid4().hex[:16]
    started=False
    try:
        phase='container-create'
        execute(['docker','run','--pull=never','--detach','--name',container,'--label','io.castiq.encrypted-restore=true','--network=none','--read-only','--user=postgres',
            '--cap-drop=ALL','--security-opt=no-new-privileges','--memory=1g','--cpus=1','--pids-limit=128',
            '--tmpfs','/var/lib/postgresql/data:rw,nosuid,nodev,size=512m,uid=999,gid=999',
            '--tmpfs','/var/run/postgresql:rw,nosuid,nodev,size=16m,uid=999,gid=999',
            '--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=16m','--env','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE])
        started=True
        phase='cluster-readiness'
        for _ in range(30):
            if subprocess.run(['docker','exec',container,'pg_isready','-U','postgres'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0:
                break
            time.sleep(1)
        else:
            raise RuntimeError('restore_cluster_not_ready')
        phase='restore-role-placeholders'
        for name in manifest['policyRoles']:
            assert isinstance(name,str) and len(name)<64 and '\0' not in name
            if name!='postgres':
                execute(['docker','exec',container,'psql','-X','-q','-v','ON_ERROR_STOP=1','-U','postgres','-c','CREATE ROLE '+quoted(name)+' NOLOGIN;'])
        phase='restore-stream'
        source=subprocess.Popen(remote('decrypt-database',args.backup_id),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        target=subprocess.Popen(['docker','exec','-i',container,'pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','postgres','-d','postgres'],stdin=source.stdout,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        source.stdout.close()
        _,restore_error=target.communicate(timeout=120)
        decrypt_error=source.stderr.read()
        source.wait(timeout=15)
        if source.returncode or target.returncode:
            error_text=restore_error.decode(errors='replace')
            reasons=[name for name,pattern in [('missing_auth_schema',r'schema "auth" does not exist'),('missing_role',r'role .* does not exist'),('missing_relation',r'relation .* does not exist'),('missing_function',r'function .* does not exist'),('permission',r'permission denied'),('unexpected_file_format',r'unsupported version|does not appear to be a valid archive'),('security_label',r'security label'),('transaction_parameter',r'unrecognized configuration parameter')] if re.search(pattern,error_text)]
            first_error=next((line for line in error_text.splitlines() if line.startswith('pg_restore: error:')),'unclassified restore error')
            first_error=re.sub(r'"[^"]*"|\'[^\']*\'','<redacted>',first_error)
            first_error=re.sub(r'[^\s]+@[^\s]+|[A-Za-z0-9_-]{40,}','<redacted>',first_error)
            parameter=re.search(r'unrecognized (?:configuration )?parameter "([A-Za-z0-9_.]+)"',error_text)
            print(json.dumps({'component':'castiq-restore-stream','decryptCode':source.returncode,'restoreCode':target.returncode,'classifiedReasons':reasons,'redactedOperationalError':first_error[:300],'operationalParameterName':parameter.group(1) if parameter else None}))
            raise AssertionError('authenticated_stream_or_restore_failed')
        for table in manifest['tables']:
            phase='compare:'+table['name']
            assert isinstance(table['name'],str) and len(table['name'])<64
            sql='SET TIME ZONE \'UTC\'; SELECT json_build_object(\'count\',count(*)::bigint,\'digest\',md5(COALESCE(string_agg(row_to_json(t)::text,E\'\\n\' ORDER BY row_to_json(t)::text COLLATE "C"),\'\'))) FROM castiq.'+quoted(table['name'])+' t;'
            restored=json.loads(execute(['docker','exec',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-c',sql]).stdout)
            assert restored['count']==table['count'] and restored['digest']==table['digest'], 'table_digest_mismatch'
        phase='table-inventory'
        count=json.loads(execute(['docker','exec',container,'psql','-X','-qAt','-U','postgres','-c',"SELECT json_build_object('tables',count(*)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='castiq' AND c.relkind IN ('r','p');"]).stdout)['tables']
        assert count==len(manifest['tables']), 'unexpected_restored_tables'
        phase='record-proof'
        restored_version=execute(['docker','exec',container,'psql','-X','-qAt','-U','postgres','-c','SHOW server_version']).stdout.decode().strip()
        execute(remote('record-restore',args.backup_id))
        print(json.dumps({'backupId':args.backup_id,'encryptedBackupAuthenticated':True,'isolatedPostgresVersion':restored_version,'restoredTables':count,'restoredRows':sum(row['count'] for row in manifest['tables']),
            'allTableCountsAndDigestsMatched':True,'uploadsAuthenticated':len(manifest['uploads']),'temporaryDataStorage':'tmpfs','network':'none','plaintextDumpFilesCreated':False,'providerRetentionVerified':False}))
    finally:
        if started:
            label=execute(['docker','inspect',container,'--format','{{index .Config.Labels "io.castiq.encrypted-restore"}}']).stdout.strip()
            assert label==b'true','refuse_foreign_container_cleanup'
            execute(['docker','rm','--force',container])

if __name__=='__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'component':'castiq-isolated-backup-restore','status':'failed','phase':phase,'dataOrCredentialsLogged':False}))
        raise SystemExit(1)
