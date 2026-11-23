import {defaultMailTemplates, supabaseTemplateConfiguration, validateMailTemplate} from '../server/mailTemplates';
import {LEGAL_DOCUMENTS} from '../shared/legalDocuments';
import type {AccountIdentity, Actor, LegalStatus, LocalAccount, WorkspaceEnvelope} from './serverClient';
import type {AppState, Role} from './store';

type Club = {id: string; name: string; version: number; members: number};
type Account = {id: string; email: string; status: string; registeredAt: string; isPlatform: boolean};
type PrivacyCase = {
  id: string;
  kind: string;
  status: 'new' | 'in_progress' | 'closed';
  received_at: string;
  due_at: string;
  initial_due_at: string;
  assigned_to: string | null;
  controller_club_id: string | null;
  closed_at: string | null;
  outcome: string | null;
  extended_at: string | null;
  extension_requested_at: string | null;
  extension_reason: string | null;
};

const actorIds: Record<Role, string> = {club: 'demo-club-admin', team: 'demo-team-manager', platform: 'demo-platform-admin'};
const actorNames: Record<Role, string> = {club: 'Timo van Leeuwen', team: 'Sam de Wit', platform: 'Castiq demo-beheerder'};
const actorEmails: Record<Role, string> = {club: 'timo@scgetijde.example', team: 'sam@scgetijde.example', platform: 'beheer@castiq.example'};
const storageKey = 'castiq-platform-example-v1';

function iso(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function currentRole(): Role {
  const role = typeof location !== 'undefined' ? location.hash.replace(/^#\/?/, '').split('/')[0] : 'club';
  return role === 'platform' || role === 'team' ? role : 'club';
}

const accountFor = (role: Role): Account => ({
  id: actorIds[role], email: actorEmails[role], status: 'active', registeredAt: iso(-21), isPlatform: role === 'platform',
});

const makeCase = (id: string, kind: string, received: number, deadline: number, closed = false): PrivacyCase => ({
  id, kind, status: closed ? 'closed' : 'new',
  received_at: iso(received), due_at: iso(deadline), initial_due_at: iso(deadline),
  assigned_to: closed ? actorIds.platform : null, controller_club_id: null,
  closed_at: closed ? iso(received + 3) : null, outcome: closed ? 'fulfilled' : null,
  extended_at: null, extension_requested_at: null, extension_reason: null,
});

function initialFixtures() {
  return {
    clubs: [
      {id: 'cl1', name: 'SC Getijde', version: 12, members: 4},
      {id: 'cl2', name: 'FC Havenlicht', version: 5, members: 2},
      {id: 'cl3', name: 'SV Noordhaven', version: 1, members: 1},
    ] as Club[],
    assignments: ['cl1:demo-club-admin', 'cl1:demo-team-manager'],
    accounts: [accountFor('club'), accountFor('team'), accountFor('platform'), {
      id: 'demo-pending', email: 'registratie@voorbeeldclub.example', status: 'registration_pending', registeredAt: iso(-4), isPlatform: false,
    }],
    cases: [makeCase('DEMO-1003', 'access', -6, 24), makeCase('DEMO-1002', 'rectification', -10, 20), makeCase('DEMO-1001', 'erasure', -18, 12, true)],
    mail: {
      configuration: {
        version: 1, fromEmail: 'berichten@castiq.example', fromName: 'Castiq', replyTo: 'beheer@castiq.example',
        apiKeyConfigured: true, webhookConfigured: false, encryptionReady: true,
      },
      templates: structuredClone(defaultMailTemplates),
      outbox: [{status: 'unconfirmed', count: 1}],
      deliveryProof: 'Voorbeeldstatus voor deze demonstratie. Er worden geen berichten verzonden of afgeleverd.',
    },
    deletedAccounts: [] as string[],
    clubAgreements: ['cl1'],
  };
}

type Fixtures = ReturnType<typeof initialFixtures>;

function readFixtures(): Fixtures {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) return {...initialFixtures(), ...JSON.parse(saved)};
  } catch {
    // The prototype still works in memory when browser storage is unavailable.
  }
  return initialFixtures();
}

let fixtures = readFixtures();
let previewClubId = 'cl1';

function saveFixtures() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(fixtures));
  } catch {
    // Updates remain available during the current visit.
  }
}

