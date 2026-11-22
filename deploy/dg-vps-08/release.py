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

PUBLIC = ('CASTIQ_APP_ORIGIN', 'CASTIQ_DATA_MODE', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL')
PRIVATE = ('DATABASE_URL', 'MAIL_ENCRYPTION_KEY', 'PRIVACY_LEDGER_HMAC_KEY', 'SUPABASE_ACCOUNT_OPERATIONS_KEY')
MACHINE = '4c306aaa5338d05ce10f127bea80dafaf7e62b1500be34cdff3b5ddd617e7bd7'
SHA = re.compile(r'[0-9a-f]{40}\Z')
IDENTIFIER = re.compile(r'[A-Za-z0-9][A-Za-z0-9_-]{0,95}\Z')

def select_environment(environment):
    """Fixed native host contract; never accept runner-supplied filesystem paths."""
    if environment not in ('staging', 'production'):
        raise ValueError('Unknown Castiq environment')
    global ENVIRONMENT, SITE_ID, SITE, CONFIG, TRUSTED, NODE, NPM, PORT, APP_USER, BUILD_USER, RUNNER_USER, BUILD_ROOT
    ENVIRONMENT = environment
    SITE_ID = 'castiq-vps08-' + environment
    suffix = 'stg' if environment == 'staging' else 'prd'
    SITE = Path('/srv/sites') / SITE_ID
    CONFIG = Path('/etc/dg-webservices') / SITE_ID
    TRUSTED = Path('/usr/local/libexec') / SITE_ID
    NODE = Path('/opt/dg-toolchains') / SITE_ID / 'node-v24.18.0-linux-x64/bin/node'
    NPM = NODE.parent.parent / 'lib/node_modules/npm/bin/npm-cli.js'
    PORT = 4184 if environment == 'staging' else 4185
    APP_USER, BUILD_USER, RUNNER_USER = (role + '-cas-v08-' + suffix for role in ('app', 'build', 'run'))
    BUILD_ROOT = Path('/var/lib/dg-build') / SITE_ID

select_environment('staging')

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

def copy_runtime_artifact(source, artifact):
    """Package the application and its explicit runtime documentation dependency."""
    artifact.mkdir()
    for name in ['dist', 'server', 'src', 'shared', 'emails', 'scripts', 'database', 'node_modules', 'package.json', 'package-lock.json', '.nvmrc']:
        item = source / name
        if item.is_dir():
            shutil.copytree(item, artifact / name, symlinks=False)
        else:
            shutil.copyfile(item, artifact / name)
    # server/workflow.ts loads this file relative to its module at startup.
    # Other handover/legal documentation is not part of the server runtime.
    (artifact / 'docs').mkdir()
    shutil.copyfile(source / 'docs/ASSET-MANIFEST.json', artifact / 'docs/ASSET-MANIFEST.json')

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
        run([NODE, TRUSTED / 'release-gate.mjs', '--action', action, '--environment', ENVIRONMENT, '--sha', sha, '--config-id', config_id, '--output', output], env=environment)
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
    require(isolation.get('runner_unit_sha256') == hashlib.sha256((Path('/etc/systemd/system') / (SITE_ID + '-runner.service')).read_bytes()).hexdigest(), 'Runner isolation configuration changed')
    require(shutil.disk_usage(SITE).free > 6 * 1024**3, 'Less than 6 GiB free')
    require(os.statvfs(SITE).f_favail > 100000, 'Less than 100000 free inodes')
    candidate_id = sha + '-' + run_id
    destination = SITE / 'candidates' / candidate_id
    require(not destination.exists(), 'Candidate already exists; do not overwrite')
    builder = pwd.getpwnam(BUILD_USER)
    with lock('/run/lock/dg-build.lock', shared=True):
        with tempfile.TemporaryDirectory(prefix='candidate-', dir=BUILD_ROOT / 'work') as temporary:
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
            environment = {'PATH': str(NODE.parent) + ':/usr/bin:/bin', 'HOME': str(home), 'NPM_CONFIG_USERCONFIG': '/dev/null', 'APP_ENV': ENVIRONMENT, **configuration}
            command = ' && '.join([
                f'{NODE} scripts/check-config.mjs --scope=build --target={ENVIRONMENT}',
                f'{NODE} {NPM} ci --ignore-scripts',
                f'{NODE} {NPM} run check', f'{NODE} {NPM} test',
                f'{NODE} {NPM} run verify:assets', f'{NODE} {NPM} run build',
                f'{NODE} {NPM} prune --omit=dev --ignore-scripts',
            ])
            unit = SITE_ID + '-build-' + run_id
            run(['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--service-type=exec', '--unit=' + unit,
                 '--uid=' + BUILD_USER, '--gid=' + BUILD_USER, '--working-directory=' + str(source),
                 '-p', 'NoNewPrivileges=yes', '-p', 'PrivateTmp=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes',
                 '-p', 'ReadWritePaths=' + str(source) + ' ' + str(home), '-p', 'InaccessiblePaths=/etc/dg-webservices /srv/sites',
                 '-p', 'IPAddressDeny=127.0.0.1/32 ::1/128 ::ffff:127.0.0.1/128', '-p', 'LogNamespace=' + SITE_ID, '-p', 'MemoryMax=2G', '-p', 'TasksMax=128', '-p', 'RuntimeMaxSec=1200',
                 *['--setenv=' + key + '=' + value for key, value in environment.items()], '/bin/sh', '-c', command])
            regular_tree(source)
            staging = SITE / 'candidates' / ('.pending-' + candidate_id)
            require(not staging.exists(), 'Pending candidate exists; inspect manually')
            staging.mkdir(mode=0o700)
            try:
                artifact = staging / 'artifact'
                copy_runtime_artifact(source, artifact)
                metadata = {'candidateId': candidate_id, 'sha': sha, 'configId': config_id, 'runId': run_id, 'environment': ENVIRONMENT, 'siteId': SITE_ID, 'node': '24.18.0', 'npm': '11.16.0', 'ci': admission, 'publicationMode': 'sandbox-only', 'databaseCompatibility': 'castiq-schema-v8'}
                (staging / 'release.json').write_text(json.dumps(metadata, indent=2) + '\n')
                app = pwd.getpwnam(APP_USER)
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
    required = {*PRIVATE, *PUBLIC}
    require(required.issubset(profile) and set(profile).issubset(required | {'PRIVACY_RETENTION_EXECUTE'}), 'Unexpected runtime names or missing private configuration')
    require(all(isinstance(v, str) and not any(c in v for c in '\n\r\0') for v in profile.values()), 'Invalid runtime value')
    require(profile['DATABASE_URL'].startswith(('postgres://', 'postgresql://')), 'PostgreSQL URL required')
    for name in ('MAIL_ENCRYPTION_KEY', 'PRIVACY_LEDGER_HMAC_KEY', 'SUPABASE_ACCOUNT_OPERATIONS_KEY'):
        require(re.fullmatch(r'[a-f0-9]{64}', profile[name]) is not None, 'Runtime key must be 32 random bytes encoded as lowercase hex')
    require(profile.get('PRIVACY_RETENTION_EXECUTE', 'false') in ('true', 'false'), 'Invalid privacy execution setting')
    require(fingerprint(profile) == metadata['configId'], 'Runtime public configuration differs from candidate')
    require(metadata.get('environment') == ENVIRONMENT and metadata.get('siteId') == SITE_ID, 'Candidate belongs to another environment')
    return {**profile, 'PRIVACY_RETENTION_EXECUTE': profile.get('PRIVACY_RETENTION_EXECUTE', 'false'), 'APP_ENV': ENVIRONMENT, 'AUTH_MODE': 'supabase', 'HOST': '127.0.0.1', 'PORT': str(PORT), 'UPLOAD_DIR': str(SITE / 'shared/uploads'), 'PRIVACY_LEDGER_DIR': str(SITE / 'shared/privacy-ledger'), 'STATIC_DIR': 'dist', 'PUBLICATION_MODE': 'sandbox', 'RELEASE_SHA': metadata['sha']}

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
    run(['/usr/bin/systemd-run', '--quiet', '--wait', '--pipe', '--collect', '--unit=' + SITE_ID + '-health-' + uuid.uuid4().hex,
         '-p', 'NoNewPrivileges=yes', '-p', 'ProtectSystem=strict', '-p', 'ProtectHome=yes', '-p', 'PrivateTmp=yes',
         '-p', 'LogNamespace=' + SITE_ID, '-p', 'RuntimeMaxSec=90', NODE, TRUSTED / 'healthcheck.mjs', sha, str(PORT)])

def activate(sha, run_id, payload, candidate_id, runtime_id):
    candidate = SITE / 'candidates' / identifier(candidate_id)
    require(candidate.is_dir() and not candidate.is_symlink(), 'Candidate not found')
    metadata = json.loads((candidate / 'release.json').read_text())
    require(metadata['sha'] == sha and metadata['candidateId'] == candidate_id, 'Candidate SHA mismatch')
    require(fingerprint(payload.get('configuration', {})) == metadata['configId'], 'GitHub public profile differs from candidate')
    gate('activate', sha, run_id, payload, metadata['configId'])
    isolation = private_json(CONFIG / 'control-plane-isolation.verified')
    require(isolation.get('app_isolated') is True and isolation.get('proxy_source') == '127.0.0.2', 'App control plane isolation not verified')
    for name, key in [(SITE_ID + '.service', 'app_unit_sha256'), (SITE_ID + '-worker.service', 'worker_unit_sha256')]:
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
    with lock(CONFIG / 'activation.lock'):
        release_id = identifier(candidate_id + '-' + runtime_id)
        release = SITE / 'releases' / release_id
        require(not release.exists(), 'Release already exists; choose another reviewed configuration ID')
        shutil.copytree(candidate, release)
        os.chmod(release, 0o750)
        runtime_file = CONFIG / 'releases.d' / (release_id + '.env')
        write_private(runtime_file, environment_file(runtime))
        (release / 'runtime.env').symlink_to(runtime_file)
        pair = {**metadata, 'releaseId': release_id, 'runtimeConfigId': runtime_id, 'activationRunId': run_id}
        (release / 'pair.json').write_text(json.dumps(pair, indent=2) + '\n')
        app = pwd.getpwnam(APP_USER)
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
            require(json.loads((previous / 'pair.json').read_text()).get('databaseCompatibility') == metadata.get('databaseCompatibility'), 'Database compatibility differs from current pair')
        old_previous = (SITE / 'previous').resolve(strict=True) if (SITE / 'previous').is_symlink() else None
        require(not (SITE / 'previous').exists() or (SITE / 'previous').is_symlink(), 'Previous is not a managed link')
        if old_previous:
            require(old_previous.parent == SITE / 'releases' and (old_previous / 'healthy.json').is_file(), 'Previous is not a healthy managed pair')
        worker_active = subprocess.run(['/usr/bin/systemctl', 'is-active', '--quiet', SITE_ID + '-worker.service']).returncode == 0
        try:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', SITE_ID + '-worker.service'])
            atomic_link('current', release)
            run(['/usr/bin/systemctl', 'restart', SITE_ID + '.service'])
            healthy(sha)
            run(['/usr/bin/systemctl', 'start', SITE_ID + '-worker.service'])
            (release / 'healthy.json').write_text(json.dumps({'sha': sha, 'runtimeConfigId': runtime_id, 'checks': ['loopback-health'], 'publicAcceptance': False}) + '\n')
            os.chmod(release / 'healthy.json', 0o440)
            os.chown(release / 'healthy.json', 0, app.pw_gid)
            if previous:
                atomic_link('previous', previous)
        except Exception:
            # A first activation can start (or partially start) its worker before
            # metadata fails. Always stop the attempted pair's worker first.
            run(['/usr/bin/systemctl', 'stop', SITE_ID + '-worker.service'])
            if previous:
                atomic_link('current', previous)
                run(['/usr/bin/systemctl', 'restart', SITE_ID + '.service'])
                healthy(json.loads((previous / 'pair.json').read_text())['sha'])
                if worker_active:
                    run(['/usr/bin/systemctl', 'start', SITE_ID + '-worker.service'])
            else:
                run(['/usr/bin/systemctl', 'stop', SITE_ID + '.service'])
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
    with lock(CONFIG / 'activation.lock'):
        require((SITE / 'previous').is_symlink() and (SITE / 'previous').resolve() == target, 'Only the recorded previous healthy pair may be restored')
        require((SITE / 'current').is_symlink(), 'Current is not a managed symlink')
        current = (SITE / 'current').resolve(strict=True)
        require(current.parent == SITE / 'releases' and (current / 'pair.json').is_file() and (current / 'healthy.json').is_file(), 'Current is not a healthy managed pair')
        require(current != target, 'Previous pair already active')
        require(json.loads((current / 'pair.json').read_text()).get('databaseCompatibility') == json.loads((target / 'pair.json').read_text()).get('databaseCompatibility'), 'Code rollback crosses database compatibility boundary')
        worker_active = subprocess.run(['/usr/bin/systemctl', 'is-active', '--quiet', SITE_ID + '-worker.service']).returncode == 0
        try:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', SITE_ID + '-worker.service'])
            atomic_link('current', target)
            run(['/usr/bin/systemctl', 'restart', SITE_ID + '.service'])
            healthy(json.loads((target / 'pair.json').read_text())['sha'])
            if worker_active:
                run(['/usr/bin/systemctl', 'start', SITE_ID + '-worker.service'])
            atomic_link('previous', current)
        except Exception:
            if worker_active:
                run(['/usr/bin/systemctl', 'stop', SITE_ID + '-worker.service'])
            atomic_link('current', current)
            run(['/usr/bin/systemctl', 'restart', SITE_ID + '.service'])
            healthy(json.loads((current / 'pair.json').read_text())['sha'])
            if worker_active:
                run(['/usr/bin/systemctl', 'start', SITE_ID + '-worker.service'])
            atomic_link('previous', target)
            raise
    print('Previous app/config pair restored; database and external state unchanged')

def main():
    os.umask(0o077)
    require(os.geteuid() == 0, 'Root-owned helper requires root')
    require(hashlib.sha256(Path('/etc/machine-id').read_bytes()).hexdigest() == MACHINE, 'Wrong deployment host')
    installed_site = Path(__file__).resolve().parent.name
    require(installed_site in ('castiq-vps08-staging', 'castiq-vps08-production'), 'Run the fixed installed environment helper')
    select_environment(installed_site.removeprefix('castiq-vps08-'))
    host = private_json(CONFIG / 'host.json')
    require(host.get('siteId') == SITE_ID and host.get('repository') == 'castiqnl/platform' and host.get('branch') == 'main', 'Unexpected host profile')
    for name, expected in [('siteRoot', str(SITE)), ('configRoot', str(CONFIG)), ('buildRoot', str(BUILD_ROOT)), ('installRoot', str(TRUSTED)), ('port', PORT), ('node', str(NODE))]:
        require(host.get(name) == expected, 'Host profile path or port mismatch')
    arguments = sys.argv[1:]
    if len(arguments) == 2 and arguments[0] == 'rollback':
        rollback(arguments[1]); return
    require(len(arguments) in (3, 5), 'Usage: build SHA RUN-ATTEMPT | activate SHA RUN-ATTEMPT CANDIDATE CONFIG | rollback RELEASE')
    action, sha, run_id = arguments[:3]
    require(action in ('build', 'activate') and SHA.fullmatch(sha), 'Invalid action or full SHA')
    require(re.fullmatch(r'[1-9][0-9]*-[1-9][0-9]*', run_id), 'Invalid workflow run ID')
    require((action == 'build' and len(arguments) == 3) or (action == 'activate' and len(arguments) == 5), 'Invalid action arguments')
    require(os.environ.get('SUDO_USER') in (None, 'root', RUNNER_USER), 'Wrong caller')
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
