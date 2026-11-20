import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// This is a reviewed release policy, not configuration supplied by a runner.
// Update the CI digest deliberately when the acceptance workflow changes.
export const RELEASE_POLICY = Object.freeze({
  repository: 'castiqnl/platform',
  repositoryId: 1446413160,
  branch: 'main',
  ci: Object.freeze({
    id: 407607093,
    name: 'Castiq local acceptance',
    path: '.github/workflows/ci.yml',
    sourceSha256: 'ad49893634cfa254413be813157c692a506fb5b93c6dbd0e6730cb3b3f5ae331',
    job: 'verify',
    steps: Object.freeze([
      'Run npm ci',
      'Run npm run config:check',
      'Run npm run check',
      'Run npm test',
      'Run npm run test:release',
      'Run npm run test:server',
      'Run npm run verify:assets',
      'Run npm run build',
      'Run npm run db:migrate',
      'Run npm run db:seed',
      'Run npx playwright install --with-deps chromium',
      'Run npm run test:browser',
    ]),
  }),
  dispatch: Object.freeze({
    build: Object.freeze({
      name: 'Castiq dg-vps-08 staging candidate',
      path: '.github/workflows/castiq-dg-vps-08-staging-build.yml',
    }),
    activate: Object.freeze({
      name: 'Castiq dg-vps-08 staging activate',
      path: '.github/workflows/castiq-dg-vps-08-staging-activate.yml',
    }),
  }),
});

export class AdmissionError extends Error {
  constructor(code) {
    super(`Release admission refused: ${code}`);
    this.name = 'AdmissionError';
    this.code = code;
  }
}

function requireCondition(condition, code) {
  if (!condition) throw new AdmissionError(code);
}

function positiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function contextInteger(value, code) {
  requireCondition(typeof value === 'string' && /^[1-9][0-9]*$/.test(value), code);
  const parsed = Number(value);
  requireCondition(positiveInteger(parsed), code);
  return parsed;
}

function fullSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function repositoryMatches(value) {
  return value?.id === RELEASE_POLICY.repositoryId
    && value.full_name === RELEASE_POLICY.repository;
}

function workflowMatches(workflow, expected) {
  return positiveInteger(workflow?.id)
    && (expected.id === undefined || workflow.id === expected.id)
    && workflow.name === expected.name
    && workflow.path === expected.path
    && workflow.state === 'active';
}

function runMatches(run, workflow, event, sha) {
  return positiveInteger(run?.id)
    && positiveInteger(run.run_attempt)
    && run.workflow_id === workflow.id
    && run.name === workflow.name
    && run.path === workflow.path
    && run.event === event
    && run.head_branch === RELEASE_POLICY.branch
    && run.head_sha === sha
    && repositoryMatches(run.repository)
    && repositoryMatches(run.head_repository);
}

function completedSuccessfully(value) {
  return value?.status === 'completed' && value.conclusion === 'success';
}

function latestSuccessfulCi(listed, workflow, sha) {
  requireCondition(Array.isArray(listed?.workflow_runs)
    && Number.isSafeInteger(listed.total_count)
    && listed.total_count > 0
    && listed.total_count <= 100
    && listed.workflow_runs.length === listed.total_count, 'ci-runs-missing-or-incomplete');
  for (const run of listed.workflow_runs) {
    requireCondition(runMatches(run, workflow, 'push', sha)
      && positiveInteger(run.run_number), 'ci-run-provenance-mismatch');
  }
  requireCondition(new Set(listed.workflow_runs.map((run) => run.id)).size === listed.total_count, 'ci-runs-missing-or-incomplete');
  const latest = [...listed.workflow_runs].sort((a, b) => b.run_number - a.run_number || b.id - a.id)[0];
  requireCondition(completedSuccessfully(latest), 'latest-ci-run-not-successful');
  return latest;
}

async function requireAncestor(api, sha, mainSha) {
  const comparison = await api(`/repos/${RELEASE_POLICY.repository}/compare/${sha}...${mainSha}`);
  requireCondition(
    (comparison?.status === 'ahead' || comparison?.status === 'identical')
      && comparison.base_commit?.sha === sha
      && comparison.merge_base_commit?.sha === sha,
    'commit-is-not-on-main',
  );
}

/**
 * Read-only admission. The API function is injected so the full policy can be
 * exercised without a GitHub account, runner, database, or external side effect.
 */
