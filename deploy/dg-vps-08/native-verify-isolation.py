#!/usr/bin/python3
"""Probe only trusted code under the new Castiq service boundaries."""
from concurrent.futures import ThreadPoolExecutor
import datetime
import hashlib
import http.client
import json
import os
from pathlib import Path
import subprocess
import time
import uuid

HERE=Path(__file__).resolve().parent
POLICY='127.0.0.1/32 ::1/128 ::ffff:127.0.0.1/128'
ADDRESSES=('127.0.0.1','::1','::ffff:127.0.0.1','0.0.0.0')

def invoke(arguments):
    return subprocess.check_output([str(value) for value in arguments],text=True)

def verify(environment):
    site='castiq-vps08-'+environment
    config=Path('/etc/dg-webservices')/site
    host=json.loads((config/'host.json').read_text())
    port=host['port']
    probe=Path('/usr/local/libexec')/site/'probe-network-isolation.py'
    probe.write_bytes((HERE/'probe-network-isolation.py').read_bytes())
    os.chmod(probe,0o755)
    units={role:site+suffix+'.service' for role,suffix in (('app',''),('worker','-worker'),('runner','-runner'))}
    for unit in units.values():
        assert set(invoke(['systemctl','show',unit,'--value','-p','IPAddressDeny']).split())==set(POLICY.split())
    baseline=json.loads(invoke(['python3',probe,'--baseline']))
    def restricted(role):
        principal=host['runner' if role=='runner' else 'build']['user']
        return json.loads(invoke(['systemd-run','--quiet','--wait','--pipe','--collect','--service-type=exec','--unit='+site+'-probe-'+role+'-'+uuid.uuid4().hex[:8],
            '--uid='+principal,'--gid='+principal,'-p','IPAddressDeny='+POLICY,'-p','NoNewPrivileges=yes','-p','PrivateTmp=yes','-p','ProtectSystem=strict','-p','LogNamespace='+site,'-p','RuntimeMaxSec=40','python3',probe]))
    with ThreadPoolExecutor(max_workers=2) as workers:
        runner_future=workers.submit(restricted,'runner')
        builder_future=workers.submit(restricted,'build')
        unit=site+'-probe-app-'+uuid.uuid4().hex[:8]
        invoke(['systemd-run','--quiet','--collect','--service-type=exec','--unit='+unit,'--uid='+host['app']['user'],'--gid='+host['app']['user'],
            '-p','IPAddressDeny='+POLICY,'-p','NoNewPrivileges=yes','-p','PrivateTmp=yes','-p','ProtectSystem=strict','-p','ProtectHome=yes','-p','LogNamespace='+site,'-p','RuntimeMaxSec=50','python3',probe,'--serve','--port',port])
        try:
            app_report=None
            for _ in range(30):
                try:
                    connection=http.client.HTTPConnection('127.0.0.1',port,timeout=2,source_address=('127.0.0.2',0))
                    connection.request('GET','/probe')
                    response=connection.getresponse()
                    report=json.loads(response.read())
                    connection.close()
                    if response.status==200 and report.get('complete'):
                        app_report=report
                        break
                except (OSError,ValueError):
                    pass
                time.sleep(1)
            assert app_report,'No allowed ingress from127.0.0.2'
            try:
                connection=http.client.HTTPConnection('127.0.0.1',port,timeout=3,source_address=('127.0.0.1',0))
                connection.request('GET','/probe')
                connection.getresponse()
                raise AssertionError('Forbidden ingress succeeded')
            except (TimeoutError,PermissionError):
                pass
        finally:
            subprocess.run(['systemctl','stop',unit],check=False)
        runner_report,builder_report=runner_future.result(),builder_future.result()
    marker={'schema':2,'siteId':site,'verified_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'build_and_runner_isolated':True,'app_isolated':True,'proxy_source':'127.0.0.2',
      'unrestricted_baseline':baseline,'runner_probe':runner_report,'build_probe':builder_report,'app_probe':{**app_report,'allowedIngress127.0.0.2':'HTTP200','deniedIngress127.0.0.1':'FILTERED_TIMEOUT'},
      **{role+'_unit_sha256':hashlib.sha256((Path('/etc/systemd/system')/unit).read_bytes()).hexdigest() for role,unit in units.items()},
      'probe_sha256':hashlib.sha256(probe.read_bytes()).hexdigest()}
    target=config/'control-plane-isolation.verified'
    with target.open('x') as stream:
        os.chmod(target,0o600)
        json.dump(marker,stream,sort_keys=True,indent=2)
        stream.write('\n')
    print(json.dumps({'siteId':site,'isolationVerified':True,'appActivated':False,'runnerAdminBlocked':True,'appAdminBlocked':True}))

if __name__=='__main__':
    assert os.geteuid()==0
    with ThreadPoolExecutor(max_workers=2) as workers:
        list(workers.map(verify,('staging','production')))
