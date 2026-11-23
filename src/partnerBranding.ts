const storageKey = 'castiq-partner-branding-v1';
const defaultDiscount = 10;
// Browser training state is never an entitlement/price source in server mode.
const demoStorageAllowed=()=>import.meta.env.CASTIQ_DATA_MODE==='demo'||(import.meta.env.DEV&&typeof location!=='undefined'&&new URLSearchParams(location.search).get('demo')==='1');
function requireDemoStorage(){if(!demoStorageAllowed())throw new Error('Gebruik in servermodus de centrale pakket-API; lokale demokeuzes zijn geen serverbeleid.');}
const plans = new Set(['Gratis', 'Start', 'Club', 'Pro']);

type ClubChoice = { plan?: string; optedIn?: boolean };
type Settings = { discount: number; clubs: Map<string, ClubChoice> };
type SavedSettings = { discount: number; clubs: Record<string, ClubChoice> };

function readSettings(): Settings {
  if(!demoStorageAllowed())return {discount:defaultDiscount,clubs:new Map()};
  try {
    const data = JSON.parse(globalThis.localStorage?.getItem(storageKey) || 'null') as Partial<SavedSettings> | null;
    return {
      discount: Number.isInteger(data?.discount) && data.discount >= 0 && data.discount <= 100 ? data.discount : defaultDiscount,
      clubs: new Map(Object.entries(data?.clubs || {}).filter(([, choice]) => choice && typeof choice === 'object')),
    };
  } catch {
    return { discount: defaultDiscount, clubs: new Map() };
  }
}

let settings = readSettings();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function writeSettings(next: Settings) {
  requireDemoStorage();
  globalThis.localStorage?.setItem(storageKey, JSON.stringify({ discount: next.discount, clubs: Object.fromEntries(next.clubs) }));
  settings = next;
  notify();
}

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if(!demoStorageAllowed())return;
  if (event.key !== storageKey && event.key !== null) return;
  settings = readSettings();
  notify();
});

export function subscribePartnerBranding(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isFreePlan(plan: string) {
  return ['gratis', 'free'].includes(String(plan).trim().toLowerCase());
}

export function getClubPlan(clubId: string, fallback: string) {
  requireDemoStorage();
  const selected = settings.clubs.get(clubId)?.plan;
  return selected && plans.has(selected) ? selected : fallback;
}

export function getPartnerBranding(clubId: string, plan: string) {
  requireDemoStorage();
  const activePlan = getClubPlan(clubId, plan);
  const required = isFreePlan(activePlan);
  const optedIn = settings.clubs.get(clubId)?.optedIn === true;
  return {
    enabled: required || optedIn,
    required,
    optedIn,
    discountPercent: required || !optedIn ? 0 : settings.discount,
  };
}

export function getPartnerDiscountPercent() {
  requireDemoStorage();
  return settings.discount;
}

export function setPartnerDiscountPercent(discount: number) {
  if (!Number.isInteger(discount) || discount < 0 || discount > 100) throw new Error('Kies een heel percentage van 0 tot en met 100.');
  writeSettings({ ...settings, discount });
}

function updateClub(clubId: string, patch: ClubChoice) {
  if (!clubId) throw new Error('Kies eerst een vereniging.');
  const clubs = new Map(settings.clubs);
  clubs.set(clubId, { ...clubs.get(clubId), ...patch });
  writeSettings({ ...settings, clubs });
}

export function setClubPlan(clubId: string, plan: string) {
  if (!plans.has(plan)) throw new Error('Kies een beschikbare bundel.');
  updateClub(clubId, { plan });
}

export function setPartnerOptIn(clubId: string, enabled: boolean) {
  updateClub(clubId, { optedIn: enabled });
}

export function reloadPartnerBranding() {
  settings = readSettings();
  notify();
}