export async function admitRelease({ sha, configId, action, context, api }) {
  requireCondition(fullSha(sha), 'full-lowercase-commit-sha-required');
  requireCondition(typeof configId === 'string' && /^[a-f0-9]{64}$/.test(configId), 'invalid-config-id');
  requireCondition(Object.hasOwn(RELEASE_POLICY.dispatch, action), 'unsupported-action');
  requireCondition(typeof api === 'function', 'github-api-required');
  requireCondition(context?.GITHUB_REPOSITORY === RELEASE_POLICY.repository, 'wrong-dispatch-repository');
  requireCondition(context.GITHUB_REPOSITORY_ID === String(RELEASE_POLICY.repositoryId), 'wrong-dispatch-repository-id');
  requireCondition(context.GITHUB_EVENT_NAME === 'workflow_dispatch', 'manual-dispatch-required');
  requireCondition(context.GITHUB_REF === `refs/heads/${RELEASE_POLICY.branch}`, 'dispatch-must-use-main');
  requireCondition(fullSha(context.GITHUB_SHA), 'invalid-dispatch-source-sha');
  const requestRunId = contextInteger(context.GITHUB_RUN_ID, 'invalid-dispatch-run-id');
  const requestRunAttempt = contextInteger(context.GITHUB_RUN_ATTEMPT, 'invalid-dispatch-run-attempt');
  const prefix = `/repos/${RELEASE_POLICY.repository}`;

  const repository = await api(prefix);
  requireCondition(repositoryMatches(repository) && repository.default_branch === RELEASE_POLICY.branch, 'repository-identity-mismatch');
  const main = await api(`${prefix}/branches/${RELEASE_POLICY.branch}`);
  requireCondition(main?.name === RELEASE_POLICY.branch && fullSha(main.commit?.sha), 'invalid-main-reference');
  await requireAncestor(api, sha, main.commit.sha);
  if (context.GITHUB_SHA !== sha) await requireAncestor(api, context.GITHUB_SHA, main.commit.sha);

  const dispatchPolicy = RELEASE_POLICY.dispatch[action];
  const dispatchFile = dispatchPolicy.path.split('/').at(-1);
  const dispatchWorkflow = await api(`${prefix}/actions/workflows/${dispatchFile}`);
  requireCondition(workflowMatches(dispatchWorkflow, dispatchPolicy), 'dispatch-workflow-mismatch');
  const requestRun = await api(`${prefix}/actions/runs/${requestRunId}`);
  requireCondition(runMatches(requestRun, dispatchWorkflow, 'workflow_dispatch', context.GITHUB_SHA), 'dispatch-run-provenance-mismatch');
  requireCondition(requestRun.id === requestRunId
    && requestRun.run_attempt === requestRunAttempt
    && requestRun.status === 'in_progress'
    && requestRun.conclusion === null, 'dispatch-run-not-current');
  // run-name is derived only from workflow inputs. Unlike runner-provided
  // environment variables, GitHub's stored display_title binds the requested SHA.
  requireCondition(requestRun.display_title === `Castiq staging ${action} ${sha}`, 'dispatch-input-sha-mismatch');

  const ciWorkflow = await api(`${prefix}/actions/workflows/ci.yml`);
  requireCondition(workflowMatches(ciWorkflow, RELEASE_POLICY.ci), 'ci-workflow-mismatch');
  const source = await api(`${prefix}/contents/${RELEASE_POLICY.ci.path}?ref=${sha}`);
  requireCondition(source?.type === 'file' && source.path === RELEASE_POLICY.ci.path
    && source.encoding === 'base64' && typeof source.content === 'string'
    && source.content.length < 100_000, 'ci-source-unavailable');
  const sourceHash = createHash('sha256').update(Buffer.from(source.content, 'base64')).digest('hex');
  requireCondition(sourceHash === RELEASE_POLICY.ci.sourceSha256, 'ci-source-policy-mismatch');

  const runsPath = `${prefix}/actions/workflows/${RELEASE_POLICY.ci.id}/runs?head_sha=${sha}&event=push&branch=main&per_page=100`;
  const latest = latestSuccessfulCi(await api(runsPath), ciWorkflow, sha);
  const ciRun = await api(`${prefix}/actions/runs/${latest.id}`);
  requireCondition(runMatches(ciRun, ciWorkflow, 'push', sha)
    && ciRun.id === latest.id
    && ciRun.run_number === latest.run_number
    && ciRun.run_attempt === latest.run_attempt, 'ci-run-changed');
  requireCondition(completedSuccessfully(ciRun), 'ci-run-not-successful');

  const jobs = await api(`${prefix}/actions/runs/${ciRun.id}/attempts/${ciRun.run_attempt}/jobs?per_page=100`);
  requireCondition(jobs?.total_count === 1 && Array.isArray(jobs.jobs) && jobs.jobs.length === 1, 'required-ci-job-missing-or-unexpected');
  const job = jobs.jobs[0];
  requireCondition(job.name === RELEASE_POLICY.ci.job && job.run_id === ciRun.id
    && job.head_sha === sha && job.run_attempt === ciRun.run_attempt
    && completedSuccessfully(job), 'required-ci-job-not-successful');
  requireCondition(Array.isArray(job.steps), 'required-ci-steps-missing');
  for (const name of RELEASE_POLICY.ci.steps) {
    const matching = job.steps.filter((step) => step.name === name);
    requireCondition(matching.length === 1 && completedSuccessfully(matching[0]), 'required-ci-step-not-successful');
  }
  // A rerun or branch movement during admission must not silently change the
  // revision/attempt we just verified. Publication/activation happens elsewhere.
  const finalRun = await api(`${prefix}/actions/runs/${ciRun.id}`);
  requireCondition(runMatches(finalRun, ciWorkflow, 'push', sha)
    && finalRun.id === ciRun.id && finalRun.run_attempt === ciRun.run_attempt
    && completedSuccessfully(finalRun), 'ci-run-changed');
  const finalLatest = latestSuccessfulCi(await api(runsPath), ciWorkflow, sha);
  requireCondition(finalLatest.id === ciRun.id && finalLatest.run_attempt === ciRun.run_attempt, 'ci-run-changed');
  const finalRequest = await api(`${prefix}/actions/runs/${requestRunId}`);
  requireCondition(runMatches(finalRequest, dispatchWorkflow, 'workflow_dispatch', context.GITHUB_SHA)
    && finalRequest.id === requestRunId && finalRequest.run_attempt === requestRunAttempt
    && finalRequest.status === 'in_progress' && finalRequest.conclusion === null
    && finalRequest.display_title === `Castiq staging ${action} ${sha}`, 'dispatch-run-not-current');
  const finalMain = await api(`${prefix}/branches/${RELEASE_POLICY.branch}`);
  requireCondition(finalMain?.name === RELEASE_POLICY.branch && fullSha(finalMain.commit?.sha), 'invalid-main-reference');
  await requireAncestor(api, sha, finalMain.commit.sha);

  return Object.freeze({
    repository: RELEASE_POLICY.repository,
    sha,
    configId,
    action,
    ciRunId: ciRun.id,
    ciRunAttempt: ciRun.run_attempt,
    requestRunId,
    requestRunAttempt,
  });
}