export function demoSession(club: Pick<AppState['club'], 'id' | 'name'>, role: Role = currentRole()) {
  previewClubId = club.id;
  const actor: Actor = {
    id: actorIds[role], name: actorNames[role], role,
    clubId: role === 'platform' ? 'platform' : club.id,
    ...(role === 'team' ? {team: 'O14-1'} : {}),
  };
  const accountDeleted = fixtures.deletedAccounts.includes(actor.id);
  const identity: AccountIdentity = {
    id: actor.id, email: actorEmails[role], status: accountDeleted ? 'deletion_pending' : 'active',
    deadline: accountDeleted ? iso(30) : null, registeredAt: iso(-21), lastConsciousAt: iso(),
  };
  const memberships: LocalAccount[] = [{...actor, clubName: role === 'platform' ? 'Castiq Platform' : club.name}];
  const documents = Object.entries(LEGAL_DOCUMENTS).map(([kind, document]) => ({...document, kind}));
  const acceptance = (kind: keyof typeof LEGAL_DOCUMENTS, scope: 'personal' | 'club') => ({
    kind, scope, version: LEGAL_DOCUMENTS[kind].version, sha256: LEGAL_DOCUMENTS[kind].sha256,
    club_id: scope === 'club' ? actor.clubId : null, accepted_at: iso(-15),
  });
  const legal: LegalStatus = {documents, acceptances: [acceptance('terms', 'personal')]};
  if (role === 'club' && fixtures.clubAgreements.includes(actor.clubId)) {
    legal.acceptances.push(acceptance('terms', 'club'), acceptance('processor', 'club'));
  }
  return {actor, identity, memberships, legal};
}

function parseBody(options: RequestInit): Record<string, unknown> {
  if (typeof options.body !== 'string') return {};
  return JSON.parse(options.body);
}

function required(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is verplicht.`);
  return value.trim();
}

function accountImpact() {
  const role = currentRole();
  const closed = fixtures.deletedAccounts.includes(actorIds[role]);
  return {
    status: closed ? 'deletion_pending' : 'active', deadline: closed ? iso(30) : null,
    lastConsciousAt: iso(), recoveryDeadline: iso(30), requiresOwnershipTransfer: false,
    clubContentRetained: true,
    memberships: role !== 'platform' ? [{club_id: previewClubId, role, other_admins: 1}] : [],
  };
}

function clubRequest(parts: string[], method: string, data: Record<string, unknown>) {
  if (parts.length === 3 && method === 'GET') return {clubs: fixtures.clubs};
  if (parts.length === 3 && method === 'POST') {
    const name = required(data.name, 'Clubnaam');
    if (fixtures.clubs.some(club => club.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new Error('Deze vereniging bestaat al in de demo.');
    }
    const club = {id: crypto.randomUUID(), name, version: 1, members: 0};
    fixtures.clubs.push(club);
    return {club};
  }
  if (parts[4] === 'memberships' && method === 'PUT') {
    const club = fixtures.clubs.find(item => item.id === parts[3]);
    const account = fixtures.accounts.find(item => item.id === data.actorId && item.status === 'active' && !item.isPlatform);
    if (!club || !account) throw new Error('Kies een vereniging en een actief persoonlijk account.');
    const assignment = `${club.id}:${account.id}`;
    if (!fixtures.assignments.includes(assignment)) {
      fixtures.assignments.push(assignment);
      club.members++;
    }
    club.version++;
    return {ok: true};
  }
}

function mailRequest(parts: string[], method: string, data: Record<string, unknown>) {
  const mail = fixtures.mail;
  const section = parts[3];
  if (!section && method === 'GET') return mail;
  if (section === 'configuration' && method === 'PUT') {
    const config = mail.configuration;
    if (data.expectedVersion !== config.version) throw new Error('De instellingen zijn gewijzigd. Vernieuw de pagina.');
    mail.configuration = {
      version: config.version + 1,
      fromName: required(data.fromName, 'Afzendernaam'),
      fromEmail: required(data.fromEmail, 'Afzenderadres'),
      replyTo: String(data.replyTo || ''),
      apiKeyConfigured: config.apiKeyConfigured || Boolean(data.apiKey),
      webhookConfigured: config.webhookConfigured || Boolean(data.webhookSecret),
      encryptionReady: true,
    };
    return {configuration: mail.configuration};
  }
  if (section === 'test' && method === 'POST') {
    const unconfirmed = mail.outbox.find(item => item.status === 'unconfirmed');
    if (unconfirmed) unconfirmed.count++;
    return {ok: true};
  }
  if (section === 'templates' && method === 'PUT') {
    const index = mail.templates.findIndex(item => item.key === parts[4]);
    const previous = mail.templates[index];
    if (!previous || data.expectedVersion !== previous.version) throw new Error('De templateversie is gewijzigd. Vernieuw de pagina.');
    const template = {...validateMailTemplate(data, previous), version: previous.version + 1};
    mail.templates[index] = template;
    return {template};
  }
  if (section === 'supabase-export' && method === 'GET') {
    return {configuration: supabaseTemplateConfiguration(mail.templates), note: 'Voorbeeldexport'};
  }
}

function caseRequest(parts: string[], method: string, data: Record<string, unknown>) {
  if (parts.length === 3 && method === 'GET') return {cases: fixtures.cases};
  const item = fixtures.cases.find(candidate => candidate.id === parts[3]);
  if (!item || item.status === 'closed') throw new Error('Deze zaak is gesloten of niet beschikbaar.');
  if (method === 'GET') {
    if (item.assigned_to !== actorIds.platform) throw new Error('Wijs de zaak eerst aan jezelf toe.');
    return {email: 'privacyverzoek@voorbeeldclub.example', message: 'Dit fictieve verzoek toont welke gegevens beschikbaar zijn tijdens de behandeling.'};
  }
  if (method !== 'PATCH') return;
  if (data.action === 'assign') {
    item.assigned_to = actorIds.platform;
    item.status = 'in_progress';
  } else {
    if (item.assigned_to !== actorIds.platform) throw new Error('Wijs de zaak eerst aan jezelf toe.');
    if (data.action === 'close') {
      item.status = 'closed';
      item.closed_at = iso();
      item.outcome = required(data.outcome, 'Uitkomst');
    } else if (data.action === 'extend') {
      item.extension_reason = required(data.reason, 'Reden');
      item.extension_requested_at = iso();
    }
  }
  return {ok: true};
}

function privacyRequest(parts: string[], method: string, data: Record<string, unknown>) {
  const role = currentRole();
  const section = parts[2];
  if (section === 'cases') return caseRequest(parts, method, data);
  if (section === 'account' && method === 'GET') return accountImpact();
  if (section === 'successors' && method === 'GET') return {accounts: [{id: actorIds.team, name: actorNames.team, role: 'team'}]};
  if (section === 'export' && method === 'POST') return {demo: true, account: accountFor(role), impact: accountImpact()};
  if (section === 'delete' && method === 'POST') {
    const id = actorIds[role];
    if (!fixtures.deletedAccounts.includes(id)) fixtures.deletedAccounts.push(id);
    return {ok: true};
  }
  if (section === 'recover' && method === 'POST') {
    fixtures.deletedAccounts = fixtures.deletedAccounts.filter(id => id !== actorIds[role]);
    return {ok: true};
  }
  if (section === 'requests' && method === 'POST') {
    required(data.email, 'E-mailadres');
    required(data.message, 'Toelichting');
    fixtures.cases.unshift(makeCase(`DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, required(data.kind, 'Type verzoek'), 0, 30));
    return {ok: true};
  }
  if (section === 'transfer-admin' && method === 'POST') return {ok: true};
}

