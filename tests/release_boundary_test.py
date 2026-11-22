"""Offline tests for the root-owned deployment boundary; all writes stay in tmp."""
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tarfile
import tempfile
import types
import unittest
import urllib.error
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('castiq_release', ROOT / 'deploy/dg-vps-08/release.py')
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)
PUBLIC = {
    'CASTIQ_APP_ORIGIN': 'https://fixture.castiq.invalid',
    'CASTIQ_DATA_MODE': 'supabase',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': 'sb_publishable_fixture_only',
    'NEXT_PUBLIC_SUPABASE_URL': 'https://fixture.supabase.invalid',
}

PRIVATE = {'DATABASE_URL': 'postgresql://fixture:new-private-password@fixture.invalid/castiq', 'MAIL_ENCRYPTION_KEY': 'a' * 64, 'PRIVACY_LEDGER_HMAC_KEY': 'b' * 64, 'SUPABASE_ACCOUNT_OPERATIONS_KEY': 'c' * 64}

def archive(path, members):
    with tarfile.open(path, 'w') as output:
        for name, kind, content in members:
            member = tarfile.TarInfo(name)
            if kind == 'file':
                data = content.encode()
                member.size = len(data)
                output.addfile(member, io.BytesIO(data))
            elif kind == 'directory':
                member.type = tarfile.DIRTYPE
                output.addfile(member)
            else:
                member.type = {'symlink': tarfile.SYMTYPE, 'hardlink': tarfile.LNKTYPE, 'fifo': tarfile.FIFOTYPE}[kind]
                member.linkname = content
                output.addfile(member)


@contextlib.contextmanager
def root_owned_stat(function):
    # The helper runs as root on the VPS. Preserve real tmpfile inode/mode/link
    # state while modelling its expected owner without requiring sudo in CI.
    def read(*arguments, **options):
        info = function(*arguments, **options)
        return types.SimpleNamespace(st_mode=info.st_mode, st_uid=0, st_nlink=info.st_nlink, st_size=info.st_size)
    yield read