export function createGitHubApi(token) {
  requireCondition(typeof token === 'string' && token.length > 0 && !/[\r\n]/.test(token), 'github-token-required');
  return async (path) => {
    requireCondition(path === `/repos/${RELEASE_POLICY.repository}`
      || path.startsWith(`/repos/${RELEASE_POLICY.repository}/`), 'unexpected-api-path');
    let response;
    try {
      response = await fetch(`https://api.github.com${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'X-GitHub-Api-Version': '2026-03-10',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new AdmissionError('github-api-unavailable');
    }
    requireCondition(response.ok, `github-api-http-${response.status}`);
    try {
      const body = await response.text();
      requireCondition(body.length <= 2_000_000, 'github-api-response-too-large');
      return JSON.parse(body);
    } catch (error) {
      if (error instanceof AdmissionError) throw error;
      throw new AdmissionError('github-api-invalid-response');
    }
  };
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};
  requireCondition(args.length > 0 && args.length % 2 === 0, 'expected-sha-config-id-action-output-options');
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    requireCondition(['--sha', '--config-id', '--action', '--output'].includes(key)
      && !Object.hasOwn(options, key) && typeof args[index + 1] === 'string', 'invalid-command-options');
    options[key] = args[index + 1];
  }
  const metadata = await admitRelease({
    sha: options['--sha'],
    configId: options['--config-id'],
    action: options['--action'],
    context: process.env,
    api: createGitHubApi(process.env.GITHUB_TOKEN),
  });
  const json = `${JSON.stringify(metadata)}\n`;
  if (options['--output']) await writeFile(options['--output'], json, { flag: 'wx', mode: 0o600 });
  process.stdout.write(json);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Never print API bodies, fetch errors, environment values, or token headers.
    process.stderr.write(`${error instanceof AdmissionError ? error.message : 'Release admission failed: local-output-error'}\n`);
    process.exitCode = 1;
  });
}
