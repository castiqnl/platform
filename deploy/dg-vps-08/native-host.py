#!/usr/bin/python3
"""Additive Castiq native host preparation; never starts apps or imports proxy sites."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import pwd
import shutil
import socket
import subprocess
import tarfile
import tempfile
import urllib.request

MACHINE = '4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7'
NODE_SHA = '55aa7153f9d88f28d765fcdad5ae6945b5c0f98a36881703817e4c450fa76742'
RUNNER_SHA = 'baebf204307bac6193480852732f0aba2ae97b6c5597c244f4d5558390147c40'
HERE = Path(__file__).resolve().parent

def command(*arguments):
    subprocess.run([str(value) for value in arguments], check=True)

def account(name, home):
    try:
        value = pwd.getpwnam(name)
        assert value.pw_dir == str(home), 'Unexpected existing account home'
    except KeyError:
        command('/usr/sbin/useradd', '--system', '--user-group', '--home-dir', home, '--shell', '/usr/sbin/nologin', name)
        value = pwd.getpwnam(name)
    return value

def directory(path, mode=0o700, owner=0, group=0):
    path = Path(path)
    path.mkdir(parents=True, exist_ok=True)
    assert not path.is_symlink() and path.is_dir(), 'Unexpected directory link'
    os.chown(path, owner, group)
    os.chmod(path, mode)

def own_file(path, content, mode=0o600):
    path = Path(path)
    if path.exists() or path.is_symlink():
        assert path.is_file() and not path.is_symlink() and path.read_bytes() == content.encode(), 'Existing different own configuration: ' + str(path)
        assert path.stat().st_uid == 0 and not path.stat().st_mode & 0o022, 'Unsafe existing configuration'
        return
    with path.open('x') as stream:
        os.chmod(path, mode)
        stream.write(content)

def fetch(url, destination, expected):
    with urllib.request.urlopen(url, timeout=90) as response, destination.open('xb') as target:
        shutil.copyfileobj(response, target)
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == expected, 'Official archive checksum mismatch'

def sandbox():
    return '''NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictRealtime=true
LockPersonality=true
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
IPAddressDeny=127.0.0.1/32 ::1/128 ::ffff:127.0.0.1/128
'''

def prepare(environment, runner_archive):
    site = 'castiq-vps08-' + environment
    suffix = 'stg' if environment == 'staging' else 'prd'
    port = 4184 if environment == 'staging' else 4185
    origin = 'https://staging.castiq.nl' if environment == 'staging' else 'https://castiq.nl'
    root = Path('/srv/sites') / site
    config = Path('/etc/dg-webservices') / site
    build = Path('/var/lib/dg-build') / site
    runner = Path('/opt/actions-runner') / site
    install = Path('/usr/local/libexec') / site
    toolchain = Path('/opt/dg-toolchains') / site / 'node-v24.18.0-linux-x64'
    for name in (site + '.service', site + '-worker.service', site + '-runner.service'):
        assert subprocess.run(['systemctl', 'is-active', '--quiet', name]).returncode != 0, 'Existing active own unit'
    assert not (root / 'current').exists() and not (root / 'current').is_symlink(), 'Existing own release'
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', port))
    users = {role: account(role + '-cas-v08-' + suffix, runner if role == 'run' else build / 'home' if role == 'build' else root / 'shared') for role in ('app', 'build', 'run')}
    app, builder, run = users['app'], users['build'], users['run']
    command('/usr/sbin/usermod', '-a', '-G', 'dg-build', builder.pw_name)
    directory(root, 0o750, 0, app.pw_gid)
    for name in ('candidates', 'releases', 'shared'):
        directory(root / name, 0o750, 0, app.pw_gid)
    for name in ('uploads', 'privacy-ledger'):
        directory(root / 'shared' / name, 0o700, app.pw_uid, app.pw_gid)
    directory(root / 'shared/backups')
    directory(config)
    for name in ('runtime.d', 'releases.d', 'pending'):
        directory(config / name)
    directory(build, 0o710, 0, builder.pw_gid)
    directory(build / 'work', 0o710, 0, builder.pw_gid)
    directory(build / 'home', 0o700, builder.pw_uid, builder.pw_gid)
    directory(runner, 0o700, run.pw_uid, run.pw_gid)
    directory(install, 0o755)
    directory(toolchain.parent, 0o755)
    if not toolchain.exists():
        # Reuse only Castiq's already verified immutable toolchain, never another app's.
        source = Path('/opt/castiq/node-v24.18.0-linux-x64')
        assert source.stat().st_uid == 0 and not source.stat().st_mode & 0o022
        shutil.copytree(source, toolchain, symlinks=True)
    assert subprocess.check_output([toolchain / 'bin/node', '--version'], text=True).strip() == 'v24.18.0'
    assert subprocess.check_output([toolchain / 'bin/node', toolchain / 'lib/node_modules/npm/bin/npm-cli.js', '--version'], text=True).strip() == '11.16.0'
    if not (runner / 'run.sh').exists():
        assert not any(runner.iterdir()), 'Existing different runner directory'
        with tarfile.open(runner_archive) as archive:
            archive.extractall(runner, filter='data')
        for parent, directories, files in os.walk(runner):
            os.chown(parent, run.pw_uid, run.pw_gid)
            for name in files:
                os.chown(Path(parent) / name, run.pw_uid, run.pw_gid, follow_symlinks=False)
    assert subprocess.check_output(['runuser', '-u', run.pw_name, '--', runner / 'bin/Runner.Listener', '--version'], text=True).strip() == '2.338.2'
    profile = {'version':1,'repository':'castiqnl/platform','branch':'main','hostname':'dg-vps-08','machineIdSha256':MACHINE,'environment':environment,'siteId':site,'port':port,'origin':origin,
      **{name:{'user':value.pw_name,'uid':value.pw_uid,'gid':value.pw_gid} for name,value in (('runner',run),('build',builder),('app',app))},
      'siteRoot':str(root),'buildRoot':str(build),'sourceWorkspace':str(runner / '_work/platform/platform'),'configRoot':str(config),'installRoot':str(install),'node':str(toolchain / 'bin/node'),
      'toolchainPath':str(toolchain / 'bin') + ':/usr/bin:/bin','buildHome':str(build / 'home'),'sharedBuildLock':'/run/lock/dg-build.lock','activationLock':str(config / 'activation.lock'),'service':site+'.service','nodeVersion':'24.18.0','npmVersion':'11.16.0','minimumFreeBytes':6*1024**3,'minimumFreeInodes':100000}
    own_file(config / 'host.json', json.dumps(profile, indent=2) + '\n')
    for worker in (False, True):
        name = site + ('-worker' if worker else '')
        entry = 'worker.ts' if worker else 'index.ts'
        text = f'''[Unit]
Description=Castiq {environment} {'background worker' if worker else 'web and API'}
After=network-online.target
Wants=network-online.target
ConditionPathIsSymbolicLink={root}/current
ConditionPathExists={root}/current/runtime.env

[Service]
Type=simple
User={app.pw_name}
Group={app.pw_name}
WorkingDirectory={root}/current/artifact
Environment=NODE_ENV=production
EnvironmentFile={root}/current/runtime.env
ExecStart={toolchain}/bin/node {root}/current/artifact/server/{entry}
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillMode=control-group
UMask=0077
LogNamespace={site}
{sandbox()}ReadWritePaths={root}/shared/uploads {root}/shared/privacy-ledger
MemoryMax={'1G' if worker else '2G'}
CPUQuota=200%
TasksMax=128

[Install]
WantedBy=multi-user.target
'''
        own_file(Path('/etc/systemd/system') / (name + '.service'), text, 0o644)
    runner_unit = f'''[Unit]
Description=Castiq dedicated {environment} GitHub runner
After=network-online.target
Wants=network-online.target
ConditionPathExists={runner}/.runner

[Service]
Type=simple
User={run.pw_name}
Group={run.pw_name}
WorkingDirectory={runner}
Environment=PATH={toolchain}/bin:/usr/local/bin:/usr/bin:/bin
ExecStart={runner}/run.sh
Restart=on-failure
RestartSec=10
KillMode=control-group
TimeoutStopSec=60
UMask=0077
LogNamespace={site}
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictSUIDSGID=true
RestrictRealtime=true
LockPersonality=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
IPAddressDeny=127.0.0.1/32 ::1/128 ::ffff:127.0.0.1/128
ReadWritePaths={runner} {root} {config} {build} /run/lock/dg-build.lock
MemoryMax=1G
CPUQuota=100%
TasksMax=128

[Install]
WantedBy=multi-user.target
'''
    own_file(Path('/etc/systemd/system') / (site + '-runner.service'), runner_unit, 0o644)
    directory(Path('/etc/systemd/journald@' + site + '.conf.d'), 0o755)
    own_file(Path('/etc/systemd/journald@' + site + '.conf.d/retention.conf'), '[Journal]\nStorage=persistent\nMaxRetentionSec=30day\nSystemMaxUse=256M\n', 0o644)
    own_file(Path('/etc/systemd/system') / (site + '-log-retention.service'), f'[Unit]\nDescription=Retain only {site} journal\n[Service]\nType=oneshot\nExecStart=/usr/bin/journalctl --namespace={site} --rotate --vacuum-time=30d\n', 0o644)
    own_file(Path('/etc/systemd/system') / (site + '-log-retention.timer'), f'[Unit]\nDescription=Daily {site} journal retention\n[Timer]\nOnCalendar=daily\nPersistent=true\nUnit={site}-log-retention.service\n[Install]\nWantedBy=timers.target\n', 0o644)
    proxy = f'''# Pending Castiq route: install only during authorized activation.
{origin.removeprefix('https://')} {{
    encode zstd gzip
    header X-Robots-Tag "noindex, nofollow, noarchive"
    header Referrer-Policy "no-referrer"
    header X-Content-Type-Options "nosniff"
    reverse_proxy 127.0.0.1:{port} {{
        transport http {{
            local_address 127.0.0.2
        }}
    }}
}}
'''
    own_file(config / 'pending' / (site + '.caddy'), proxy)
    for name in (site, site+'-worker', site+'-runner'):
        command('systemd-analyze', 'verify', '/etc/systemd/system/' + name + '.service')
    print(json.dumps({'siteId':site,'prepared':True,'activated':False,'port':port,'runnerUser':run.pw_name,'runnerPath':str(runner)}))

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--install',action='store_true',required=True)
    parser.add_argument('--environment',choices=('staging','production','both'),default='both')
    args=parser.parse_args()
    assert os.geteuid()==0 and socket.gethostname().split('.')[0]=='dg-vps-08'
    assert hashlib.sha256(Path('/etc/machine-id').read_bytes()).hexdigest()==MACHINE
    lock=Path('/run/lock/dg-build.lock').stat()
    assert lock.st_uid==0 and lock.st_mode&0o777==0o660
    with tempfile.TemporaryDirectory(prefix='castiq-native-provision-') as temporary:
        archive=Path(temporary)/'runner.tar.gz'
        fetch('https://github.com/actions/runner/releases/download/v2.338.2/actions-runner-linux-x64-2.338.2.tar.gz',archive,RUNNER_SHA)
        environments = ('staging','production') if args.environment=='both' else (args.environment,)
        for environment in environments:
            prepare(environment,archive)
    command('systemctl','daemon-reload')
    command('systemctl','enable','--now',*('castiq-vps08-'+environment+'-log-retention.timer' for environment in environments))

if __name__=='__main__':
    main()
