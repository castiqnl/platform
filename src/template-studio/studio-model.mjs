export const FORMATS = Object.freeze({
  '4:5': { width: 1080, height: 1350, label: 'Feed' },
  '9:16': { width: 1080, height: 1920, label: 'Story' },
  '1:1': { width: 1080, height: 1080, label: 'Vierkant' },
  '16:9': { width: 1600, height: 900, label: 'Breed' },
})

export const CASTIQ_PARTNER_LAYER_ID = 'castiq-partner-logo'
export const CASTIQ_PARTNER_LOGO_URL = '/assets/logo-dark.svg'
export const CASTIQ_PARTNER_PLAQUE = Object.freeze({
  background: '#101920',
  border: '#ffffff2e',
  radius: 13,
  padding: 14,
})

export const POST_TYPES = Object.freeze({
  match: 'Wedstrijd',
  result: 'Uitslag',
  news: 'Clubnieuws',
  lineup: 'Opstelling',
})

export const CLUBS = Object.freeze([
  { id: 'cl1', name: 'SC Getijde', color: '#2463eb', secondaryColor: '#ffffff', initials: 'SCG' },
  { id: 'cl2', name: 'FC Havenlicht', color: '#0e7457', secondaryColor: '#edfff6', initials: 'FCH' },
  { id: 'cl3', name: 'SV Noordhaven', color: '#96532e', secondaryColor: '#fff1df', initials: 'SVN' },
])

export const BINDINGS = Object.freeze({
  homeName: 'Thuisteam',
  awayName: 'Uitteam',
  fixture: 'Beide teams',
  homeLogo: 'Thuislogo',
  awayLogo: 'Uitlogo',
  clubLogo: 'Clublogo',
  homeScore: 'Score thuis',
  awayScore: 'Score uit',
  score: 'Eindstand',
  matchDate: 'Wedstrijddatum',
  matchTime: 'Aanvang',
  matchInfo: 'Datum en locatie',
  venue: 'Locatie',
  competition: 'Competitie',
  photo: 'Wedstrijdfoto',
  sponsorLogo: 'Sponsorlogo',
  sponsorName: 'Sponsornaam',
  clubName: 'Clubnaam',
  playerName: 'Spelersnaam',
  title: 'Titel',
  subtitle: 'Ondertitel',
  lineup: 'Spelers',
})

const FIELDS = {
  homeName: CLUBS[0].name,
  awayName: CLUBS[2].name,
  fixture: [CLUBS[0].name, CLUBS[2].name].join(' × '),
  homeLogo: CLUBS[0].initials,
  awayLogo: CLUBS[2].initials,
  clubLogo: CLUBS[0].initials,
  homeScore: '3',
  awayScore: '1',
  score: '3 – 1',
  matchDate: 'Zaterdag 28 november',
  matchTime: '14:30',
  matchInfo: 'Zaterdag 28 november · Sportpark Getijde',
  venue: 'Sportpark Getijde',
  competition: '1E ELFTAL · COMPETITIE',
  photo: null,
  sponsorLogo: 'HOOFDSPONSOR',
  sponsorName: 'Van Dijk Sport',
  clubName: CLUBS[0].name,
  playerName: 'Robin Bakker',
  title: 'Samen voor de club',
  subtitle: 'NIEUWS VAN DE VERENIGING',
  lineup: '01  J. de Vries\n02  S. van Dijk\n04  N. Vermeer\n06  A. Jansen\n08  M. de Jong\n09  D. Bakker',
}

export const PREVIEW_SCENARIOS = Object.freeze({
  normal: { label: 'Normale wedstrijd', fields: { ...FIELDS } },
  'long-names': {
    label: 'Lange teamnamen',
    fields: {
      ...FIELDS,
      homeName: 'Sportclub Getijde Zaterdag 1',
      awayName: 'Voetbalvereniging Havenlicht Zaterdag 1',
      awayLogo: CLUBS[1].initials,
      venue: 'Sportpark Getijde, veld 1',
      title: 'De vereniging komt zaterdag samen op Sportpark Getijde',
    },
  },
  'missing-photo': {
    label: 'Zonder wedstrijdfoto',
    fields: { ...FIELDS, photo: null },
  },
})

const STORAGE_KEY = 'castiq.template-studio.v1'
const clone = value => structuredClone(value)
const own = (object, key) => Object.hasOwn(object, key)
const now = () => new Date().toISOString()
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
let fallbackId = 0

function newId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + '-' + (++fallbackId)
  return prefix + '-' + suffix
}

