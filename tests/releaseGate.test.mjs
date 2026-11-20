import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  AdmissionError, RELEASE_POLICY, admitRelease, createGitHubApi,
} from '../scripts/release-gate.mjs';

const SHA = '1'.repeat(40);
const MAIN_SHA = '2'.repeat(40);
const WORKFLOW_SHA = '3'.repeat(40);
const CONFIG = 'a'.repeat(64);
const PREFIX = '/repos/castiqnl/platform';
const SOURCE = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url));
const REPOSITORY = { id: 1446413160, full_name: 'castiqnl/platform' };

function fixture(action = 'build') {
  const dispatch = { id: 990, state: 'active', ...RELEASE_POLICY.dispatch[action] };
  const ci = { ...RELEASE_POLICY.ci, state: 'active' };
  const dispatchRun = {
    id: 700, run_attempt: 1, workflow_id: dispatch.id, name: dispatch.name,
    path: dispatch.path, event: 'workflow_dispatch', head_branch: 'main',
    head_sha: WORKFLOW_SHA, repository: REPOSITORY, head_repository: REPOSITORY,
    status: 'in_progress', conclusion: null, display_title: `Castiq staging ${action} ${SHA}`,
  };
  const ciRun = {
    id: 800, run_attempt: 2, run_number: 4, workflow_id: ci.id, name: ci.name,
    path: ci.path, event: 'push', head_branch: 'main', head_sha: SHA,
    repository: REPOSITORY, head_repository: REPOSITORY,
    status: 'completed', conclusion: 'success',
  };
  const paths = {
    repository: PREFIX,
    main: `${PREFIX}/branches/main`,
    comparison: `${PREFIX}/compare/${SHA}...${MAIN_SHA}`,
    workflowComparison: `${PREFIX}/compare/${WORKFLOW_SHA}...${MAIN_SHA}`,
    dispatch: `${PREFIX}/actions/workflows/${dispatch.path.split('/').at(-1)}`,
    dispatchRun: `${PREFIX}/actions/runs/700`,
    ci: `${PREFIX}/actions/workflows/ci.yml`,
    source: `${PREFIX}/contents/.github/workflows/ci.yml?ref=${SHA}`,
    runs: `${PREFIX}/actions/workflows/${ci.id}/runs?head_sha=${SHA}&event=push&branch=main&per_page=100`,
    ciRun: `${PREFIX}/actions/runs/800`,
    jobs: `${PREFIX}/actions/runs/800/attempts/2/jobs?per_page=100`,
  };
  const routes = new Map([
    [paths.repository, { ...REPOSITORY, default_branch: 'main' }],
    [paths.main, { name: 'main', commit: { sha: MAIN_SHA } }],
    [paths.comparison, { status: 'ahead', base_commit: { sha: SHA }, merge_base_commit: { sha: SHA } }],
    [paths.workflowComparison, { status: 'ahead', base_commit: { sha: WORKFLOW_SHA }, merge_base_commit: { sha: WORKFLOW_SHA } }],
    [paths.dispatch, dispatch],
    [paths.dispatchRun, dispatchRun],
    [paths.ci, ci],
    [paths.source, { type: 'file', path: ci.path, encoding: 'base64', content: SOURCE.toString('base64') }],
    [paths.runs, { total_count: 1, workflow_runs: [ciRun] }],
    [paths.ciRun, ciRun],
    [paths.jobs, { total_count: 1, jobs: [{
      id: 900, run_id: 800, run_attempt: 2, head_sha: SHA, name: 'verify',
      status: 'completed', conclusion: 'success',
      steps: ci.steps.map((name) => ({ name, status: 'completed', conclusion: 'success' })),
    }] }],
  ]);
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    assert.ok(routes.has(path), `Unexpected API route: ${path}`);
    const value = routes.get(path);
    return structuredClone(typeof value === 'function' ? value() : value);
  };
  const context = {
    GITHUB_REPOSITORY: 'castiqnl/platform', GITHUB_REPOSITORY_ID: '1446413160',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: WORKFLOW_SHA, GITHUB_RUN_ID: '700', GITHUB_RUN_ATTEMPT: '1',
  };
  const input = { sha: SHA, configId: CONFIG, action, context, api };
  return { input, paths, routes, calls, ciRun, dispatchRun };
}

async function refused(f, code) {
  await assert.rejects(() => admitRelease(f.input), (error) => {
    assert.ok(error instanceof AdmissionError);
    assert.equal(error.code, code);
    return true;
  });
}

test('reviewed CI source digest matches the real acceptance workflow', () => {
  assert.equal(createHash('sha256').update(SOURCE).digest('hex'), RELEASE_POLICY.ci.sourceSha256);
});