/** A deliberately browser-local implementation for the current Castiq prototype. */
export async function platformFixtureApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const parts = path.split('?')[0].slice(1).split('/').map(decodeURIComponent);
  const method = (options.method || 'GET').toUpperCase();
  const body = parseBody(options);
  let result: unknown;
  if (parts[0] === 'api' && parts[1] === 'admin') {
    if (parts[2] === 'clubs') result = clubRequest(parts, method, body);
    if (parts[2] === 'users' && method === 'GET') result = {accounts: fixtures.accounts};
    if (parts[2] === 'mail') result = mailRequest(parts, method, body);
  }
  if (parts[0] === 'api' && parts[1] === 'privacy') result = privacyRequest(parts, method, body);
  if (parts[0] === 'api' && parts[1] === 'legal' && parts[2] === 'accept' && method === 'POST') {
    if (!fixtures.clubAgreements.includes(previewClubId)) fixtures.clubAgreements.push(previewClubId);
    result = {ok: true};
  }
  if (result === undefined) throw new Error('Deze aanvraag is niet beschikbaar in de browserdemo.');
  if (method !== 'GET') saveFixtures();
  return structuredClone(result) as T;
}

type ClubCommand = 'club.settings' | 'team.save' | 'player.save' | 'match.create';
type VersionedEntity = {id: string; version?: number};

function replaceEntity<T extends VersionedEntity>(items: T[], next: T): T[] {
  return items.some(item => item.id === next.id) ? items.map(item => item.id === next.id ? next : item) : [...items, next];
}

function commandRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('De invoer ontbreekt.');
  return value as Record<string, unknown>;
}

function checkRevision(entity: {version?: number} | undefined, expected: unknown) {
  if (!entity || expected !== (entity.version || 1)) throw new Error('Dit onderdeel is gewijzigd. Open de actuele versie opnieuw.');
}