export function resolvePreviewFields(clubId, scenarioId = 'normal', options = {}) {
  const club = CLUBS.find(item => item.id === clubId) || CLUBS[0]
  const scenario = PREVIEW_SCENARIOS[scenarioId] || PREVIEW_SCENARIOS.normal
  const isLong = scenarioId === 'long-names'
  const awayClub = [CLUBS[2], CLUBS[1], CLUBS[0]].find(candidate => {
    return candidate.id !== club.id && (!isLong || candidate.id === 'cl2')
  }) || CLUBS[2]
  const homeName = isLong && club.id === 'cl1'
    ? scenario.fields.homeName
    : club.name + (isLong ? ' Zaterdag 1' : '')
  const awayName = isLong && awayClub.id === 'cl2'
    ? scenario.fields.awayName
    : awayClub.name + (isLong ? ' Zaterdag 1' : '')
  const homeLogo = options.clubLogos?.[club.id] || club.initials
  return {
    ...scenario.fields,
    homeName,
    awayName,
    fixture: [homeName, awayName].join(' × '),
    homeLogo,
    awayLogo: options.clubLogos?.[awayClub.id] || awayClub.initials,
    clubLogo: homeLogo,
    clubName: club.name,
    matchInfo: [scenario.fields.matchDate, scenario.fields.venue].join(' · '),
    photo: scenarioId === 'missing-photo' ? null : options.previewPhoto || scenario.fields.photo,
    sponsorLogo: options.sponsorLogo || scenario.fields.sponsorLogo,
    sponsorName: options.sponsorName || scenario.fields.sponsorName,
  }
}

function layer(id, name, type, x, y, width, height, style = {}) {
  return {
    id, name, type, x, y, width, height,
    binding: null,
    text: '',
    rotation: 0,
    fontSize: 54,
    fontWeight: 700,
    align: 'left',
    color: '#f4f9fa',
    opacity: 1,
    locked: false,
    visible: true,
    clubEditable: false,
    shape: 'rect',
    fit: 'contain',
    radius: 0,
    ...style,
  }
}

export function getCastiqPartnerLayer(format) {
  const { width, height } = existingFormat(format)
  const badgeWidth = format === '16:9' ? 184 : 176
  const badgeHeight = format === '16:9' ? 64 : 68
  const x = width - Math.round(width * .032) - badgeWidth
  const y = height - Math.round(height * .025) - badgeHeight
  return layer(CASTIQ_PARTNER_LAYER_ID, 'Castiq-logo', 'image', x, y, badgeWidth, badgeHeight, {
    text: CASTIQ_PARTNER_LOGO_URL,
    locked: true,
    required: true,
  })
}

export function withCastiqPartnerLayer(layers, format) {
  return [...layers.filter(item => item.id !== CASTIQ_PARTNER_LAYER_ID), getCastiqPartnerLayer(format)]
}

const PALETTES = {
  lime: { dark: '#0a1a19', shade: '#163330', accent: '#c3f55a', light: '#f6ffeb' },
  blue: { dark: '#0f1941', shade: '#1e326c', accent: '#a7c5ff', light: '#f1f5ff' },
  peach: { dark: '#302026', shade: '#482b34', accent: '#ffb88c', light: '#fff1e8' },
  teal: { dark: '#092831', shade: '#16434d', accent: '#9ef2df', light: '#edfbf8' },
}

