#!/usr/bin/python3
"""Root-owned Castiq release boundary. No automatic activation or migrations."""
import contextlib
import fcntl
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
import urllib.error
import urllib.parse

SITE = Path('/srv/castiq-staging')
CONFIG = Path('/etc/castiq-staging')
TRUSTED = Path('/usr/local/libexec/castiq-staging')
NODE = Path('/opt/castiq/node-v24.18.0-linux-x64/bin/node')
NPM = NODE.parent.parent / 'lib/node_modules/npm/bin/npm-cli.js'
PUBLIC = ('CASTIQ_APP_ORIGIN', 'CASTIQ_DATA_MODE', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL')
MACHINE = '4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7'
SHA = re.compile(r'[0-9a-f]{40}\Z')
IDENTIFIER = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}\Z')

def require(condition, message):
    if not condition:
        raise ValueError(message)

def identifier(value):
    require(isinstance(value, str) and IDENTIFIER.fullmatch(value), 'Invalid identifier')
    return value

def fingerprint(config):
    return hashlib.sha256(json.dumps({key: config[key] for key in PUBLIC}, sort_keys=True, separators=(',', ':')).encode()).hexdigest()

def private_json(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1, 'Unsafe private configuration permissions')
    require(info.st_size <= 32768, 'Private configuration too large')
    return json.loads(path.read_text())

def write_private(path, value):
    with path.open('x', encoding='utf-8') as stream:
        os.chmod(path, 0o600)
        stream.write(value)

def regular_tree(root):
    """Reject devices and links outside build output before privileged copying."""
    base = root.resolve()
    for parent, directories, files in os.walk(root, followlinks=False):
        for name in directories + files:
            path = Path(parent) / name
            info = path.lstat()
            require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode), 'Special file in artifact')
            if stat.S_ISREG(info.st_mode):
                require(info.st_nlink == 1, 'Hardlinked artifact file')
            if path.is_symlink():
                resolved = path.resolve(strict=True)
                require(resolved.is_relative_to(base), 'Artifact link escapes build directory')
                require(resolved.is_file(), 'Only internal file links are supported')

def extract_source(archive, target):
    with tarfile.open(archive) as source:
        members = source.getmembers()
        require(sum(m.size for m in members) < 512 * 1024**2, 'Source archive exceeds limit')
        roots = {Path(m.name).parts[0] for m in members if Path(m.name).parts}
        require(len(roots) == 1, 'Archive must have one repository root')
        extracted = []
        for member in members:
            require(member.isfile() or member.isdir(), 'Source archive contains links or special files')
            require(not Path(member.name).is_absolute() and '..' not in Path(member.name).parts, 'Unsafe archive path')
            parts = Path(member.name).parts[1:]
            if not parts:
                require(member.isdir(), 'Invalid archive root'); continue
            member.name = str(Path(*parts))
            require((target / member.name).resolve().is_relative_to(target.resolve()), 'Archive path escapes source directory')
            extracted.append(member)
        source.extractall(target, members=extracted, filter='data')

def archive_redirect(location, sha):
    url = urllib.parse.urlsplit(location)
    require(url.scheme == 'https' and url.netloc == 'codeload.github.com' and not url.username and not url.password, 'Unexpected archive origin')
    require(url.path == '/castiqnl/platform/legacy.tar.gz/' + sha and not url.fragment, 'Unexpected archive repository or SHA')
    return location

def fetch_source(sha, token, destination):
    # Never trust runner-owned Git objects/config/replace refs for privileged archiving.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None
    opener = urllib.request.build_opener(NoRedirect())
    request = urllib.request.Request('https://api.github.com/repos/castiqnl/platform/tarball/' + sha,
        headers={'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2026-03-10'})
    try:
        opener.open(request, timeout=30)
        raise ValueError('Expected official archive redirect')
    except urllib.error.HTTPError as response:
        require(response.code == 302, 'Archive API refused request')
        location = archive_redirect(response.headers['Location'], sha)
    # The signed codeload URL remains in memory; never forward the API Authorization header.
    with opener.open(location, timeout=60) as response, destination.open('xb') as output:
        size = 0
        while chunk := response.read(1024 * 1024):
            size += len(chunk)
            require(size < 512 * 1024**2, 'Archive download exceeds limit')
            output.write(chunk)

def run(command, **options):
    subprocess.run([str(part) for part in command], check=True, **options)