test('admits exact main SHA with successful latest push CI and binds the manual request', async () => {
  for (const action of ['build', 'activate']) {
    const f = fixture(action);
    const metadata = await admitRelease(f.input);
    assert.deepEqual(metadata, {
      repository: 'castiqnl/platform', sha: SHA, configId: CONFIG, action,
      ciRunId: 800, ciRunAttempt: 2, requestRunId: 700, requestRunAttempt: 1,
    });
    assert.ok(Object.isFrozen(metadata));
    assert.equal(f.calls.filter((path) => path === f.paths.ciRun).length, 2);
    assert.equal(f.calls.filter((path) => path === f.paths.dispatchRun).length, 2);
    assert.equal(f.calls.filter((path) => path === f.paths.comparison).length, 2);
  }
});

test('rejects ambiguous revisions, injected config IDs and unconfigured actions before API access', async () => {
  for (const sha of ['main', SHA.slice(0, 7), SHA.toUpperCase().replace('1', 'A'), ` ${SHA}`, `${SHA}\n`]) {
    const f = fixture();
    f.input.sha = sha;
    await refused(f, 'full-lowercase-commit-sha-required');
    assert.equal(f.calls.length, 0);
  }
  for (const configId of ['', 'latest', 'A'.repeat(64), CONFIG.slice(1), `${CONFIG}\n`]) {
    const f = fixture(); f.input.configId = configId;
    await refused(f, 'invalid-config-id');
    assert.equal(f.calls.length, 0);
  }
  for (const action of ['deploy', 'rollback', 'constructor', '__proto__', undefined]) {
    const f = fixture(); f.input.action = action;
    await refused(f, 'unsupported-action');
  }
});

test('requires the correct repository, manual event, main ref and valid immutable workflow context', async () => {
  const variants = [
    ['GITHUB_REPOSITORY', 'attacker/platform', 'wrong-dispatch-repository'],
    ['GITHUB_REPOSITORY_ID', '1446413161', 'wrong-dispatch-repository-id'],
    ['GITHUB_EVENT_NAME', 'pull_request', 'manual-dispatch-required'],
    ['GITHUB_EVENT_NAME', 'push', 'manual-dispatch-required'],
    ['GITHUB_REF', 'refs/heads/codex/preparation', 'dispatch-must-use-main'],
    ['GITHUB_REF', 'refs/tags/main', 'dispatch-must-use-main'],
    ['GITHUB_SHA', 'main', 'invalid-dispatch-source-sha'],
    ['GITHUB_RUN_ID', '1;whoami', 'invalid-dispatch-run-id'],
    ['GITHUB_RUN_ID', '9007199254740993', 'invalid-dispatch-run-id'],
    ['GITHUB_RUN_ATTEMPT', '0', 'invalid-dispatch-run-attempt'],
  ];
  for (const [key, value, code] of variants) {
    const f = fixture(); f.input.context[key] = value;
    await refused(f, code);
    assert.equal(f.calls.length, 0);
  }
});

test('refuses a renamed/recreated repository and invalid main reference', async () => {
  for (const value of [
    { ...REPOSITORY, id: 42, default_branch: 'main' },
    { ...REPOSITORY, full_name: 'castiqnl/renamed', default_branch: 'main' },
    { ...REPOSITORY, default_branch: 'develop' },
  ]) {
    const f = fixture(); f.routes.set(f.paths.repository, value);
    await refused(f, 'repository-identity-mismatch');
  }
  const f = fixture(); f.routes.set(f.paths.main, { name: 'main', commit: { sha: 'main' } });
  await refused(f, 'invalid-main-reference');
});

test('requires both the candidate and the dispatch workflow source to belong to main', async () => {
  for (const kind of ['comparison', 'workflowComparison']) {
    for (const change of [
      { status: 'behind' }, { status: 'diverged' },
      { base_commit: { sha: MAIN_SHA } }, { merge_base_commit: { sha: 'f'.repeat(40) } },
    ]) {
      const f = fixture();
      f.routes.set(f.paths[kind], { ...f.routes.get(f.paths[kind]), ...change });
      await refused(f, 'commit-is-not-on-main');
    }
  }
  const f = fixture();
  f.routes.set(f.paths.comparison, { status: 'identical', base_commit: { sha: SHA }, merge_base_commit: { sha: SHA } });
  await admitRelease(f.input);
});