function fixtureLayout(postType, format, palette) {
  if (format === '16:9') {
    const { width, height } = FORMATS[format]
    const square = FORMATS['1:1']
    const horizontal = width / square.width
    const vertical = height / square.height
    return fixtureLayout(postType, '1:1', palette).map(item => {
      const widthScale = item.type === 'image' && item.binding !== 'photo' ? vertical : horizontal
      return {
        ...item,
        x: Math.round(item.x * horizontal + item.width * (horizontal - widthScale) / 2),
        y: Math.round(item.y * vertical),
        width: Math.round(item.width * widthScale),
        height: Math.round(item.height * vertical),
        fontSize: Math.round(item.fontSize * vertical),
      }
    })
  }
  const { width, height } = FORMATS[format]
  const centerY = format === '9:16' ? 995 : (format === '1:1' ? 540 : 710)
  const titleY = format === '9:16' ? 470 : (format === '1:1' ? 230 : 310)
  const labelY = titleY - 90
  const footerY = height - (format === '9:16' ? 304 : 190)
  const headline = {
    match: 'MATCHDAY',
    result: 'FULLTIME',
    news: 'CLUBNIEUWS',
    lineup: 'OPSTELLING',
  }[postType]
  const boundText = (id, name, binding, x, y, w, h, style = {}) => {
    return layer(id, name, 'text', x, y, w, h, { binding, color: palette.light, ...style })
  }
  const label = (id, name, text, x, y, w, h, style = {}) => {
    return layer(id, name, 'text', x, y, w, h, { text, color: palette.light, ...style })
  }
  const mark = (id, name, binding, x, y, w, h, style = {}) => {
    return layer(id, name, 'image', x, y, w, h, { binding, color: palette.light, ...style })
  }
  const rect = (id, name, x, y, w, h, color, style = {}) => {
    return layer(id, name, 'shape', x, y, w, h, { color, ...style })
  }

  const layers = [
    rect('background', 'Achtergrond', 0, 0, width, height, palette.dark, { locked: true }),
    mark('photo', 'Wedstrijdfoto', 0, 0, width, height, {
      fit: 'cover', binding: 'photo', opacity: 0.42, clubEditable: true,
    }),
    rect('shade', 'Kleurvlak', 0, titleY - 154, width, height - titleY + 154, palette.shade, { opacity: 0.78 }),
    rect('top-rule', 'Accentlijn boven', 70, labelY - 28, 940, 4, palette.accent, { opacity: 0.8 }),
    boundText('competition', 'Competitie', 'competition', 70, labelY, 940, 48, {
      fontSize: 34, color: palette.accent,
    }),
    label('heading', 'Koptekst', headline, 66, titleY, 956, 154, { fontSize: 148, fontWeight: 900 }),
    rect('footer-rule', 'Accentlijn onder', 70, footerY - 33, 940, 3, palette.accent, { opacity: 0.64 }),
    mark('sponsor', 'Sponsorlogo', 'sponsorLogo', 720, footerY + 34, 290, 75, { color: palette.light }),
  ]
  if (postType === 'match' || postType === 'result') {
    layers.push(
      mark('home-logo', 'Thuislogo', 'homeLogo', 141, centerY - 26, 177, 177, { color: palette.light }),
      mark('away-logo', 'Uitlogo', 'awayLogo', 762, centerY - 26, 177, 177, { color: palette.light }),
      boundText('home-name', 'Thuisteam', 'homeName', 74, centerY + 158, 328, 92, { fontSize: 41, align: 'center' }),
      boundText('away-name', 'Uitteam', 'awayName', 678, centerY + 158, 328, 92, { fontSize: 41, align: 'center' }),
      boundText('date', 'Datum', 'matchDate', 70, footerY + 4, 630, 58, { fontSize: 40 }),
      boundText('venue', 'Locatie', 'venue', 70, footerY + 65, 630, 47, { fontSize: 30, color: palette.accent }),
      postType === 'match'
        ? boundText('time', 'Aanvang', 'matchTime', 350, centerY + 12, 380, 130, { fontSize: 94, align: 'center' })
        : boundText('score', 'Eindstand', 'score', 350, centerY + 6, 380, 142, { fontSize: 126, align: 'center', color: palette.accent }),
    )
  } else {
    layers.push(
      mark('home-logo', 'Clublogo', 'homeLogo', 840, 65, 150, 150),
      boundText('main-copy', postType === 'lineup' ? 'Spelers' : 'Titel', postType === 'lineup' ? 'lineup' : 'title',
        70, centerY - 46, 940, footerY - centerY - 8, { fontSize: postType === 'lineup' ? 42 : 78, clubEditable: true }),
      boundText('club-name', 'Clubnaam', 'clubName', 70, footerY + 4, 630, 76, { fontSize: 48, color: palette.accent }),
    )
  }
  return layers
}

function fixtureLayouts(postType, palette = PALETTES.lime) {
  return Object.fromEntries(Object.keys(FORMATS).map(format => [
    format, withCastiqPartnerLayer(fixtureLayout(postType, format, palette), format),
  ]))
}

function fixtureTemplate(id, name, postType, description, options) {
  const { versions = 1, draft, palette, ...metadata } = options
  const layouts = fixtureLayouts(postType, palette)
  const history = Array.from({ length: versions }, (_, index) => ({
    number: index + 1,
    publishedAt: new Date(Date.UTC(2026, 10, 12 + index, 11, 0)).toISOString(),
    layouts: clone(layouts),
  }))
  if (versions > 1) {
    for (const format of Object.keys(FORMATS)) {
      const previousHeading = history[0].layouts[format].find(item => item.id === 'heading')
      previousHeading.x += 16
      previousHeading.y += 22
      previousHeading.fontSize -= 10
    }
  }
  return {
    id, name, postType, description,
    enabled: versions > 0,
    audience: 'all',
    clubIds: [],
    defaultFor: false,
    publishedVersion: versions || null,
    versions: history,
    draft: draft ? { savedAt: '2026-11-19T09:00:00.000Z', basedOnVersion: versions || null, layouts: clone(layouts) } : null,
    ...metadata,
  }
}

