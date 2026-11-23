import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {migrate} from '../database/migrate.ts';
import {seedFixtures, fixtureAccounts} from '../server/fixtures.ts';
import {platformPlanOverview, savePlanPolicy, saveClubPlan, clubPlanOverview} from '../server/clubPlans.ts';

let admin: pg.Pool, pool: pg.Pool, database: string;
const platform = fixtureAccounts.find(actor => actor.role === 'platform')!;
const club = fixtureAccounts.find(actor => actor.id === 'getijde-club')!;
const team = fixtureAccounts.find(actor => actor.id === 'getijde-team')!;
before(async () => {
  const connection = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!connection) throw new Error('Een geïsoleerde lokale testdatabase is verplicht.');
  const url = new URL(connection);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Pakkettests gebruiken uitsluitend localhost.');
  admin = new pg.Pool({connectionString: connection});
  database = 'castiq_plan_completion_' + randomUUID().replaceAll('-', '');
  await admin.query(`CREATE DATABASE ${database}`);
  url.pathname = '/' + database;
  pool = new pg.Pool({connectionString: url.href, max: 1});
  await migrate(pool); await seedFixtures(pool);
});
after(async () => {
  if (pool) await pool.end();
  if (admin) {try {if (database) await admin.query(`DROP DATABASE IF EXISTS ${database}`);} finally {await admin.end();}}
});

test('club status counts only eligible memberships and keeps trial metadata separate from billing', async () => {
  await pool.query("UPDATE castiq.memberships SET active=false WHERE club_id='cl2'");
  await pool.query("INSERT INTO castiq.memberships(actor_id,club_id,actor_name,role,expires_at) VALUES('expired-plan-owner','cl2','Expired','club',now()-interval '1 second'),('blocked-plan-owner','cl2','Blocked','club',NULL),('inactive-plan-owner','cl2','Inactive','club',NULL),('platform-plan-owner','cl2','Platform','club',NULL),('platform-plan-owner','__platform__','Platform','platform',NULL)");
  await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,email,status) VALUES('blocked-plan-owner','synthetic-blocked@example.invalid','deletion_pending')");
  await pool.query("UPDATE castiq.workspaces SET state=jsonb_set(jsonb_set(state,'{club,trial}','true'),'{club,status}','\"Actief\"') WHERE club_id='cl2'");
  await pool.query("UPDATE castiq.workspaces SET state=state #- '{club,trial}' WHERE club_id='cl3'");
  await pool.query("INSERT INTO castiq.privacy_accounts(actor_id,status,reliable_activity,last_conscious_at) VALUES('inactive-plan-owner','active',true,now()-interval '91 days')");
  const result = await platformPlanOverview(pool, platform);
  assert.equal(result.clubs.length, 3);
  const active = result.clubs.find(value => value.id === 'cl1')!;
  assert.equal(active.status, 'active'); assert.equal(active.hasClubManager, true); assert.equal(active.members, 3); assert.equal(active.trial, false);
  const setup = result.clubs.find(value => value.id === 'cl2')!;
  assert.equal(setup.status, 'setup'); assert.equal(setup.members, 0); assert.equal(setup.hasClubManager, false); assert.equal(setup.trial, true);
  assert.equal(result.clubs.find(value => value.id === 'cl3')!.trial, null);
  assert.equal(result.policy.billingActivated, false);
  assert.equal(JSON.stringify(result).includes('synthetic-blocked@example.invalid'), false);
  await assert.rejects(platformPlanOverview(pool, club), (error: any) => error.status === 403);
  await assert.rejects(clubPlanOverview(pool, team), (error: any) => error.status === 403);
});

test('central price saves with a one-connection pool, detects stale policies and preserves earlier event snapshots', {timeout: 10000}, async () => {
  const initial = await platformPlanOverview(pool, platform);
  const input = {expectedVersion: initial.policy.version, discountPercent: 10, plans: initial.policy.plans.map(plan => plan.name === 'Start' ? {...plan, baseCents: 3901} : plan)};
  const concurrent = await Promise.allSettled([savePlanPolicy(pool, platform, input), savePlanPolicy(pool, platform, input)]);
  assert.equal(concurrent.filter(value => value.status === 'fulfilled').length, 1);
  const failure = concurrent.find(value => value.status === 'rejected') as PromiseRejectedResult;
  assert.equal(failure.reason.status, 409);
  const current = await platformPlanOverview(pool, platform);
  assert.equal(current.policy.version, initial.policy.version + 1);
  const event = (await pool.query("SELECT snapshot FROM castiq.plan_events WHERE action='policy.published'")).rows[0].snapshot;
  assert.equal(event.plans.find((plan: any) => plan.name === 'Start').baseCents, 3901);
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM castiq.plan_policies')).rows[0].count, 2);
});

test('club choices preserve authoritative integer prices, enforce team capacity and resolve compare-and-swap conflicts', {timeout: 10000}, async () => {
  const initial = await clubPlanOverview(pool, club);
  const saved = await saveClubPlan(pool, club, {plan: 'Start', optedIn: true, expectedVersion: initial.snapshot.choiceVersion, expectedPolicyVersion: initial.policy.version, netCents: 1});
  assert.equal(saved.snapshot.baseCents, 3901); assert.equal(saved.snapshot.savingsCents, 390); assert.equal(saved.snapshot.netCents, 3511);
  await assert.rejects(saveClubPlan(pool, club, {plan: 'Pro', optedIn: false, expectedVersion: initial.snapshot.choiceVersion, expectedPolicyVersion: initial.policy.version}), (error: any) => error.status === 409);
  await pool.query("UPDATE castiq.workspaces SET state=jsonb_set(state,'{teams}',$1::jsonb) WHERE club_id='cl1'", [JSON.stringify(Array.from({length: 6}, (_, index) => ({name: 'Synthetic ' + index, active: true})))]);
  await assert.rejects(saveClubPlan(pool, club, {plan: 'Start', optedIn: false, expectedVersion: saved.snapshot.choiceVersion, expectedPolicyVersion: saved.policy.version}), (error: any) => error.status === 400);
  const unchanged = await clubPlanOverview(pool, club);
  assert.equal(unchanged.snapshot.choiceVersion, saved.snapshot.choiceVersion);
  const free = await saveClubPlan(pool, club, {plan: 'Gratis', optedIn: false, expectedVersion: saved.snapshot.choiceVersion, expectedPolicyVersion: saved.policy.version});
  assert.equal(free.snapshot.netCents, 0); assert.equal(free.snapshot.required, true); assert.equal(free.snapshot.partnerLogo, true); assert.equal(free.snapshot.billingStatus, 'not_activated');
});