test('rejects same-name dispatch workflows from another path, disabled workflows and forged run provenance', async () => {
  for (const change of [{ path: '.github/workflows/forged.yml' }, { name: 'Other workflow' }, { state: 'disabled_manually' }]) {
    const f = fixture(); f.routes.set(f.paths.dispatch, { ...f.routes.get(f.paths.dispatch), ...change });
    await refused(f, 'dispatch-workflow-mismatch');
  }
  for (const change of [
    { workflow_id: 991 }, { event: 'pull_request' }, { head_branch: 'review' },
    { repository: { ...REPOSITORY, id: 42 } }, { head_repository: { ...REPOSITORY, full_name: 'attacker/platform' } },
    { head_sha: SHA }, { path: '.github/workflows/forged.yml' }, { name: 'Other workflow' },
  ]) {
    const f = fixture(); f.routes.set(f.paths.dispatchRun, { ...f.dispatchRun, ...change });
    await refused(f, 'dispatch-run-provenance-mismatch');
  }
});

test('binds the requested SHA to GitHub stored run-name and refuses replayed or stale manual runs', async () => {
  for (const change of [
    { id: 701 }, { run_attempt: 2 }, { status: 'completed', conclusion: 'success' },
    { status: 'queued' }, { conclusion: 'cancelled' },
  ]) {
    const f = fixture(); f.routes.set(f.paths.dispatchRun, { ...f.dispatchRun, ...change });
    await refused(f, 'dispatch-run-not-current');
  }
  for (const title of [`Castiq staging build ${MAIN_SHA}`, `Castiq staging activate ${SHA}`, `Castiq staging build ${SHA} extra`]) {
    const f = fixture(); f.routes.set(f.paths.dispatchRun, { ...f.dispatchRun, display_title: title });
    await refused(f, 'dispatch-input-sha-mismatch');
  }
});

test('pins the real CI workflow identity and exact reviewed source bytes', async () => {
  for (const change of [{ id: 42 }, { name: 'Forged acceptance' }, { path: '.github/workflows/forged.yml' }, { state: 'disabled_inactivity' }]) {
    const f = fixture(); f.routes.set(f.paths.ci, { ...f.routes.get(f.paths.ci), ...change });
    await refused(f, 'ci-workflow-mismatch');
  }
  const f = fixture();
  f.routes.set(f.paths.source, { ...f.routes.get(f.paths.source), content: Buffer.from('name: Castiq local acceptance\njobs: {}\n').toString('base64') });
  await refused(f, 'ci-source-policy-mismatch');
  const unavailable = fixture();
  unavailable.routes.set(unavailable.paths.source, { ...unavailable.routes.get(unavailable.paths.source), encoding: 'none' });
  await refused(unavailable, 'ci-source-unavailable');
});

test('rejects missing/truncated CI histories and pull request or foreign-branch success with the same name', async () => {
  for (const value of [undefined, { total_count: 0, workflow_runs: [] }, { total_count: 2, workflow_runs: [] }, { total_count: 101, workflow_runs: [] }]) {
    const f = fixture(); f.routes.set(f.paths.runs, value);
    await refused(f, 'ci-runs-missing-or-incomplete');
  }
  for (const change of [
    { workflow_id: 42 }, { event: 'pull_request' }, { head_branch: 'codex/preparation' },
    { head_sha: MAIN_SHA }, { head_repository: { id: 42, full_name: 'attacker/platform' } },
    { path: '.github/workflows/forged.yml' }, { run_number: undefined },
  ]) {
    const f = fixture(); f.routes.set(f.paths.runs, { total_count: 1, workflow_runs: [{ ...f.ciRun, ...change }] });
    await refused(f, 'ci-run-provenance-mismatch');
  }
});

test('does not fall back to older passing CI when the newest run failed, skipped, pending or cancelled', async () => {
  for (const [status, conclusion] of [
    ['completed', 'failure'], ['completed', 'skipped'], ['completed', 'cancelled'],
    ['completed', 'neutral'], ['completed', 'timed_out'], ['completed', 'action_required'],
    ['in_progress', null], ['queued', null], ['requested', null], ['waiting', null],
  ]) {
    const f = fixture();
    f.routes.set(f.paths.runs, { total_count: 2, workflow_runs: [
      f.ciRun, { ...f.ciRun, id: 801, run_number: 5, status, conclusion },
    ] });
    await refused(f, 'latest-ci-run-not-successful');
  }
});