function fixtureTemplates() {
  return [
    fixtureTemplate('matchday', 'Wedstrijddag · Bold', 'match', 'Aftrap, locatie en de teams in één ontwerp.', { versions: 2, defaultFor: true }),
    fixtureTemplate('fulltime', 'Eindstand · Score', 'result', 'Uitslag met beide teams en ruimte voor een sponsor.', { versions: 3, defaultFor: true, palette: PALETTES.blue }),
    fixtureTemplate('club-news', 'Clubnieuws · Editorial', 'news', 'Voor aankondigingen en nieuws van de vereniging.', { versions: 1, defaultFor: true, palette: PALETTES.peach }),
    fixtureTemplate('lineup', 'Opstelling · Selectie', 'lineup', 'De selectie voor de volgende wedstrijd.', { versions: 2, draft: true, audience: 'selected', clubIds: ['cl1', 'cl2'], defaultFor: true, palette: PALETTES.teal }),
    fixtureTemplate('matchday-classic', 'Wedstrijddag · Klassiek', 'match', 'Een tweede indeling voor wedstrijdposters.', { enabled: false, palette: PALETTES.blue }),
    fixtureTemplate('academy-result', 'Eindstand · Jeugd', 'result', 'Een uitslagtemplate voor jeugdteams.', { versions: 0, draft: true, palette: PALETTES.teal }),
  ]
}

function completeLayouts(layouts, fallback) {
  return Object.fromEntries(Object.keys(FORMATS).map(format => [
    format, withCastiqPartnerLayer(clone(Array.isArray(layouts?.[format]) ? layouts[format] : fallback[format]), format),
  ]))
}

function normalizeSeed(template) {
  const { layouts, ...metadata } = clone(template)
  const postType = own(POST_TYPES, metadata.postType) ? metadata.postType : 'match'
  const fallback = fixtureLayouts(postType)
  const versions = Array.isArray(template.versions)
    ? template.versions.map(version => ({ ...version, layouts: completeLayouts(version.layouts, fallback) }))
    : [{
      number: template.publishedVersion || 1,
      publishedAt: template.publishedAt || '2026-11-23T09:00:00.000Z',
      layouts: completeLayouts(layouts, fallback),
    }]
  const publishedVersion = template.publishedVersion === undefined
    ? versions.at(-1)?.number || null
    : template.publishedVersion
  return {
    id: template.id,
    name: template.name,
    description: '',
    audience: 'all',
    clubIds: [],
    defaultFor: false,
    ...metadata,
    postType,
    enabled: template.enabled ?? Boolean(publishedVersion),
    publishedVersion,
    versions,
    draft: template.draft ? { ...template.draft, layouts: completeLayouts(template.draft.layouts, fallback) } : null,
  }
}

function readState(storage, options) {
  const custom = Array.isArray(options.templates) ? options.templates.map(normalizeSeed) : []
  const seedIds = new Set(custom.map(template => template.id))
  const defaultTypes = new Set(custom.filter(template => template.defaultFor).map(template => template.postType))
  const fixtures = options.includeFixtures === false ? [] : fixtureTemplates()
  const extraFixtures = fixtures.filter(template => !seedIds.has(template.id)).map(template => ({
    ...template, defaultFor: template.defaultFor && !defaultTypes.has(template.postType),
  }))
  const seeded = [...custom, ...extraFixtures]
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    const parsed = raw && JSON.parse(raw)
    if (parsed?.schemaVersion === 1 && Array.isArray(parsed.templates) && parsed.templates.every(template =>
      template && typeof template.id === 'string' && Array.isArray(template.versions),
    )) {
      const storedIds = new Set(parsed.templates.map(template => template.id))
      return {
        ...parsed,
        templates: [...parsed.templates.map(normalizeSeed), ...seeded.filter(template => !storedIds.has(template.id))],
      }
    }
  } catch {
    // A browser that blocks storage can still use the current session.
  }
  return { schemaVersion: 1, templates: seeded }
}

function getLocalStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function isClub(clubId) {
  return CLUBS.some(item => item.id === clubId)
}

function existingFormat(format) {
  if (own(FORMATS, format)) return FORMATS[format]
  throw new Error('Dit formaat is niet beschikbaar.')
}

export const LAYER_EFFECT_DEFAULTS = Object.freeze({
  outlineEnabled: false,
  outlineColor: '#111827',
  outlineWidth: 3,
  shadowEnabled: false,
  shadowColor: '#000000',
  shadowOpacity: 0.65,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowBlur: 12,
})

const EFFECT_LIMITS = {
  outlineWidth: [0, 40],
  shadowOpacity: [0, 1],
  shadowOffsetX: [-200, 200],
  shadowOffsetY: [-200, 200],
  shadowBlur: [0, 120],
}
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i
const POSITION_FIELDS = new Set(['x', 'y', 'width', 'height', 'rotation'])
const VALID_LAYER_TYPES = ['image', 'text', 'shape']
const LAYER_FIELDS = [
  'name', 'type', 'binding', 'text', 'x', 'y', 'width', 'height', 'rotation', 'fontSize',
  'fontWeight', 'align', 'color', 'opacity', 'locked', 'visible', 'clubEditable', 'shape', 'fit', 'radius',
  ...Object.keys(LAYER_EFFECT_DEFAULTS),
]