/** Applies only the commands used by the repo-native ClubSettings screen. */
export function demoClubCommand(
  state: AppState,
  actor: Actor,
  type: string,
  data: Record<string, unknown>,
): WorkspaceEnvelope {
  if (actor.role !== 'club') throw new Error('Alleen de clubbeheerder kan clubinstellingen bewerken.');
  let next: AppState;
  if ((type as ClubCommand) === 'club.settings') {
    const input = commandRecord(data.club);
    const previous = state.club as AppState['club'] & {version?: number};
    checkRevision(previous, data.expectedRevision);
    const club = {
      ...previous,
      name: required(input.name, 'Clubnaam'),
      color: required(input.color, 'Primaire clubkleur'),
      accent: required(input.accent, 'Secundaire clubkleur'),
      hashtags: String(input.hashtags || ''),
      namePolicy: String(input.namePolicy || 'initials'),
      logo: String(input.logo || ''),
      version: (previous.version || 1) + 1,
    };
    const clubs = state.clubs.map(item => item.id === club.id ? {...item, name: club.name} : item);
    const matches = state.matches.map(item => ({
      ...item, home: item.home === previous.name ? club.name : item.home, away: item.away === previous.name ? club.name : item.away,
    }));
    next = {...state, club, clubs, matches};
  } else if (type === 'team.save') {
    const input = commandRecord(data.team);
    const id = typeof input.id === 'string' ? input.id : '';
    const teams = state.teams as (AppState['teams'][number] & {version?: number})[];
    const previous = teams.find(item => item.id === id);
    if (id) checkRevision(previous, data.expectedRevision);
    const name = required(input.name, 'Teamnaam');
    if (teams.some(team => team.id !== id && team.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Er bestaat al een team met deze naam.');
    }
    if (previous && previous.name !== name && (state.matches.some(item => item.team === previous.name) || state.players.some(item => item.team === previous.name) || state.content.some(item => item.team === previous.name))) {
      throw new Error('Een teamnaam die in gebruik is kan niet worden gewijzigd.');
    }
    const team = {
      id: id || crypto.randomUUID(), name,
      category: required(input.category, 'Categorie'), family: required(input.family, 'Standaardstijl'),
      manager: previous?.manager || '', active: Boolean(input.active),
      publishScores: !/^O(?:[6-9]|10)(?:\D|$)/i.test(name) && Boolean(input.publishScores),
      namePolicy: String(input.namePolicy || 'initials'), version: previous ? (previous.version || 1) + 1 : 1,
    };
    next = {...state, teams: replaceEntity(teams, team)};
  } else if (type === 'player.save') {
    const input = commandRecord(data.player);
    const id = typeof input.id === 'string' ? input.id : '';
    const players = state.players as (AppState['players'][number] & {version?: number})[];
    const previous = players.find(item => item.id === id);
    if (id) checkRevision(previous, data.expectedRevision);
    const team = required(input.team, 'Team');
    if (!state.teams.some(item => item.name === team)) throw new Error('Kies een bestaand team.');
    const number = input.number === null ? 0 : Number(input.number);
    if (!Number.isInteger(number) || number < 0 || number > 99) throw new Error('Het rugnummer moet tussen 0 en 99 liggen.');
    const photoConsent = String(input.photoConsent || 'unknown');
    const player = {
      id: id || crypto.randomUUID(), name: required(input.name, 'Naam'), number, team,
      position: previous?.position || '', consent: photoConsent === 'approved', photo: previous?.photo || '',
      namePolicy: String(input.namePolicy || 'initials'), photoConsent,
      version: previous ? (previous.version || 1) + 1 : 1,
    };
    next = {...state, players: replaceEntity(players, player)};
  } else if (type === 'match.create') {
    const team = required(data.team, 'Team');
    if (!state.teams.some(item => item.name === team && item.active)) throw new Error('Kies een actief team.');
    const match = {
      id: crypto.randomUUID(), team, home: required(data.home, 'Thuisclub'), away: required(data.away, 'Uitclub'),
      date: required(data.date, 'Wedstrijddatum'), time: required(data.time, 'Aanvang'), location: String(data.location || ''),
      status: data.status === 'finished' ? 'finished' : 'scheduled',
      homeScore: Number(data.homeScore || 0), awayScore: Number(data.awayScore || 0),
    };
    const validScore = (score: number) => Number.isInteger(score) && score >= 0 && score <= 99;
    if (!validScore(match.homeScore) || !validScore(match.awayScore)) throw new Error('De score moet tussen 0 en 99 liggen.');
    next = {...state, matches: [...state.matches, match]};
  } else {
    throw new Error('Deze actie is niet beschikbaar in de browserdemo.');
  }
  return {state: next, actor, version: Date.now()};
}

export function demoClubUpload(file: File): Promise<{id: string; url: string}> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    return Promise.reject(new Error('Kies een PNG-, JPEG- of WebP-afbeelding van maximaal 8 MB.'));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('De afbeelding kon niet worden gelezen.'));
    reader.onload = () => resolve({id: crypto.randomUUID(), url: String(reader.result)});
    reader.readAsDataURL(file);
  });
}