test('requires the current CI run attempt, successful required job and every actual acceptance step', async () => {
  for (const change of [{ run_attempt: 3 }, { head_sha: MAIN_SHA }, { event: 'pull_request' }, { id: 801 }]) {
    const f = fixture(); f.routes.set(f.paths.ciRun, { ...f.ciRun, ...change });
    await refused(f, 'ci-run-changed');
  }
  for (const [status, conclusion] of [['in_progress', null], ['completed', 'skipped'], ['completed', 'cancelled'], ['completed', 'failure']]) {
    const f = fixture(); f.routes.set(f.paths.ciRun, { ...f.ciRun, status, conclusion });
    await refused(f, 'ci-run-not-successful');
    const j = fixture();
    const jobs = j.routes.get(j.paths.jobs); jobs.jobs[0].status = status; jobs.jobs[0].conclusion = conclusion;
    await refused(j, 'required-ci-job-not-successful');
  }
  for (const count of [0, 2]) {
    const f = fixture(); f.routes.set(f.paths.jobs, { total_count: count, jobs: [] });
    await refused(f, 'required-ci-job-missing-or-unexpected');
  }
  for (const change of [{ name: 'forged-verify' }, { run_attempt: 1 }, { run_id: 801 }, { head_sha: MAIN_SHA }]) {
    const f = fixture(); Object.assign(f.routes.get(f.paths.jobs).jobs[0], change);
    await refused(f, 'required-ci-job-not-successful');
  }
  for (const name of RELEASE_POLICY.ci.steps) {
    for (const mode of ['missing', 'skipped', 'duplicate', 'pending']) {
      const f = fixture(); const job = f.routes.get(f.paths.jobs).jobs[0];
      if (mode === 'missing') job.steps = job.steps.filter((step) => step.name !== name);
      else if (mode === 'duplicate') job.steps.push({ name, status: 'completed', conclusion: 'success' });
      else Object.assign(job.steps.find((step) => step.name === name), mode === 'pending'
        ? { status: 'queued', conclusion: null } : { status: 'completed', conclusion: 'skipped' });
      await refused(f, 'required-ci-step-not-successful');
    }
  }
});

test('catches CI reruns, finished dispatches and force-pushed main during admission', async () => {
  const ci = fixture(); let ciReads = 0;
  ci.routes.set(ci.paths.ciRun, () => (++ciReads === 1 ? ci.ciRun : { ...ci.ciRun, run_attempt: 3, status: 'queued', conclusion: null }));
  await refused(ci, 'ci-run-changed');
  const newest = fixture(); let listReads = 0;
  newest.routes.set(newest.paths.runs, () => ({ total_count: ++listReads === 1 ? 1 : 2,
    workflow_runs: listReads === 1 ? [newest.ciRun] : [newest.ciRun,
      { ...newest.ciRun, id: 801, run_number: 5, status: 'queued', conclusion: null }],
  }));
  await refused(newest, 'latest-ci-run-not-successful');
  const dispatch = fixture(); let dispatchReads = 0;
  dispatch.routes.set(dispatch.paths.dispatchRun, () => (++dispatchReads === 1 ? dispatch.dispatchRun : { ...dispatch.dispatchRun, status: 'completed', conclusion: 'cancelled' }));
  await refused(dispatch, 'dispatch-run-not-current');
  const branch = fixture(); let comparisons = 0;
  branch.routes.set(branch.paths.comparison, () => (++comparisons === 1
    ? { status: 'ahead', base_commit: { sha: SHA }, merge_base_commit: { sha: SHA } }
    : { status: 'diverged', base_commit: { sha: SHA }, merge_base_commit: { sha: 'f'.repeat(40) } }));
  await refused(branch, 'commit-is-not-on-main');
});

test('GitHub client permits only GET to the configured repository, with sanitized API errors', async () => {
  const originalFetch = globalThis.fetch;
  const token = 'fixture-token-never-log';
  try {
    const api = createGitHubApi(token);
    let requests = 0;
    globalThis.fetch = async (url, options) => {
      requests += 1;
      assert.equal(url, `https://api.github.com${PREFIX}`);
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, `Bearer ${token}`);
      return new Response(JSON.stringify({ id: 1446413160 }), { status: 200 });
    };
    assert.deepEqual(await api(PREFIX), { id: 1446413160 });
    await assert.rejects(() => api('/repos/attacker/platform'), /unexpected-api-path/);
    assert.equal(requests, 1);
    globalThis.fetch = async () => new Response(token, { status: 403 });
    await assert.rejects(() => api(PREFIX), (error) => error.code === 'github-api-http-403' && !error.message.includes(token));
    globalThis.fetch = async () => { throw new Error(token); };
    await assert.rejects(() => api(PREFIX), (error) => error.code === 'github-api-unavailable' && !error.message.includes(token));
    globalThis.fetch = async () => new Response(token, { status: 200 });
    await assert.rejects(() => api(PREFIX), (error) => error.code === 'github-api-invalid-response' && !error.message.includes(token));
  } finally {
    globalThis.fetch = originalFetch;
  }
  for (const token of [undefined, '', 'token\nheader']) assert.throws(() => createGitHubApi(token), /github-token-required/);
});