function boundedNumber(value, fallback, minimum, maximum) {
  if (value === '' || value === null || value === undefined) return fallback
  const number = Number(value)
  return Number.isFinite(number) ? clamp(number, minimum, maximum) : fallback
}

function sanitizeLayer(current, patch, format) {
  const { width, height } = FORMATS[format]
  const changed = Object.fromEntries(LAYER_FIELDS.filter(key => own(patch, key) && (!current.locked || !POSITION_FIELDS.has(key)))
    .map(key => [key, patch[key]]))
  if (!Object.keys(changed).length) return current
  for (const key of ['outlineEnabled', 'shadowEnabled']) {
    if (own(changed, key)) changed[key] = Boolean(changed[key])
  }
  for (const key of ['outlineColor', 'shadowColor']) {
    if (own(changed, key) && !HEX_COLOR.test(changed[key])) changed[key] = current[key] ?? LAYER_EFFECT_DEFAULTS[key]
  }
  for (const [key, [minimum, maximum]] of Object.entries(EFFECT_LIMITS)) {
    if (own(changed, key)) changed[key] = boundedNumber(changed[key], current[key] ?? LAYER_EFFECT_DEFAULTS[key], minimum, maximum)
  }
  const next = { ...current, ...changed }
  return {
    ...next,
    name: String(next.name || current.name).trim().slice(0, 90) || current.name,
    type: VALID_LAYER_TYPES.includes(next.type) ? next.type : current.type,
    binding: next.binding && own(BINDINGS, next.binding) ? next.binding : null,
    text: String(next.text ?? '').slice(0, 2000),
    x: Math.round(boundedNumber(next.x, current.x, -2 * width, 2 * width)),
    y: Math.round(boundedNumber(next.y, current.y, -2 * height, 2 * height)),
    width: Math.round(boundedNumber(next.width, current.width, 1, 2 * width)),
    height: Math.round(boundedNumber(next.height, current.height, 1, 2 * height)),
    rotation: boundedNumber(next.rotation, current.rotation, -360, 360),
    fontSize: boundedNumber(next.fontSize, current.fontSize, 8, 384),
    fontWeight: boundedNumber(next.fontWeight, current.fontWeight, 100, 900),
    align: ['left', 'center', 'right'].includes(next.align) ? next.align : current.align,
    color: HEX_COLOR.test(next.color) ? next.color : current.color,
    opacity: boundedNumber(next.opacity, current.opacity, 0, 1),
    locked: Boolean(next.locked),
    visible: next.visible !== false,
    clubEditable: Boolean(next.clubEditable),
    shape: next.shape === 'circle' ? 'circle' : 'rect',
    fit: next.fit === 'cover' ? 'cover' : 'contain',
    radius: boundedNumber(next.radius, current.radius, 0, 540),
  }
}

function pickLayers(layers, ids, expandGroups = false) {
  const selected = new Set(ids)
  if (!expandGroups) return layers.filter(item => selected.has(item.id))
  const groups = new Set(layers.filter(item => selected.has(item.id) && item.groupId).map(item => item.groupId))
  return layers.filter(item => selected.has(item.id) || groups.has(item.groupId))
}

function withoutGroup(item) {
  const { groupId, groupName, ...ungrouped } = item
  return ungrouped
}

function stackUnits(layers) {
  const units = []
  const groups = new Map()
  for (const item of layers) {
    const existing = item.groupId && groups.get(item.groupId)
    if (existing) {
      existing.push(item)
      continue
    }
    const unit = [item]
    units.push(unit)
    if (item.groupId) groups.set(item.groupId, unit)
  }
  return units
}

function defaultGroupName(layers) {
  const names = new Set(layers.map(item => item.groupName))
  let number = 1
  while (names.has(`Groep ${number}`)) number++
  return `Groep ${number}`
}