class ReleaseBoundaryTests(unittest.TestCase):
    def setUp(self):
        release.select_environment('staging')
        self.temporary = tempfile.TemporaryDirectory(prefix='castiq-release-test-')
        self.base = Path(self.temporary.name)
        self.addCleanup(self.temporary.cleanup)

    @contextlib.contextmanager
    def transaction(self, existing=True, worker=True, on_lock=None, environment='staging'):
        release.select_environment(environment)
        site_id = release.SITE_ID
        site = self.base / 'transaction-site'
        config = self.base / 'transaction-config'
        for path in [site / 'candidates', site / 'releases', site / 'locks', config / 'runtime.d', config / 'releases.d']:
            path.mkdir(parents=True, exist_ok=True)
        sha, old_sha, older_sha = 'a' * 40, 'b' * 40, 'c' * 40
        candidate_id, runtime_id = 'candidate-100-1', 'runtime1'
        candidate = site / 'candidates' / candidate_id
        candidate.mkdir()
        (candidate / 'artifact/server').mkdir(parents=True)
        (candidate / 'artifact/server/index.ts').write_text('fixture application')
        metadata = {'candidateId': candidate_id, 'sha': sha, 'configId': release.fingerprint(PUBLIC), 'runId': '100-1', 'environment': environment, 'siteId': site_id, 'databaseCompatibility': 'castiq-schema-v8'}
        (candidate / 'release.json').write_text(json.dumps(metadata))
        old, older = site / 'releases/old-release', site / 'releases/older-release'
        for path, version in [(old, old_sha), (older, older_sha)]:
            path.mkdir()
            (path / 'pair.json').write_text(json.dumps({'sha': version, 'runtimeConfigId': path.name, 'databaseCompatibility': 'castiq-schema-v8'}))
            (path / 'healthy.json').write_text(json.dumps({'sha': version}))
            runtime_file = config / 'releases.d' / (path.name + '.env')
            runtime_file.write_text('DATABASE_URL="fixture-' + path.name + '"\n')
            (path / 'runtime.env').symlink_to(runtime_file)
        if existing:
            (site / 'current').symlink_to(old)
            (site / 'previous').symlink_to(older)
        state = types.SimpleNamespace(locked=False, worker=worker, app=existing)
        fixture = types.SimpleNamespace(site=site, config=config, sha=sha, old_sha=old_sha, older_sha=older_sha,
            old=old, older=older, candidate=candidate, runtime_id=runtime_id, candidate_id=candidate_id,
            new=site / 'releases' / (candidate_id + '-' + runtime_id), state=state, stdout=io.StringIO())
        fixture.unit_contents = {site_id + '.service': b'fixture isolated app unit', site_id + '-worker.service': b'fixture isolated worker unit'}
        fixture.isolation = {'app_isolated': True, 'proxy_source': '127.0.0.2',
            'app_unit_sha256': release.hashlib.sha256(fixture.unit_contents[release.SITE_ID + '.service']).hexdigest(),
            'worker_unit_sha256': release.hashlib.sha256(fixture.unit_contents[release.SITE_ID + '-worker.service']).hexdigest()}
        prerequisites = {key: True for key in ['database_migrated_and_compatible', 'encrypted_backup_restore_verified', 'private_access_verified', 'control_plane_isolation_verified']}
        prerequisites.update({'runtime_config_id': runtime_id, 'sha': sha})
        profile = {**PUBLIC, **PRIVATE}

        def private_config(path):
            if path == config / 'control-plane-isolation.verified':
                return dict(fixture.isolation)
            if path == config / 'runtime.d' / (runtime_id + '.json'):
                return dict(profile)
            self.assertEqual(path, config / 'activation-readiness.json')
            return dict(prerequisites)

        read_bytes = Path.read_bytes
        def controlled_unit_bytes(path):
            if path.parent == Path('/etc/systemd/system') and path.name in fixture.unit_contents:
                return fixture.unit_contents[path.name]
            return read_bytes(path)

        def command(parts, **options):
            parts = [str(part) for part in parts]
            if parts[0] == '/usr/bin/systemctl':
                self.assertIn(parts[-1], [site_id + '.service', site_id + '-worker.service'])
                if parts[-1] == site_id + '-worker.service':
                    state.worker = parts[1] in ('start', 'restart')
                else:
                    state.app = parts[1] in ('start', 'restart')

        @contextlib.contextmanager
        def transaction_lock(path, **options):
            self.assertEqual(path, config / 'activation.lock')
            self.assertFalse(state.locked)
            state.locked = True
            try:
                if on_lock:
                    on_lock(fixture)
                yield
            finally:
                state.locked = False

        with contextlib.ExitStack() as stack:
            for name, value in [('SITE', site), ('CONFIG', config), ('lock', transaction_lock)]:
                stack.enter_context(mock.patch.object(release, name, value))
            stack.enter_context(mock.patch.object(release, 'private_json', side_effect=private_config))
            stack.enter_context(mock.patch.object(Path, 'read_bytes', controlled_unit_bytes))
            stack.enter_context(mock.patch.object(release.pwd, 'getpwnam', return_value=types.SimpleNamespace(pw_gid=os.getgid())))
            stack.enter_context(mock.patch.object(release.os, 'chown'))
            stack.enter_context(mock.patch.object(release.os, 'chmod'))
            stack.enter_context(mock.patch.dict(release.os.environ, {'SUDO_USER': 'root'}))
            def service_status(parts, **options):
                if str(parts[1]) == 'show':
                    active = state.worker
                    return types.SimpleNamespace(returncode=0, stdout='ActiveState=' + ('active' if active else 'inactive') + '\nSubState=' + ('running' if active else 'dead') + '\nMainPID=' + ('1234' if active else '0') + '\n')
                return types.SimpleNamespace(returncode=0 if state.worker else 3)
            fixture.service_status = service_status
            fixture.status = stack.enter_context(mock.patch.object(release.subprocess, 'run', side_effect=service_status))
            stack.enter_context(mock.patch.object(release.time, 'sleep'))
            fixture.run = stack.enter_context(mock.patch.object(release, 'run', side_effect=command))
            fixture.gate = stack.enter_context(mock.patch.object(release, 'gate', return_value={}))
            fixture.healthy = stack.enter_context(mock.patch.object(release, 'healthy'))
            stack.enter_context(contextlib.redirect_stdout(fixture.stdout))
            fixture.activate = lambda: release.activate(sha, '101-1', {'configuration': dict(PUBLIC)}, candidate_id, runtime_id)
            yield fixture

    def assert_restored(self, fixture):
        self.assertEqual((fixture.site / 'current').resolve(), fixture.old)
        self.assertEqual((fixture.site / 'previous').resolve(), fixture.older)
        self.assertTrue(fixture.state.app)
        self.assertTrue(fixture.state.worker)
        self.assertFalse((fixture.site / '.current-next').is_symlink())
        self.assertFalse((fixture.site / '.previous-next').is_symlink())

    def test_activation_success_commits_native_artifact_runtime_pair_and_starts_worker(self):
        for worker in [True, False]:
            with self.subTest(worker=worker), tempfile.TemporaryDirectory(dir=self.base) as temporary:
                original_base, self.base = self.base, Path(temporary)
                try:
                    with self.transaction(worker=worker) as fixture:
                        old_environment = (fixture.old / 'runtime.env').read_text()
                        fixture.activate()
                        self.assertEqual((fixture.site / 'current').resolve(), fixture.new)
                        self.assertEqual((fixture.site / 'previous').resolve(), fixture.old)
                        self.assertTrue(fixture.state.worker)
                        pair = json.loads((fixture.new / 'pair.json').read_text())
                        self.assertEqual(pair['sha'], fixture.sha)
                        self.assertEqual((fixture.new / 'artifact/server/index.ts').read_text(), 'fixture application')
                        self.assertEqual(pair['runtimeConfigId'], fixture.runtime_id)
                        self.assertEqual((fixture.new / 'runtime.env').resolve(), fixture.config / 'releases.d' / (fixture.new.name + '.env'))
                        self.assertIn('new-private-password', (fixture.new / 'runtime.env').read_text())
                        self.assertNotIn('new-private-password', (fixture.new / 'pair.json').read_text() + fixture.stdout.getvalue())
                        self.assertEqual((fixture.old / 'runtime.env').read_text(), old_environment)
                        healthy_metadata = json.loads((fixture.new / 'healthy.json').read_text())
                        self.assertFalse(healthy_metadata['publicAcceptance'])
                        self.assertEqual(healthy_metadata['checks'], ['loopback-health', 'readiness', 'worker-running'])
                finally:
                    self.base = original_base

    def test_production_activation_uses_its_own_units_and_pairs_configuration(self):
        with self.transaction(environment='production', worker=False) as fixture:
            fixture.activate()
            pair = json.loads((fixture.new / 'pair.json').read_text())
            self.assertEqual(pair['siteId'], 'castiq-vps08-production')
            self.assertEqual(pair['environment'], 'production')
            runtime = (fixture.new / 'runtime.env').read_text()
            self.assertIn('APP_ENV="production"', runtime)
            self.assertIn('PORT="4185"', runtime)
            self.assertIn('PRIVACY_RETENTION_EXECUTE="false"', runtime)
            self.assertTrue(fixture.state.worker)
            service_calls = [call.args[0] for call in fixture.run.call_args_list if str(call.args[0][0]) == '/usr/bin/systemctl']
            self.assertTrue(service_calls)
            self.assertTrue(all(call[-1].startswith('castiq-vps08-production') for call in service_calls))

    def test_activation_refuses_another_environment_before_services_or_release_writes(self):
        with self.transaction() as fixture:
            metadata = json.loads((fixture.candidate / 'release.json').read_text())
            metadata.update(environment='production', siteId='castiq-vps08-production')
            (fixture.candidate / 'release.json').write_text(json.dumps(metadata))
            with self.assertRaisesRegex(ValueError, 'another environment'):
                fixture.activate()
            fixture.run.assert_not_called()
            self.assertFalse(fixture.new.exists())
            self.assert_restored(fixture)

    def test_activation_refuses_changed_unit_after_isolation_verification_before_any_mutation(self):
        with self.transaction() as fixture:
            fixture.unit_contents[release.SITE_ID + '.service'] += b'\nchanged after verification'
            with self.assertRaisesRegex(ValueError, 'isolation configuration changed'):
                fixture.activate()
            fixture.run.assert_not_called()
            fixture.healthy.assert_not_called()
            self.assertFalse(fixture.new.exists())
            self.assert_restored(fixture)

    def test_activation_metadata_failure_after_switch_restores_both_links_and_worker(self):
        with self.transaction() as fixture:
            write_text = Path.write_text
            def fail_healthy_metadata(path, *args, **kwargs):
                if path == fixture.new / 'healthy.json':
                    raise OSError('fixture metadata failure')
                return write_text(path, *args, **kwargs)
            with mock.patch.object(Path, 'write_text', fail_healthy_metadata), self.assertRaisesRegex(OSError, 'metadata failure'):
                fixture.activate()
            self.assert_restored(fixture)
            self.assertTrue(fixture.new.is_dir())
            self.assertEqual([call.args[0] for call in fixture.healthy.call_args_list], [fixture.sha, fixture.old_sha])

    def test_activation_chown_failure_after_health_restores_previous_pair(self):
        with self.transaction() as fixture:
            def fail_healthy_owner(path, *args):
                if Path(path) == fixture.new / 'healthy.json':
                    raise OSError('fixture owner failure')
            with mock.patch.object(release.os, 'chown', side_effect=fail_healthy_owner), self.assertRaisesRegex(OSError, 'owner failure'):
                fixture.activate()
            self.assert_restored(fixture)
            self.assertEqual(json.loads((fixture.old / 'pair.json').read_text())['sha'], fixture.old_sha)

    def test_activation_previous_link_failure_after_update_restores_original_previous(self):
        with self.transaction() as fixture:
            atomic = release.atomic_link
            failed = False
            def fail_after_link(name, target):
                nonlocal failed
                atomic(name, target)
                if name == 'previous' and target == fixture.old and not failed:
                    failed = True
                    raise OSError('fixture previous link failure')
            with mock.patch.object(release, 'atomic_link', side_effect=fail_after_link), self.assertRaisesRegex(OSError, 'previous link failure'):
                fixture.activate()
            self.assert_restored(fixture)

    def test_activation_atomic_replace_failure_does_not_block_recovery(self):
        with self.transaction() as fixture:
            replace = Path.replace
            failed = False
            def fail_replace(path, target):
                nonlocal failed
                if path == fixture.site / '.current-next' and not failed:
                    failed = True
                    raise OSError('fixture atomic replace failure')
                return replace(path, target)
            with mock.patch.object(Path, 'replace', fail_replace), self.assertRaisesRegex(OSError, 'atomic replace failure'):
                fixture.activate()
            self.assert_restored(fixture)

    def test_failed_first_activation_stops_app_removes_own_current_and_retains_failed_pair(self):
        with self.transaction(existing=False, worker=False) as fixture:
            fixture.healthy.side_effect = ValueError('fixture health failure')
            with self.assertRaisesRegex(ValueError, 'health failure'):
                fixture.activate()
            self.assertFalse((fixture.site / 'current').is_symlink())
            self.assertFalse((fixture.site / 'previous').exists())
            self.assertFalse(fixture.state.app)
            self.assertFalse(fixture.state.worker)
            self.assertTrue(fixture.new.is_dir())
            self.assertTrue((fixture.new / 'runtime.env').is_symlink())
            self.assertFalse((fixture.new / 'healthy.json').exists())
            self.assertTrue((fixture.old / 'pair.json').exists())

    def test_first_activation_metadata_failure_after_worker_start_stops_new_worker(self):
        with self.transaction(existing=False, worker=False) as fixture:
            write_text = Path.write_text
            def fail_healthy_metadata(path, *arguments, **options):
                if path == fixture.new / 'healthy.json':
                    self.assertTrue(fixture.state.worker)
                    raise OSError('fixture metadata failure after worker start')
                return write_text(path, *arguments, **options)
            with mock.patch.object(Path, 'write_text', fail_healthy_metadata), self.assertRaisesRegex(OSError, 'after worker start'):
                fixture.activate()
            self.assertFalse(fixture.state.worker)
            self.assertFalse(fixture.state.app)
            self.assertFalse((fixture.site / 'current').is_symlink())
            self.assertFalse((fixture.site / 'previous').is_symlink())
            self.assertEqual([str(part) for part in fixture.run.call_args_list[-2].args[0]], ['/usr/bin/systemctl', 'stop', release.SITE_ID + '-worker.service'])

    def test_first_activation_partially_started_worker_is_stopped_on_start_failure(self):
        with self.transaction(existing=False, worker=False) as fixture:
            command = fixture.run.side_effect
            def partial_worker_start(parts, **options):
                command(parts, **options)
                if [str(part) for part in parts] == ['/usr/bin/systemctl', 'start', release.SITE_ID + '-worker.service']:
                    self.assertTrue(fixture.state.worker)
                    raise OSError('fixture partial worker start failure')
            fixture.run.side_effect = partial_worker_start
            with self.assertRaisesRegex(OSError, 'partial worker start'):
                fixture.activate()
            self.assertFalse(fixture.state.worker)
            self.assertFalse(fixture.state.app)
            self.assertFalse((fixture.site / 'current').is_symlink())

    def test_worker_exit_after_successful_start_refuses_first_activation_and_stops_app(self):
        with self.transaction(existing=False, worker=False) as fixture:
            checks = 0
            def exits_after_start(parts, **options):
                nonlocal checks
                if str(parts[1]) == 'show':
                    checks += 1
                    if checks == 2:
                        fixture.state.worker = False
                return fixture.service_status(parts, **options)
            fixture.status.side_effect = exits_after_start
            with self.assertRaisesRegex(ValueError, 'Worker exited'):
                fixture.activate()
            self.assertEqual(checks, 2)
            self.assertFalse(fixture.state.worker)
            self.assertFalse(fixture.state.app)
            self.assertFalse((fixture.site / 'current').is_symlink())
            self.assertFalse((fixture.new / 'healthy.json').exists())

    def test_worker_exit_rolls_back_to_previous_pair_and_verifies_its_worker(self):
        with self.transaction() as fixture:
            new_checks, old_checks = 0, 0
            def exits_for_new_pair(parts, **options):
                nonlocal new_checks, old_checks
                if str(parts[1]) == 'show':
                    if (fixture.site / 'current').resolve() == fixture.new:
                        new_checks += 1
                        if new_checks == 2:
                            fixture.state.worker = False
                    else:
                        old_checks += 1
                return fixture.service_status(parts, **options)
            fixture.status.side_effect = exits_for_new_pair
            with self.assertRaisesRegex(ValueError, 'Worker exited'):
                fixture.activate()
            self.assertEqual((new_checks, old_checks), (2, 3))
            self.assert_restored(fixture)
            self.assertFalse((fixture.new / 'healthy.json').exists())
            self.assertEqual([call.args[0] for call in fixture.healthy.call_args_list], [fixture.sha, fixture.old_sha])

    def test_worker_start_requires_stable_running_pid_and_has_bounded_wait(self):
        for active, substate, pid in [('activating', 'start', '0'), ('active', 'exited', '1234'), ('active', 'running', '0')]:
            with self.subTest(active=active, substate=substate, pid=pid), mock.patch.object(release, 'run') as start, mock.patch.object(release.subprocess, 'run') as status, mock.patch.object(release.time, 'sleep') as sleep:
                status.return_value = types.SimpleNamespace(returncode=0, stdout=f'ActiveState={active}\nSubState={substate}\nMainPID={pid}\n')
                with self.assertRaisesRegex(ValueError, 'bounded startup'):
                    release.start_worker()
                start.assert_called_once_with(['/usr/bin/systemctl', 'start', 'castiq-vps08-staging-worker.service'])
                self.assertEqual(status.call_count, 8)
                self.assertEqual(sleep.call_count, 7)
                self.assertTrue(all(call.kwargs['timeout'] == 5 for call in status.call_args_list))

    def test_worker_restarts_cannot_count_as_three_observations_of_one_stable_process(self):
        with mock.patch.object(release, 'run'), mock.patch.object(release.subprocess, 'run') as status, mock.patch.object(release.time, 'sleep') as sleep:
            def running(pid):
                return types.SimpleNamespace(returncode=0, stdout=f'ActiveState=active\nSubState=running\nMainPID={pid}\n')
            status.side_effect = [running(pid) for pid in range(100, 108)]
            with self.assertRaisesRegex(ValueError, 'bounded startup'):
                release.start_worker()
            self.assertEqual(status.call_count, 8)
            self.assertEqual(sleep.call_count, 7)
            status.reset_mock()
            sleep.reset_mock()
            status.side_effect = [running(pid) for pid in [100, 100, 200, 200, 200]]
            release.start_worker()
            self.assertEqual(status.call_count, 5)
            self.assertEqual(sleep.call_count, 4)

    def test_rollback_rechecks_previous_after_lock_and_refuses_changed_target(self):
        def replace_previous(fixture):
            self.assertTrue(fixture.state.locked)
            (fixture.site / 'previous').unlink()
            (fixture.site / 'previous').symlink_to(fixture.old)
        with self.transaction(on_lock=replace_previous) as fixture:
            with self.assertRaisesRegex(ValueError, 'recorded previous'):
                release.rollback(fixture.older.name)
            fixture.run.assert_not_called()
            self.assertEqual((fixture.site / 'current').resolve(), fixture.old)

    def test_rollback_refuses_unmanaged_current_without_touching_services(self):
        with self.transaction() as fixture:
            current = fixture.site / 'current'
            current.unlink()
            current.mkdir()
            with self.assertRaisesRegex(ValueError, 'managed symlink'):
                release.rollback(fixture.older.name)
            fixture.run.assert_not_called()
            current.rmdir()
            foreign = self.base / 'foreign-release'
            foreign.mkdir()
            (foreign / 'pair.json').write_text('{}')
            (foreign / 'healthy.json').write_text('{}')
            current.symlink_to(foreign)
            with self.assertRaisesRegex(ValueError, 'healthy managed pair'):
                release.rollback(fixture.older.name)
            fixture.run.assert_not_called()

    def test_rollback_success_swaps_previous_and_preserves_each_runtime_pair(self):
        with self.transaction() as fixture:
            old_runtime = (fixture.old / 'runtime.env').resolve()
            older_runtime = (fixture.older / 'runtime.env').resolve()
            release.rollback(fixture.older.name)
            self.assertEqual((fixture.site / 'current').resolve(), fixture.older)
            self.assertEqual((fixture.site / 'previous').resolve(), fixture.old)
            self.assertEqual((fixture.old / 'runtime.env').resolve(), old_runtime)
            self.assertEqual((fixture.older / 'runtime.env').resolve(), older_runtime)
            self.assertTrue(fixture.state.worker)
            fixture.healthy.assert_called_once_with(fixture.older_sha)

    def test_rollback_refuses_database_compatibility_change_without_service_mutation(self):
        with self.transaction() as fixture:
            pair = json.loads((fixture.older / 'pair.json').read_text())
            pair['databaseCompatibility'] = 'castiq-schema-v5'
            (fixture.older / 'pair.json').write_text(json.dumps(pair))
            with self.assertRaisesRegex(ValueError, 'database compatibility'):
                release.rollback(fixture.older.name)
            fixture.run.assert_not_called()
            self.assert_restored(fixture)

    def test_rollback_preserves_the_independent_privacy_ledger(self):
        with self.transaction() as fixture:
            ledger = fixture.site / 'shared/privacy-ledger/deletions.json'
            ledger.parent.mkdir(parents=True)
            ledger.write_text('{"fixture_deleted_subject_hmac":"opaque"}')
            before = ledger.read_bytes()
            release.rollback(fixture.older.name)
            self.assertEqual(ledger.read_bytes(), before)

    def test_failed_rollback_restores_original_pair_and_worker(self):
        with self.transaction() as fixture:
            def health(sha):
                if sha == fixture.older_sha:
                    raise ValueError('fixture restored target unhealthy')
            fixture.healthy.side_effect = health
            with self.assertRaisesRegex(ValueError, 'target unhealthy'):
                release.rollback(fixture.older.name)
            self.assert_restored(fixture)

    def source_archive(self, members):
        source = self.base / 'source.tar'
        target = self.base / 'source'
        target.mkdir(exist_ok=True)
        archive(source, members)
        return source, target

    def test_source_archive_extracts_one_github_prefix_into_project_root(self):
        source, target = self.source_archive([
            ('castiqnl-platform-a1b2c3d/', 'directory', ''),
            ('castiqnl-platform-a1b2c3d/package.json', 'file', '{"private":true}'),
            ('castiqnl-platform-a1b2c3d/src/app.ts', 'file', 'export {};'),
        ])
        release.extract_source(source, target)
        self.assertEqual((target / 'package.json').read_text(), '{"private":true}')
        self.assertTrue((target / 'src/app.ts').is_file())

    def test_source_archive_refuses_traversal_absolute_paths_and_all_links(self):
        outside = self.base / 'outside'
        vectors = [
            ('../outside', 'file', 'escape'),
            ('prefix/../../outside', 'file', 'escape'),
            (str(outside), 'file', 'escape'),
            ('prefix/link', 'symlink', '../../outside'),
            ('prefix/link', 'hardlink', 'prefix/package.json'),
            ('prefix/fifo', 'fifo', ''),
        ]
        for member in vectors:
            with self.subTest(kind=member[1], name=member[0]):
                source, target = self.source_archive([('prefix/package.json', 'file', '{}'), member])
                with self.assertRaises((ValueError, tarfile.TarError)):
                    release.extract_source(source, target)
                self.assertFalse(outside.exists())

    def test_source_archive_refuses_oversized_declared_content(self):
        member = tarfile.TarInfo('prefix/huge')
        member.size = 512 * 1024**2
        source, target = self.source_archive([('prefix/package.json', 'file', '{}')])
        with mock.patch.object(release.tarfile, 'open') as opening:
            opening.return_value.__enter__.return_value.getmembers.return_value = [member]
            with self.assertRaisesRegex(ValueError, 'exceeds limit'):
                release.extract_source(source, target)
            opening.return_value.__enter__.return_value.extractall.assert_not_called()

    def test_source_archive_refuses_empty_or_multiple_repository_roots(self):
        for members in [[], [('first/package.json', 'file', '{}'), ('second/server.ts', 'file', '')]]:
            source, target = self.source_archive(members)
            with self.assertRaises(ValueError):
                release.extract_source(source, target)

    def test_archive_redirect_is_bound_to_https_codeload_repository_and_full_sha(self):
        sha = 'a' * 40
        valid = 'https://codeload.github.com/castiqnl/platform/legacy.tar.gz/' + sha
        self.assertEqual(release.archive_redirect(valid, sha), valid)
        self.assertEqual(release.archive_redirect(valid + '?token=fixture_signed_link', sha), valid + '?token=fixture_signed_link')
        for location in [
            valid.replace('https:', 'http:'),
            valid.replace('codeload.github.com', 'codeload.github.com.evil.invalid'),
            valid.replace('codeload.github.com', 'fixture@codeload.github.com'),
            valid.replace('codeload.github.com', 'codeload.github.com:443'),
            valid.replace('castiqnl/platform', 'another/platform'),
            valid.replace('legacy.tar.gz', '../../other/legacy.tar.gz'),
            valid.replace(sha, 'b' * 40),
            valid + '#fragment',
        ]:
            with self.subTest(location=location), self.assertRaises(ValueError):
                release.archive_redirect(location, sha)

    def test_source_download_uses_api_token_once_and_does_not_forward_it_to_codeload(self):
        sha = 'a' * 40
        token = 'fixture_api_token'
        location = 'https://codeload.github.com/castiqnl/platform/legacy.tar.gz/' + sha + '?token=fixture_signed_link'
        opener = mock.Mock()
        response = io.BytesIO(b'fixture archive contents')
        opener.open.side_effect = [urllib.error.HTTPError('https://api.github.com', 302, 'Found', {'Location': location}, io.BytesIO()), response]
        destination = self.base / 'download.tar.gz'
        with mock.patch.object(release.urllib.request, 'build_opener', return_value=opener):
            release.fetch_source(sha, token, destination)
        self.assertEqual(destination.read_bytes(), b'fixture archive contents')
        self.assertEqual(opener.open.call_count, 2)
        api_request = opener.open.call_args_list[0].args[0]
        self.assertEqual(api_request.full_url, 'https://api.github.com/repos/castiqnl/platform/tarball/' + sha)
        self.assertEqual(api_request.get_header('Authorization'), 'Bearer ' + token)
        archive_request = opener.open.call_args_list[1].args[0]
        if isinstance(archive_request, str):
            self.assertEqual(archive_request, location)
        else:
            self.assertEqual(archive_request.full_url, location)
            self.assertFalse(any(key.lower() == 'authorization' for key in archive_request.headers))
        self.assertNotIn(token, str(opener.open.call_args_list[1]))

    def test_source_download_refuses_unexpected_origin_status_and_further_redirects(self):
        sha = 'a' * 40
        valid = 'https://codeload.github.com/castiqnl/platform/legacy.tar.gz/' + sha
        for first, second in [
            (io.BytesIO(), None),
            (urllib.error.HTTPError('https://api.github.com', 403, 'Forbidden', {}, io.BytesIO()), None),
            (urllib.error.HTTPError('https://api.github.com', 302, 'Found', {'Location': 'https://evil.invalid/archive'}, io.BytesIO()), None),
            (urllib.error.HTTPError('https://api.github.com', 302, 'Found', {'Location': valid}, io.BytesIO()), urllib.error.HTTPError(valid, 302, 'Found', {'Location': 'https://evil.invalid/archive'}, io.BytesIO())),
        ]:
            opener = mock.Mock()
            opener.open.side_effect = [first] if second is None else [first, second]
            with mock.patch.object(release.urllib.request, 'build_opener', return_value=opener):
                with self.assertRaises((ValueError, urllib.error.HTTPError)):
                    release.fetch_source(sha, 'fixture_api_token', self.base / 'refused.tar.gz')
            self.assertFalse((self.base / 'refused.tar.gz').exists())
            self.assertLessEqual(opener.open.call_count, 2)

    def test_artifact_tree_accepts_only_regular_content_and_internal_file_links(self):
        tree = self.base / 'artifact'
        tree.mkdir()
        (tree / 'nested').mkdir()
        (tree / 'nested/file').write_text('fixture')
        (tree / 'link').symlink_to('nested/file')
        release.regular_tree(tree)
        (tree / 'link').unlink()
        (tree / 'directory-link').symlink_to('nested', target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'file links'):
            release.regular_tree(tree)

    def test_packaged_server_can_load_exact_asset_manifest_without_shipping_other_docs(self):
        source, artifact = self.base / 'source', self.base / 'artifact'
        source.mkdir()
        for name in ['dist', 'server', 'src', 'shared', 'emails', 'scripts', 'database', 'node_modules']:
            (source / name).mkdir()
        for name in ['package.json', 'package-lock.json', '.nvmrc']:
            (source / name).write_text('fixture')
        (source / 'package.json').write_text('{"type":"module"}')
        (source / 'docs').mkdir()
        manifest = (ROOT / 'docs/ASSET-MANIFEST.json').read_bytes()
        (source / 'docs/ASSET-MANIFEST.json').write_bytes(manifest)
        (source / 'docs/handover-private.txt').write_text('not a runtime dependency')
        (source / 'server/workflow.ts').write_text("import {readFileSync} from 'node:fs';\nJSON.parse(readFileSync(new URL('../docs/ASSET-MANIFEST.json',import.meta.url),'utf8'));\n")
        release.copy_runtime_artifact(source, artifact)
        # Exercise the actual module-relative read that previously failed with ENOENT.
        subprocess.run(['node', artifact / 'server/workflow.ts'], check=True, capture_output=True)
        self.assertEqual((artifact / 'docs/ASSET-MANIFEST.json').read_bytes(), manifest)
        self.assertEqual([path.name for path in (artifact / 'docs').iterdir()], ['ASSET-MANIFEST.json'])

    def test_artifact_tree_refuses_escape_broken_links_hardlinks_and_special_files(self):
        outside = self.base / 'outside'
        outside.write_text('fixture outside the artifact')
        for kind in ['escape', 'broken', 'hardlink', 'fifo']:
            tree = self.base / kind
            tree.mkdir()
            item = tree / 'unsafe'
            if kind == 'escape':
                item.symlink_to(outside)
            elif kind == 'broken':
                item.symlink_to('missing')
            elif kind == 'hardlink':
                os.link(outside, item)
            else:
                os.mkfifo(item)
            with self.subTest(kind=kind), self.assertRaises((ValueError, OSError)):
                release.regular_tree(tree)

    def test_identifiers_and_full_shas_cannot_be_paths_or_options(self):
        for value in ['candidate_01', 'a' * 96, 'run-1']:
            self.assertEqual(release.identifier(value), value)
        for value in ['', '.', '..', '../release', '/tmp/release', '-option', 'with space', 'line\nfeed', 'a' * 97, None, 1]:
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                release.identifier(value)
        self.assertIsNotNone(release.SHA.fullmatch('a' * 40))
        for value in ['a' * 39, 'a' * 41, 'A' * 40, 'a' * 40 + '\n', '../main']:
            self.assertIsNone(release.SHA.fullmatch(value))

    def test_public_fingerprint_is_order_stable_and_never_contains_database_credentials(self):
        first = release.fingerprint(PUBLIC)
        self.assertEqual(len(first), 64)
        self.assertEqual(first, release.fingerprint(dict(reversed(list(PUBLIC.items())))))
        self.assertEqual(first, release.fingerprint({**PUBLIC, 'DATABASE_URL': 'fixture-only-secret'}))
        for name in PUBLIC:
            self.assertNotEqual(first, release.fingerprint({**PUBLIC, name: PUBLIC[name] + '-changed'}))

    def test_runtime_pair_requires_exact_public_fingerprint_and_fixed_staging_policy(self):
        metadata = {'sha': 'a' * 40, 'configId': release.fingerprint(PUBLIC), 'environment': 'staging', 'siteId': 'castiq-vps08-staging'}
        profile = {**PUBLIC, **PRIVATE}
        runtime = release.runtime_environment(profile, metadata)
        self.assertEqual(runtime['RELEASE_SHA'], metadata['sha'])
        self.assertEqual(runtime['APP_ENV'], 'staging')
        self.assertEqual(runtime['AUTH_MODE'], 'supabase')
        self.assertEqual(runtime['HOST'], '127.0.0.1')
        self.assertEqual(runtime['PUBLICATION_MODE'], 'sandbox')
        self.assertNotIn('DATABASE_URL', metadata)
        self.assertEqual(runtime['PRIVACY_RETENTION_EXECUTE'], 'false')
        for patch in [{**profile, 'CASTIQ_DATA_MODE': 'demo'}, {**profile, 'UNAPPROVED_KEY': 'value'}, {key: value for key, value in profile.items() if key != 'DATABASE_URL'}]:
            with self.assertRaises(ValueError):
                release.runtime_environment(patch, metadata)
        for value in ['fixture\nINJECTED=true', 'fixture\rvalue', 'fixture\0value', None, 42]:
            with self.assertRaises(ValueError) as error:
                release.runtime_environment({**profile, 'DATABASE_URL': value}, metadata)
            self.assertNotIn('fixture', str(error.exception))
        for name in ['MAIL_ENCRYPTION_KEY', 'PRIVACY_LEDGER_HMAC_KEY', 'SUPABASE_ACCOUNT_OPERATIONS_KEY']:
            with self.subTest(name=name), self.assertRaises(ValueError):
                release.runtime_environment({**profile, name: 'not-a-real-random-key'}, metadata)
        with self.assertRaises(ValueError):
            release.runtime_environment({**profile, 'PRIVACY_RETENTION_EXECUTE': 'enabled'}, metadata)

    def test_native_environment_mapping_is_fixed_and_separate(self):
        for environment, suffix, port in [('staging', 'stg', 4184), ('production', 'prd', 4185)]:
            release.select_environment(environment)
            site = 'castiq-vps08-' + environment
            self.assertEqual(release.SITE, Path('/srv/sites') / site)
            self.assertEqual(release.CONFIG, Path('/etc/dg-webservices') / site)
            self.assertEqual(release.TRUSTED, Path('/usr/local/libexec') / site)
            self.assertEqual(release.BUILD_ROOT, Path('/var/lib/dg-build') / site)
            self.assertEqual(release.APP_USER, 'app-cas-v08-' + suffix)
            self.assertEqual(release.BUILD_USER, 'build-cas-v08-' + suffix)
            self.assertEqual(release.RUNNER_USER, 'run-cas-v08-' + suffix)
            self.assertEqual(release.PORT, port)
        for environment in ['../production', 'development', '', '/tmp/site']:
            with self.subTest(environment=environment), self.assertRaises(ValueError):
                release.select_environment(environment)

    def test_environment_serialization_round_trips_quotes_backslashes_and_shell_metacharacters(self):
        value = 'postgresql://fixture: spaces "quote" \\ slash $value $(printf expanded) `printf expanded` %n @fixture.invalid/db'
        path = self.base / 'runtime.env'
        path.write_text(release.environment_file({'DATABASE_URL': value, 'APP_ENV': 'staging'}))
        # The serializer follows EnvironmentFile's double-quote escaping. A shell
        # parser is an additional check that these characters remain literal.
        result = subprocess.run(['/bin/sh', '-c', 'set -a; . "$1"; printf "%s" "$DATABASE_URL"', 'fixture', str(path)], check=True, capture_output=True, text=True)
        self.assertEqual(result.stdout, value)
        self.assertEqual(result.stderr, '')

    def test_private_json_checks_real_mode_links_size_and_root_ownership(self):
        path = self.base / 'private.json'
        path.write_text('{"fixture":true}')
        path.chmod(0o600)
        original = Path.lstat
        with root_owned_stat(original) as as_root, mock.patch.object(Path, 'lstat', as_root):
            self.assertEqual(release.private_json(path), {'fixture': True})
            path.chmod(0o640)
            with self.assertRaises(ValueError):
                release.private_json(path)
            path.chmod(0o600)
            linked = self.base / 'hardlink.json'
            os.link(path, linked)
            with self.assertRaises(ValueError):
                release.private_json(path)
            linked.unlink()
            symbolic = self.base / 'symbolic.json'
            symbolic.symlink_to(path)
            with self.assertRaises(ValueError):
                release.private_json(symbolic)
            path.write_text(' ' * 32769)
            with self.assertRaises(ValueError):
                release.private_json(path)
        if os.geteuid() != 0:
            path.write_text('{}')
            with self.assertRaises(ValueError):
                release.private_json(path)

    def test_lock_busy_is_nonblocking_and_releases_after_the_context(self):
        path = self.base / 'activation.lock'
        original = os.fstat
        with root_owned_stat(original) as as_root, mock.patch.object(release.os, 'fstat', as_root):
            with release.lock(path):
                with self.assertRaisesRegex(BlockingIOError, 'busy'):
                    with release.lock(path):
                        self.fail('Concurrent release admitted')
            with release.lock(path):
                pass
            with self.assertRaisesRegex(ValueError, 'fixture failure'):
                with release.lock(path):
                    raise ValueError('fixture failure')
            with release.lock(path):
                pass
            path.chmod(0o606)
            with self.assertRaisesRegex(ValueError, 'Unsafe release lock'):
                with release.lock(path):
                    self.fail('World-accessible release lock admitted')

    def test_lock_refuses_symlinks_and_hardlinks(self):
        actual = self.base / 'actual.lock'
        actual.touch(mode=0o600)
        symbolic = self.base / 'symbolic.lock'
        symbolic.symlink_to(actual)
        with self.assertRaises(OSError):
            with release.lock(symbolic):
                self.fail('Symlink lock admitted')
        linked = self.base / 'linked.lock'
        os.link(actual, linked)
        original = os.fstat
        with root_owned_stat(original) as as_root, mock.patch.object(release.os, 'fstat', as_root):
            with self.assertRaises(ValueError):
                with release.lock(linked):
                    self.fail('Hardlinked lock admitted')

    def test_failed_entrypoint_does_not_print_submitted_secret_or_traceback(self):
        secret = 'fixture_secret_must_never_appear'
        result = subprocess.run([sys.executable, str(ROOT / 'deploy/dg-vps-08/release.py'), 'invalid'], input=json.dumps({'DATABASE_URL': secret}), capture_output=True, text=True)
        self.assertEqual(result.returncode, 1)
        self.assertNotIn(secret, result.stdout + result.stderr)
        self.assertNotIn('Traceback', result.stderr)
        self.assertEqual(result.stdout, '')


if __name__ == '__main__':
    unittest.main()