@contextlib.contextmanager
def lock(path, shared=False):
    flags = os.O_RDWR | os.O_NOFOLLOW
    if not shared:
        flags |= os.O_CREAT
    descriptor = os.open(path, flags, 0o600)
    try:
        info = os.fstat(descriptor)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and not info.st_mode & 0o007, 'Unsafe release lock')
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise BlockingIOError('Build or activation lock busy; no changes performed') from None
        yield
    finally:
        os.close(descriptor)

def gate(action, sha, run_id, payload, config_id):
    context = payload.get('context', {})
    run_number, attempt = run_id.split('-')
    require(str(context.get('GITHUB_RUN_ID')) == run_number and str(context.get('GITHUB_RUN_ATTEMPT')) == attempt, 'Dispatch run mismatch')
    allowed = ('GITHUB_REPOSITORY', 'GITHUB_REPOSITORY_ID', 'GITHUB_EVENT_NAME', 'GITHUB_REF', 'GITHUB_SHA', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT')
    environment = {'PATH': str(NODE.parent) + ':/usr/bin:/bin', 'HOME': '/root', 'GITHUB_TOKEN': payload.get('token', '')}
    environment.update({key: str(context.get(key, '')) for key in allowed})
    with tempfile.TemporaryDirectory(prefix='castiq-admission-') as temporary:
        output = Path(temporary) / 'admission.json'
        run([NODE, TRUSTED / 'release-gate.mjs', '--action', action, '--sha', sha, '--config-id', config_id, '--output', output], env=environment)
        result = json.loads(output.read_text())
    require(result['sha'] == sha and result['configId'] == config_id, 'Admission mismatch')
    return result

def build(sha, run_id, payload):
    configuration = payload.get('configuration', {})
    require(set(configuration) == set(PUBLIC), 'Exactly four public build variables required')
    require(all(isinstance(v, str) and '\n' not in v and '\r' not in v and '\0' not in v for v in configuration.values()), 'Invalid public configuration')
    config_id = fingerprint(configuration)
    admission = gate('build', sha, run_id, payload, config_id)
    isolation = private_json(CONFIG / 'control-plane-isolation.verified')
    require(isolation.get('build_and_runner_isolated') is True, 'Build and runner control plane isolation not verified')
    require(isolation.get('runner_unit_sha256') == hashlib.sha256(Path('/etc/systemd/system/castiq-staging-runner.service').read_bytes()).hexdigest(), 'Runner isolation configuration changed')
    require(shutil.disk_usage(SITE).free > 6 * 1024**3, 'Less than 6 GiB free')
    require(os.statvfs(SITE).f_favail > 100000, 'Less than 100000 free inodes')
    candidate_id = sha[:12] + '-' + run_id
    destination = SITE / 'candidates' / candidate_id
    require(not destination.exists(), 'Candidate already exists; do not overwrite')
    builder = pwd.getpwnam('castiq-build')
    with lock('/run/lock/dg-build.lock', shared=True):
        with tempfile.TemporaryDirectory(prefix='candidate-', dir='/var/lib/castiq-build/work') as temporary:
            base = Path(temporary)
            archive = base / 'source.tar'
            fetch_source(sha, payload.get('token', ''), archive)
            source = base / 'source'
            source.mkdir()
            extract_source(archive, source)
            archive.unlink()
            os.chown(base, 0, builder.pw_gid)
            os.chmod(base, 0o710)
            home = base / 'home'
            home.mkdir(mode=0o700)
            os.chown(home, builder.pw_uid, builder.pw_gid)
            for parent, directories, files in os.walk(source):
                os.chown(parent, builder.pw_uid, builder.pw_gid)
                os.chmod(parent, 0o750)
                for name in files:
                    os.chown(Path(parent) / name, builder.pw_uid, builder.pw_gid)
            environment = {'PATH': str(NODE.parent) + ':/usr/bin:/bin', 'HOME': str(home), 'NPM_CONFIG_USERCONFIG': '/dev/null', 'APP_ENV': 'staging', **configuration}
            command = ' && '.join([
                f'{NODE} scripts/check-config.mjs --scope=build --target=staging',
                f'{NODE} {NPM} ci --ignore-scripts',
                f'{NODE} {NPM} run check', f'{NODE} {NPM} test',
                f'{NODE} {NPM} run verify:assets', f'{NODE} {NPM} run build',
                f'{NODE} {NPM} prune --omit=dev --ignore-scripts',
            ])
            unit = 'castiq-build-' + run_id
            run(['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec', '--unit=' + unit,
                 '--uid=castiq-build', '--gid=castiq-build', '--working-directory=' + str(source),
                 '-p', 'NoNewPrivileges=yes', '-p', 'PrivateTmp=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes',
                 '-p', 'ReadWritePaths=' + str(source) + ' ' + str(home), '-p', 'InaccessiblePaths=/etc/castiq-staging /srv/castiq-staging',
                 '-p', 'IPAddressDeny=127.0.0.1/32 ::1/128 ::ffff:127.0.0.1/128', '-p', 'MemoryMax=2G', '-p', 'TasksMax=128', '-p', 'RuntimeMaxSec=1200',
                 *['--setenv=' + key + '=' + value for key, value in environment.items()], '/bin/sh', '-c', command])
            regular_tree(source)
            staging = SITE / 'candidates' / ('.pending-' + candidate_id)
            require(not staging.exists(), 'Pending candidate exists; inspect manually')
            staging.mkdir(mode=0o700)
            try:
                for name in ['dist', 'server', 'src', 'database', 'node_modules', 'package.json', 'package-lock.json', '.nvmrc']:
                    item = source / name
                    if item.is_dir():
                        shutil.copytree(item, staging / name, symlinks=False)
                    else:
                        shutil.copyfile(item, staging / name)
                (staging / 'scripts').mkdir()
                shutil.copyfile(source / 'scripts/configuration.mjs', staging / 'scripts/configuration.mjs')
                metadata = {'candidateId': candidate_id, 'sha': sha, 'configId': config_id, 'runId': run_id, 'node': '24.18.0', 'npm': '11.16.0', 'ci': admission, 'publicationMode': 'sandbox-only'}
                (staging / 'release.json').write_text(json.dumps(metadata, indent=2) + '\n')
                app = pwd.getpwnam('castiq-app')
                for parent, directories, files in os.walk(staging):
                    os.chown(parent, 0, app.pw_gid)
                    os.chmod(parent, 0o550)
                    for name in files:
                        path = Path(parent) / name
                        executable = bool(path.stat().st_mode & 0o111)
                        os.chown(path, 0, app.pw_gid)
                        os.chmod(path, 0o550 if executable else 0o440)
                staging.rename(destination)
            except Exception:
                shutil.rmtree(staging)
                raise
    print(json.dumps({'candidateId': candidate_id, 'sha': sha, 'configId': config_id, 'activated': False}))

def runtime_environment(profile, metadata):
    require(set(profile) == {'DATABASE_URL', *PUBLIC}, 'Runtime JSON must contain database URL and exactly four public names')
    require(all(isinstance(v, str) and not any(c in v for c in '\n\r\0') for v in profile.values()), 'Invalid runtime value')
    require(fingerprint(profile) == metadata['configId'], 'Runtime public configuration differs from candidate')
    return {**profile, 'APP_ENV': 'staging', 'AUTH_MODE': 'supabase', 'HOST': '127.0.0.1', 'PORT': '4184', 'UPLOAD_DIR': str(SITE / 'shared/uploads'), 'STATIC_DIR': 'dist', 'PUBLICATION_MODE': 'sandbox', 'RELEASE_SHA': metadata['sha']}

def environment_file(environment):
    # systemd EnvironmentFile double-quote rules; never interpolate through a shell.
    return ''.join(key + '="' + value.replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"\n' for key, value in environment.items())

def atomic_link(name, target):
    temporary = SITE / ('.' + name + '-next')
    require(not temporary.exists() and not temporary.is_symlink(), 'Pending activation exists')
    temporary.symlink_to(target)
    try:
        temporary.replace(SITE / name)
    finally:
        if temporary.is_symlink():
            temporary.unlink()

def healthy(sha):
    # The runner is denied access to loopback admin ports. Check from a separate,
    # root-controlled unit; no application code or secrets enter that process.
    import uuid
    run(['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--unit=castiq-health-' + uuid.uuid4().hex,
         '-p', 'NoNewPrivileges=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes', '-p', 'PrivateTmp=yes',
         '-p', 'RuntimeMaxSec=90', NODE, TRUSTED / 'healthcheck.mjs', sha])

def activate(sha, run_id, payload, candidate_id, runtime_id):
    candidate = SITE / 'candidates' / identifier(candidate_id)
    require(candidate.is_dir() and not candidate.is_symlink(), 'Candidate not found')
    metadata = json.loads((candidate / 'release.json').read_text())
    require(metadata['sha'] == sha and metadata['candidateId'] == candidate_id, 'Candidate SHA mismatch')
    require(fingerprint(payload.get('configuration', {})) == metadata['configId'], 'GitHub public profile differs from candidate')
    gate('activate', sha, run_id, payload, metadata['configId'])
    isolation = private_json(CONFIG / 'control-plane-isolation.verified')
    require(isolation.get('app_isolated') is True and isolation.get('proxy_source') == '127.0.0.2', 'App control plane isolation not verified')
    for name, key in [('castiq-staging.service', 'app_unit_sha256'), ('castiq-staging-worker.service', 'worker_unit_sha256')]:
        require(isolation.get(key) == hashlib.sha256((Path('/etc/systemd/system') / name).read_bytes()).hexdigest(), 'App isolation configuration changed')
    profile = private_json(CONFIG / 'runtime.d' / (identifier(runtime_id) + '.json'))
    runtime = runtime_environment(profile, metadata)
    # Independent, root-controlled prerequisites are filled only after actual acceptance.
    prerequisites = private_json(CONFIG / 'activation-readiness.json')
    for name in ['database_migrated_and_compatible', 'encrypted_backup_restore_verified', 'private_access_verified', 'control_plane_isolation_verified']:
        require(prerequisites.get(name) is True, 'Activation prerequisite missing: ' + name)
    require(prerequisites.get('runtime_config_id') == runtime_id, 'Readiness config mismatch')
    require(prerequisites.get('sha') == sha, 'Readiness SHA mismatch')
    run([NODE, TRUSTED / 'check-config.mjs'], env={'PATH': str(NODE.parent) + ':/usr/bin:/bin', **runtime})
    with lock(SITE / 'locks/activation.lock'):
        release_id = identifier(candidate_id + '-' + runtime_id)
        release = SITE / 'releases' / release_id
        require(not release.exists(), 'Release already exists; choose another reviewed configuration ID')
        shutil.copytree(candidate, release)
        os.chmod(release, 0o750)
        runtime_file = CONFIG / 'releases.d' / (release_id + '.env')
        write_private(runtime_file, environment_file(runtime))
        (release / '.runtime.env').symlink_to(runtime_file)
        pair = {**metadata, 'releaseId': release_id, 'runtimeConfigId': runtime_id, 'activationRunId': run_id}
        (release / 'pair.json').write_text(json.dumps(pair, indent=2) + '\n')
        app = pwd.getpwnam('castiq-app')
        for parent, directories, files in os.walk(release):
            os.chown(parent, 0, app.pw_gid)
            os.chmod(parent, 0o550)
            for name in files:
                path = Path(parent) / name
                if not path.is_symlink():
                    os.chown(path, 0, app.pw_gid)
                    os.chmod(path, 0o550 if path.stat().st_mode & 0o111 else 0o440)
        current = SITE / 'current'
        previous = current.resolve(strict=True) if current.is_symlink() else None
        require(not current.exists() or current.is_symlink(), 'Current is not a managed link')
        if previous:
            require(previous.parent == SITE / 'releases' and (previous / 'healthy.json').is_file(), 'Previous release not a healthy managed pair')
        old_previous = (SITE / 'previous').resolve(strict=True) if (SITE / 'previous').is_symlink() else None
        require(not (SITE / 'previous').exists() or (SITE / 'previous').is_symlink(), 'Previous is not a managed link')
        if old_previous:
            require(old_previous.parent == SITE / 'releases' and (old_previous / 'healthy.json').is_file(), 'Previous is not a healthy managed pair')
        worker_active = subprocess.run(['/usr/bin/systemctl', 'is-active', '--quiet', 'castiq-staging-worker.service']).returncode == 0
        try:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', 'castiq-staging-worker.service'])
            atomic_link('current', release)
            run(['/usr/bin/systemctl', 'restart', 'castiq-staging.service'])
            healthy(sha)
            if worker_active:
                run(['/usr/bin/systemctl', 'start', 'castiq-staging-worker.service'])
            (release / 'healthy.json').write_text(json.dumps({'sha': sha, 'runtimeConfigId': runtime_id, 'checks': ['loopback-health'], 'publicAcceptance': False}) + '\n')
            os.chmod(release / 'healthy.json', 0o440)
            os.chown(release / 'healthy.json', 0, app.pw_gid)
            if previous:
                atomic_link('previous', previous)
        except Exception:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', 'castiq-staging-worker.service'])
            if previous:
                atomic_link('current', previous)
                run(['/usr/bin/systemctl', 'restart', 'castiq-staging.service'])
                healthy(json.loads((previous / 'pair.json').read_text())['sha'])
                if worker_active:
                    run(['/usr/bin/systemctl', 'start', 'castiq-staging-worker.service'])
            else:
                run(['/usr/bin/systemctl', 'stop', 'castiq-staging.service'])
                if current.is_symlink() and current.resolve() == release:
                    current.unlink()
            if old_previous:
                atomic_link('previous', old_previous)
            elif (SITE / 'previous').is_symlink():
                (SITE / 'previous').unlink()
            raise
    print(json.dumps({'releaseId': release_id, 'sha': sha, 'loopbackHealthy': True, 'publicAcceptance': False}))

def rollback(release_id):
    require(not os.environ.get('SUDO_USER') or os.environ['SUDO_USER'] == 'root', 'Rollback requires separate administrator authorization')
    target = SITE / 'releases' / identifier(release_id)
    require(target.is_dir() and not target.is_symlink() and (target / 'healthy.json').is_file(), 'No healthy release pair')
    with lock(SITE / 'locks/activation.lock'):
        require((SITE / 'previous').is_symlink() and (SITE / 'previous').resolve() == target, 'Only the recorded previous healthy pair may be restored')
        require((SITE / 'current').is_symlink(), 'Current is not a managed symlink')
        current = (SITE / 'current').resolve(strict=True)
        require(current.parent == SITE / 'releases' and (current / 'pair.json').is_file() and (current / 'healthy.json').is_file(), 'Current is not a healthy managed pair')
        require(current != target, 'Previous pair already active')
        worker_active = subprocess.run(['/usr/bin/systemctl', 'is-active', '--quiet', 'castiq-staging-worker.service']).returncode == 0
        try:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', 'castiq-staging-worker.service'])
            atomic_link('current', target)
            run(['/usr/bin/systemctl', 'restart', 'castiq-staging.service'])
            healthy(json.loads((target / 'pair.json').read_text())['sha'])
            if worker_active:
                run(['/usr/bin/systemctl', 'start', 'castiq-staging-worker.service'])
            atomic_link('previous', current)
        except Exception:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', 'castiq-staging-worker.service'])
            atomic_link('current', current)
            run(['/usr/bin/systemctl', 'restart', 'castiq-staging.service'])
            healthy(json.loads((current / 'pair.json').read_text())['sha'])
            if worker_active:
                run(['/usr/bin/systemctl', 'start', 'castiq-staging-worker.service'])
            atomic_link('previous', target)
            raise
    print('Previous app/config pair restored; database and external state unchanged')

def main():
    os.umask(0o077)
    require(os.geteuid() == 0, 'Root-owned helper requires root')
    require(hashlib.sha256(Path('/etc/machine-id').read_bytes()).hexdigest() == MACHINE, 'Wrong deployment host')
    arguments = sys.argv[1:]
    if len(arguments) == 2 and arguments[0] == 'rollback':
        rollback(arguments[1]); return
    require(len(arguments) in (3, 5), 'Usage: build SHA RUN-ATTEMPT | activate SHA RUN-ATTEMPT CANDIDATE CONFIG | rollback RELEASE')
    action, sha, run_id = arguments[:3]
    require(action in ('build', 'activate') and SHA.fullmatch(sha), 'Invalid action or full SHA')
    require(re.fullmatch(r'[1-9][0-9]*-[1-9][0-9]*', run_id), 'Invalid workflow run ID')
    require((action == 'build' and len(arguments) == 3) or (action == 'activate' and len(arguments) == 5), 'Invalid action arguments')
    require(os.environ.get('SUDO_USER') in (None, 'root', 'castiq-runner'), 'Wrong caller')
    raw = sys.stdin.buffer.read(32769)
    require(len(raw) <= 32768, 'Input exceeds limit')
    payload = json.loads(raw)
    if action == 'build':
        build(sha, run_id, payload)
    else:
        activate(sha, run_id, payload, *arguments[3:])

if __name__ == '__main__':
    try:
        main()
    except BlockingIOError:
        print('LOCK_BUSY: no action performed', file=sys.stderr); sys.exit(75)
    except Exception:
        # Exceptions may contain URLs or secret config. Do not print repr/traceback.
        print('Release refused or failed; inspect sanitized gate/build/service output. No credentials logged.', file=sys.stderr); sys.exit(1)