export function createStudio(storage = getLocalStorage(), options = {}) {
  let committed = readState(storage, options)
  const workingDrafts = new Map()
  const subscribers = new Set()
  let availableClubs = options.clubs || CLUBS
  const knownClub = clubId => availableClubs.some(club => club.id === clubId)

  function notify(action, templateId, format = null) {
    for (const listener of subscribers) {
      try {
        listener({ action, templateId, format })
      } catch (error) {
        globalThis.reportError?.(error)
      }
    }
  }

  function commit(next, action, templateId) {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next))
    committed = next
    notify(action, templateId)
  }

  function findTemplate(id) {
    const template = committed.templates.find(item => item.id === id)
    if (!template) throw new Error('Dit template is niet meer beschikbaar.')
    return template
  }

  function updateCommitted(id, changes, action) {
    const target = findTemplate(id)
    const updated = { ...target, ...changes }
    commit({
      ...committed,
      templates: committed.templates.map(template => template.id === id ? updated : template),
    }, action, id)
    return clone(updated)
  }

  function findPublished(template, number = template.publishedVersion) {
    return template.versions.find(version => version.number === number)
  }

  function initialDraft(template) {
    return template.draft?.layouts || findPublished(template)?.layouts || fixtureLayouts(template.postType)
  }

  function currentDraft(id) {
    return workingDrafts.get(id) || initialDraft(findTemplate(id))
  }

  function changeLayers(id, format, action, edit) {
    existingFormat(format)
    const layouts = currentDraft(id)
    const previous = layouts[format]
    const layers = edit(previous)
    if (layers === previous) return clone(layers)
    workingDrafts.set(id, { ...layouts, [format]: layers })
    notify(action, id, format)
    return clone(layers)
  }

  function isAvailable(template, clubId) {
    return Boolean(template.enabled && template.publishedVersion &&
      (template.audience === 'all' || template.clubIds.includes(clubId)))
  }

  const model = {
    replaceState(next) {
      if (!next || !Array.isArray(next.templates)) throw new Error('Ongeldige centrale templatebibliotheek.')
      committed = { schemaVersion: 1, templates: next.templates.map(normalizeSeed) }
      if (Array.isArray(next.clubs)) availableClubs = next.clubs
      workingDrafts.clear()
      notify('server-sync', null)
    },

    replaceTemplate(template) {
      const next = normalizeSeed(template)
      committed = {...committed, templates: committed.templates.some(item => item.id === next.id)
        ? committed.templates.map(item => item.id === next.id ? next : item) : [...committed.templates, next]}
      workingDrafts.delete(next.id)
      notify('server-sync', next.id)
    },
    get state() {
      return clone(committed)
    },

    subscribe(listener) {
      subscribers.add(listener)
      return () => subscribers.delete(listener)
    },

    getTemplate(id) {
      const template = committed.templates.find(item => item.id === id)
      return template ? clone(template) : null
    },

    createTemplate({ name, postType = 'match', description = '', basedOn = null, family, layouts } = {}) {
      if (!own(POST_TYPES, postType)) throw new Error('Kies een geldig posttype.')
      const label = String(name || '').trim().slice(0, 90)
      if (!label) throw new Error('Geef het template een naam.')
      const id = newId('template')
      const base = basedOn ? currentDraft(basedOn) : fixtureLayouts(postType)
      const template = {
        id, name: label, postType, ...(family ? { family } : {}), description: String(description).trim().slice(0, 280),
        enabled: false, audience: 'all', clubIds: [], defaultFor: false,
        publishedVersion: null, versions: [],
        draft: { savedAt: now(), basedOnVersion: null, layouts: completeLayouts(layouts, base) },
      }
      commit({ ...committed, templates: [...committed.templates, template] }, 'create', id)
      return clone(template)
    },

    updateTemplate(id, patch = {}) {
      const template = findTemplate(id)
      const name = String(patch.name ?? template.name).trim().slice(0, 90)
      const description = String(patch.description ?? template.description).trim().slice(0, 280)
      const postType = patch.postType ?? template.postType
      if (!name) throw new Error('Geef het template een naam.')
      if (!own(POST_TYPES, postType)) throw new Error('Kies een geldig posttype.')
      return updateCommitted(id, {
        name, description, postType, defaultFor: postType === template.postType && template.defaultFor,
      }, 'metadata')
    },

    configureTemplate(id, { name, audience, clubIds, defaultFor }) {
      const template = findTemplate(id)
      const label = String(name || '').trim().slice(0, 90)
      if (!label) throw new Error('Geef het template een naam.')
      if (!['all', 'selected'].includes(audience)) throw new Error('Kies voor welke clubs dit template beschikbaar is.')
      const selected = audience === 'selected' ? [...new Set(clubIds.filter(knownClub))] : []
      if (audience === 'selected' && !selected.length) throw new Error('Selecteer minimaal één vereniging.')
      if (defaultFor && !template.publishedVersion) throw new Error('Publiceer eerst een versie van dit template.')
      const next = { ...template, name: label, audience, clubIds: selected, defaultFor: Boolean(defaultFor) }
      commit({
        ...committed,
        templates: committed.templates.map(item => {
          if (item.id === id) return next
          if (defaultFor && item.postType === template.postType && item.defaultFor) return { ...item, defaultFor: false }
          return item
        }),
      }, 'metadata', id)
      return clone(next)
    },

    setEnabled(id, enabled) {
      const template = findTemplate(id)
      if (enabled && !template.publishedVersion) throw new Error('Publiceer eerst een versie van dit template.')
      return updateCommitted(id, { enabled: Boolean(enabled) }, 'availability')
    },

    setAudience(id, audience, clubIds = []) {
      if (!['all', 'selected'].includes(audience)) throw new Error('Kies voor welke clubs dit template beschikbaar is.')
      if (!Array.isArray(clubIds)) throw new Error('Kies een geldige clublijst.')
      const selected = [...new Set(clubIds.filter(knownClub))]
      return updateCommitted(id, { audience, clubIds: audience === 'selected' ? selected : [] }, 'audience')
    },

    setDefault(id, isDefault) {
      const template = findTemplate(id)
      if (isDefault && !template.publishedVersion) throw new Error('Publiceer eerst een versie van dit template.')
      const next = {
        ...committed,
        templates: committed.templates.map(item => {
          if (item.id === id) return { ...item, defaultFor: Boolean(isDefault) }
          if (isDefault && item.postType === template.postType && item.defaultFor) return { ...item, defaultFor: false }
          return item
        }),
      }
      commit(next, 'default', id)
      return model.getTemplate(id)
    },

    getLayers(id, format) {
      existingFormat(format)
      return clone(currentDraft(id)[format])
    },

    getPublishedLayers(id, format, number) {
      existingFormat(format)
      return clone(findPublished(findTemplate(id), number)?.layouts[format] || [])
    },

    hasUnsavedChanges(id) {
      if (!workingDrafts.has(id)) return false
      return JSON.stringify(workingDrafts.get(id)) !== JSON.stringify(initialDraft(findTemplate(id)))
    },

    addLayer(id, format, overrides = {}) {
      const { width, height } = existingFormat(format)
      const type = VALID_LAYER_TYPES.includes(overrides.type) ? overrides.type : 'text'
      const name = { text: 'Tekst', image: 'Afbeelding', shape: 'Vorm' }[type]
      const idForLayer = newId('laag')
      const base = layer(idForLayer, name, type, width / 2 - 135, height / 2 - 60, 270, 120, {
        text: type === 'text' ? 'Nieuwe tekst' : '',
      })
      const item = sanitizeLayer(base, overrides, format)
      changeLayers(id, format, 'add-layer', layers => withCastiqPartnerLayer([...layers, item], format))
      return clone(item)
    },

    updateLayer(id, format, layerId, patch = {}) {
      return model.updateLayers(id, format, [layerId], patch).find(item => item.id === layerId) || null
    },

    updateLayers(id, format, layerIds, patch = {}) {
      const selected = new Set(layerIds)
      return changeLayers(id, format, 'update-layer', previous => {
        let changed = false
        const layers = previous.map(item => {
          if (!selected.has(item.id) || item.required) return item
          const itemPatch = typeof patch === 'function' ? patch(clone(item)) : patch
          if (!itemPatch) return item
          const updated = sanitizeLayer(item, itemPatch, format)
          if (JSON.stringify(updated) === JSON.stringify(item)) return item
          changed = true
          return updated
        })
        return changed ? layers : previous
      })
    },

    removeLayer(id, format, layerId) {
      return model.removeLayers(id, format, [layerId])
    },

    removeLayers(id, format, layerIds) {
      return changeLayers(id, format, 'remove-layer', previous => {
        const selected = pickLayers(previous, layerIds, true)
        if (!selected.length || selected.some(item => item.locked)) return previous
        const ids = new Set(selected.map(item => item.id))
        return previous.filter(item => !ids.has(item.id))
      })
    },

    reorderLayer(id, format, layerId, direction) {
      return model.reorderLayers(id, format, [layerId], direction)
    },

    reorderLayers(id, format, layerIds, direction) {
      const step = Math.sign(Number(direction) || 0)
      return changeLayers(id, format, 'reorder-layer', previous => {
        const selected = pickLayers(previous, layerIds, true)
        if (!step || !selected.length || selected.some(item => item.locked)) return previous
        const ids = new Set(selected.map(item => item.id))
        const units = stackUnits(previous.filter(item => !item.required))
        let moved = false
        for (let index = step > 0 ? units.length - 2 : 1; index >= 0 && index < units.length; index -= step) {
          const neighbor = index + step
          if (!ids.has(units[index][0].id) || ids.has(units[neighbor][0].id)) continue
          const selectedUnit = units[index]
          units[index] = units[neighbor]
          units[neighbor] = selectedUnit
          moved = true
        }
        return moved ? withCastiqPartnerLayer(units.flat(), format) : previous
      })
    },

    groupLayers(id, format, layerIds, name = '') {
      let group = null
      changeLayers(id, format, 'group-layers', previous => {
        const selected = pickLayers(previous, layerIds, true)
        if (selected.length < 2 || selected.some(item => item.locked)) return previous
        const ids = new Set(selected.map(item => item.id))
        const oldGroup = selected[0].groupId
        if (oldGroup && selected.every(item => item.groupId === oldGroup)) {
          group = { id: oldGroup, name: selected[0].groupName, layerIds: [...ids] }
          return previous
        }
        const groupId = newId('groep')
        const groupName = String(name || '').trim().slice(0, 90) || defaultGroupName(previous)
        group = { id: groupId, name: groupName, layerIds: [...ids] }
        const last = selected.at(-1).id
        return previous.flatMap(item => item.id === last
          ? selected.map(member => ({ ...member, groupId, groupName }))
          : ids.has(item.id) ? [] : [item])
      })
      return group
    },

    ungroupLayers(id, format, layerIds) {
      return changeLayers(id, format, 'ungroup-layers', previous => {
        const ids = new Set(pickLayers(previous, layerIds, true).filter(item => item.groupId).map(item => item.id))
        return ids.size ? previous.map(item => ids.has(item.id) ? withoutGroup(item) : item) : previous
      })
    },

    renameGroup(id, format, groupId, name) {
      const label = String(name || '').trim().slice(0, 90)
      return changeLayers(id, format, 'rename-group', previous => {
        if (!groupId || !label || !previous.some(item => item.groupId === groupId && item.groupName !== label)) return previous
        return previous.map(item => item.groupId === groupId ? { ...item, groupName: label } : item)
      })
    },

    saveDraft(id) {
      const template = findTemplate(id)
      const draft = {
        layouts: clone(currentDraft(id)),
        savedAt: now(),
        basedOnVersion: template.draft?.basedOnVersion ?? template.publishedVersion,
      }
      const working = workingDrafts.get(id)
      workingDrafts.delete(id)
      try {
        updateCommitted(id, { draft }, 'save-draft')
      } catch (error) {
        if (working) workingDrafts.set(id, working)
        throw error
      }
      return clone(draft)
    },

    publishDraft(id) {
      const template = findTemplate(id)
      const number = (template.versions.at(-1)?.number || 0) + 1
      const version = { number, layouts: clone(currentDraft(id)), publishedAt: now() }
      const working = workingDrafts.get(id)
      workingDrafts.delete(id)
      try {
        updateCommitted(id, {
          publishedVersion: number,
          versions: [...template.versions, version],
          draft: null,
        }, 'publish')
      } catch (error) {
        if (working) workingDrafts.set(id, working)
        throw error
      }
      return clone(version)
    },

    resetDraft(id) {
      findTemplate(id)
      workingDrafts.delete(id)
      notify('reset-draft', id)
    },

    discardDraft(id) {
      const working = workingDrafts.get(id)
      workingDrafts.delete(id)
      try {
        return updateCommitted(id, { draft: null }, 'discard-draft')
      } catch (error) {
        if (working) workingDrafts.set(id, working)
        throw error
      }
    },

    restoreVersionAsDraft(id, number) {
      const template = findTemplate(id)
      const version = findPublished(template, number)
      if (!version) throw new Error('Deze versie is niet beschikbaar.')
      const working = workingDrafts.get(id)
      workingDrafts.delete(id)
      const draft = { savedAt: now(), basedOnVersion: version.number, layouts: clone(version.layouts) }
      try {
        updateCommitted(id, { draft }, 'restore-version')
      } catch (error) {
        if (working) workingDrafts.set(id, working)
        throw error
      }
      return clone(draft)
    },

    getPreviewFields(scenarioId = 'normal', clubId = CLUBS[0].id) {
      return resolvePreviewFields(clubId, scenarioId, options)
    },

    getPublishedTemplates(clubId, postType = null) {
      if (!knownClub(clubId)) return []
      const available = committed.templates.filter(template =>
        isAvailable(template, clubId) && (!postType || template.postType === postType),
      )
      return clone(available.sort((a, b) => Number(b.defaultFor) - Number(a.defaultFor)))
    },

    createPostSnapshot(id, format, clubId, fields = {}) {
      existingFormat(format)
      const template = findTemplate(id)
      if (!knownClub(clubId) || !isAvailable(template, clubId)) {
        throw new Error('Dit template is niet beschikbaar voor deze club.')
      }
      const version = findPublished(template)
      return {
        templateId: id, templateName: template.name, postType: template.postType, version: version.number,
        format, clubId, layers: clone(version.layouts[format]),
        fields: { ...model.getPreviewFields('normal', clubId), ...clone(fields) },
      }
    },
  }

  return model
}
