#!/usr/bin/python3
"""Install a reviewed fixed helper per Castiq environment; no release execution."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

MACHINE='4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7'

def reviewed(source, target, replace):
    info=source.lstat()
    assert source.is_file() and not source.is_symlink() and info.st_uid==0 and not info.st_mode&0o022, 'Use a root-owned reviewed provision copy'
    if target.exists() or target.is_symlink():
        assert target.is_file() and not target.is_symlink() and target.stat().st_uid==0 and not target.stat().st_mode&0o022, 'Unsafe installed boundary'
        if target.read_bytes()==source.read_bytes():
            return
        assert replace, 'Different reviewed boundary requires --replace-reviewed'
    temporary=target.with_suffix(target.suffix+'.reviewed-next')
    assert not temporary.exists()
    shutil.copyfile(source,temporary)
    os.chmod(temporary,0o755)
    os.chown(temporary,0,0)
    os.replace(temporary,target)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--install',action='store_true',required=True)
    parser.add_argument('--source-root',type=Path,required=True)
    parser.add_argument('--replace-reviewed',action='store_true')
    args=parser.parse_args()
    assert os.geteuid()==0 and hashlib.sha256(Path('/etc/machine-id').read_bytes()).hexdigest()==MACHINE
    for environment,suffix in (('staging','stg'),('production','prd')):
        site='castiq-vps08-'+environment
        config=Path('/etc/dg-webservices')/site
        host=json.loads((config/'host.json').read_text())
        install=Path('/usr/local/libexec')/site
        assert host['installRoot']==str(install) and host['siteId']==site
        for source,target in [('deploy/dg-vps-08/release.py','release.py'),('deploy/dg-vps-08/healthcheck.mjs','healthcheck.mjs'),('scripts/release-gate.mjs','release-gate.mjs'),('scripts/configuration.mjs','configuration.mjs'),('scripts/check-config.mjs','check-config.mjs')]:
            reviewed(args.source_root/source,install/target,args.replace_reviewed)
        digest=hashlib.sha256((install/'release.py').read_bytes()).hexdigest()
        policy=f'run-cas-v08-{suffix} ALL=(root) NOPASSWD: sha256:{digest} {install}/release.py ^(build [0-9a-f]{{40}} [1-9][0-9]*-[1-9][0-9]*|activate [0-9a-f]{{40}} [1-9][0-9]*-[1-9][0-9]* [A-Za-z0-9][A-Za-z0-9_-]* [A-Za-z0-9][A-Za-z0-9_-]*)$\n'
        target=Path('/etc/sudoers.d')/(site+'-release')
        if target.exists():
            assert target.is_file() and not target.is_symlink() and target.stat().st_uid==0
            assert target.read_text()==policy or args.replace_reviewed
        with tempfile.NamedTemporaryFile(mode='w',prefix='castiq-sudo-',delete=False) as temporary:
            temporary.write(policy)
            temporary.flush()
            os.chmod(temporary.name,0o440)
            subprocess.run(['visudo','-cf',temporary.name],check=True)
            shutil.copyfile(temporary.name,target)
            os.chmod(target,0o440)
            os.chown(target,0,0)
        Path(temporary.name).unlink()
        subprocess.run(['visudo','-cf',target],check=True)
        print(json.dumps({'siteId':site,'helperSha256':digest,'installed':True,'releaseExecuted':False}))

if __name__=='__main__':
    main()
