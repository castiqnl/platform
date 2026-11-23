import { defaultLayers, posterFormats, type Layer, type PosterFormat } from '../Poster';
import { templateCatalog, type TemplateDefinition } from '../templateCatalog';
import type { TextEffects } from '../posterTextEffects';
import { CLUBS, FORMATS, POST_TYPES, createStudio, withCastiqPartnerLayer } from './studio-model.mjs';

export { CLUBS };
export const managedPostTypes = POST_TYPES as Record<ManagedPostType, string>;
export const repoFormats = { '4:5': 'portrait', '9:16': 'story', '1:1': 'square', '16:9': 'wide' } as const;
export const studioFormats = { portrait: '4:5', story: '9:16', square: '1:1', wide: '16:9' } as const;
export const repoPostTypes = { match: 'Matchday', result: 'Einduitslag', news: 'Clubnieuws', lineup: 'Opstelling' } as const;
export const previewPhoto = '/assets/match-action.webp';
const clubCrest = '/assets/club-getijde.svg';
const defaultPrimary = '#2463eb';
const sampleColors = Object.fromEntries(CLUBS.map(club => [club.id, club.color]));
const fieldByBinding = {
  'club.logo': 'clubLogo', 'club.name': 'clubName', 'team.name': 'competition',
  'match.score': 'score', 'match.opponent': 'fixture', 'match.date': 'matchInfo',
  'sponsor.name': 'sponsorName', 'player.name': 'playerName',
};
const alignments = { start: 'left', middle: 'center', end: 'right' } as const;
const anchors = { left: 0, center: 0.5, right: 1 };
const alignToRepo = { left: 'start', center: 'middle', right: 'end' } as const;

export type StudioRatio = keyof typeof repoFormats;
export type ManagedPostType = keyof typeof repoPostTypes;
export type CanvasLayer = TextEffects & {
  id: string; name: string; type: 'text' | 'image' | 'shape'; binding?: string | null;
  text: string; x: number; y: number; width: number; height: number; rotation: number;
  fontSize: number; fontWeight: number; align: 'left' | 'center' | 'right'; color: string;
  opacity: number; locked: boolean; clubEditable: boolean; visible?: boolean;
  shape: 'rect' | 'circle'; fit: 'cover' | 'contain'; radius: number;
  groupId?: string; groupName?: string; required?: boolean;
  nativeKind?: Layer['kind']; nativeFont?: string; nativeTracking?: number; nativeOutline?: boolean;
};
export type ManagedVersion = { number: number; publishedAt: string; layouts: Record<StudioRatio, CanvasLayer[]> };
export type ManagedTemplate = {
  id: string; name: string; family?: string; postType: ManagedPostType; description: string;
  enabled: boolean; audience: 'all' | 'selected'; clubIds: string[]; defaultFor: boolean;
  publishedVersion: number | null; versions: ManagedVersion[];
  revision?: number;
  draft: { savedAt: string; layouts: ManagedVersion['layouts'] } | null;
};
export type ManagedSnapshot = { id: string; name: string; family?: string; version: number; layouts: ManagedVersion['layouts'] };

function toCanvasLayer(layer: Layer, format: StudioRatio): CanvasLayer {
  const { w, h } = posterFormats[repoFormats[format]];
  const scale = w / 1000;
  const isPhoto = layer.kind === 'photo';
  const isCrest = layer.kind === 'crest';
  const isRule = layer.kind === 'rule';
  const align = alignments[layer.align || 'middle'];
  const width = isCrest ? layer.size * scale : layer.width * w / 100;
  const fontSize = layer.size * scale;
  const height = isPhoto ? (layer.height || 71) * h / 100 : isCrest || isRule ? fontSize : fontSize * 1.12;
  return {
    id: layer.id, name: layer.name, type: isPhoto || isCrest ? 'image' : isRule ? 'shape' : 'text',
    binding: isPhoto ? 'photo' : fieldByBinding[layer.binding] || null,
    text: layer.text, x: Math.round(layer.x * w / 100 - width * (isPhoto || isCrest ? 0.5 : anchors[align])),
    y: Math.round(layer.y * h / 100 - height * (isPhoto || isCrest ? 0.5 : isRule ? 0 : 0.8)),
    width: Math.round(width), height: Math.max(1, Math.round(height)), rotation: layer.rotate || 0,
    fontSize: Math.round(fontSize), fontWeight: layer.weight || 700, align, color: layer.color,
    opacity: layer.opacity ?? 1, locked: false, clubEditable: isPhoto, visible: layer.visible,
    shape: isCrest ? 'circle' : 'rect', fit: isPhoto ? 'cover' : 'contain', radius: 0,
    nativeKind: layer.kind, nativeFont: layer.font, nativeTracking: layer.tracking, nativeOutline: layer.outline,
    outlineEnabled: layer.outlineEnabled, outlineColor: layer.outlineColor, outlineWidth: layer.outlineWidth === undefined ? undefined : layer.outlineWidth * scale,
    shadowEnabled: layer.shadowEnabled, shadowColor: layer.shadowColor, shadowOpacity: layer.shadowOpacity,
    shadowOffsetX: layer.shadowOffsetX === undefined ? undefined : layer.shadowOffsetX * scale,
    shadowOffsetY: layer.shadowOffsetY === undefined ? undefined : layer.shadowOffsetY * scale,
    shadowBlur: layer.shadowBlur === undefined ? undefined : layer.shadowBlur * scale,
  };
}

export function sourceLayouts(family: string, postType: ManagedPostType, type: string = repoPostTypes[postType]): ManagedVersion['layouts'] {
  return Object.fromEntries(Object.keys(FORMATS).map((ratio: StudioRatio) => [ratio,
    withCastiqPartnerLayer(defaultLayers(type, repoFormats[ratio], family, defaultPrimary, '#ffffff').map(layer => {
      const mapped = toCanvasLayer(layer, ratio);
      if (layer.id === 'score' && type === 'Matchday') mapped.binding = 'matchTime';
      return mapped;
    }), ratio),
  ])) as ManagedVersion['layouts'];
}

function seedTemplate(definition: TemplateDefinition, index: number): ManagedTemplate {
  const postType = (['result', 'match', 'lineup', 'news'] as const)[index % 4];
  const layouts = sourceLayouts(definition.name, postType);
  return {
    id: `familie-${definition.id}`, name: definition.name, family: definition.name,
    postType, description: definition.description, enabled: true, audience: 'all', clubIds: [],
    defaultFor: false, publishedVersion: 1, versions: [{ number: 1, publishedAt: '2026-11-22T21:56:00Z', layouts }], draft: null,
  };
}

export const managedTemplates = createStudio(undefined, {
  templates: templateCatalog.map(seedTemplate), includeFixtures: false,
  previewPhoto, clubLogos: { cl1: clubCrest },
});

export function managedType(type: string): ManagedPostType {
  if (type === 'Opstelling') return 'lineup';
  if (['Einduitslag', 'Ruststand', 'Toernooiresultaat'].includes(type)) return 'result';
  if (['Matchday', 'Aftrap', 'Afgelasting'].includes(type)) return 'match';
  return 'news';
}

export function isFamilyAvailable(family: string, clubId: string, entries?: ManagedTemplate[]) {
  if (entries) return entries.some(entry => entry.family === family && entry.enabled && entry.publishedVersion);
  const template = managedTemplates.state.templates.find((entry: ManagedTemplate) => entry.id.startsWith('familie-') && entry.family === family);
  return !template || Boolean(template.enabled && template.publishedVersion && (template.audience === 'all' || template.clubIds.includes(clubId)));
}

export function availableTemplates(clubId: string, type: string, entries?: ManagedTemplate[]): ManagedTemplate[] {
  const postType = managedType(type);
  const available: ManagedTemplate[] = entries ? entries.filter(entry => entry.enabled && entry.publishedVersion) : managedTemplates.getPublishedTemplates(clubId);
  return available.filter(entry => entry.postType === postType || entry.id.startsWith('familie-'))
    .sort((a, b) => Number(b.defaultFor && b.postType === postType) - Number(a.defaultFor && a.postType === postType));
}

export function snapshotTemplate(template: ManagedTemplate, type: string): ManagedSnapshot | undefined {
  const version = template.versions.find(entry => entry.number === template.publishedVersion);
  if (!version) return;
  const layouts = template.family && managedType(type) !== template.postType
    ? sourceLayouts(template.family, managedType(type), type) : version.layouts;
  return { id: template.id, name: template.name, family: template.family, version: version.number, layouts };
}

function previewLogo(value: string) {
  if (!value || value.startsWith('/')) return value || '';
  const initials = value.replace(/[^A-Z0-9]/gi, '').slice(0, 4);
  const layout = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path d="M48 5 86 18V48C86 66 70 81 48 91 26 81 10 66 10 48V18Z" fill="#112637" stroke="#ebf4ed" stroke-width="5"/><text x="48" y="55" text-anchor="middle" fill="#f1f7f5" font-family="sans-serif" font-weight="700" font-size="27">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(layout)}`;
}

export function previewFields(fields: Record<string, string | null | undefined>) {
  return {
    ...fields, fixture: `${fields.homeName || ''} × ${fields.awayName || ''}`,
    matchInfo: `${fields.matchDate || ''} · ${fields.venue || ''}`,
    homeLogo: previewLogo(fields.homeLogo), awayLogo: previewLogo(fields.awayLogo), clubLogo: previewLogo(fields.clubLogo),
    sponsorName: 'CLUBPARTNER', playerName: 'ROBIN BAKKER',
  };
}

export function previewPrimary(clubId: string) {
  return sampleColors[clubId] || defaultPrimary;
}

export function toPosterLayers(layers: CanvasLayer[], format: StudioRatio, fields: Record<string, string | null | undefined>): Layer[] {
  const { w, h } = posterFormats[repoFormats[format]];
  const scale = w / 1000;
  return layers.map(layer => {
    const kind = layer.nativeKind || (layer.type === 'image' ? (layer.fit === 'cover' ? 'photo' : 'crest') : layer.type === 'shape' ? 'rule' : 'text');
    const isPhoto = kind === 'photo';
    const isCrest = kind === 'crest';
    const isRule = kind === 'rule';
    const text = layer.binding ? fields[layer.binding] ?? '' : layer.text;
    const x = layer.x + layer.width * (isPhoto || isCrest ? 0.5 : anchors[layer.align]);
    const y = layer.y + layer.height * (isPhoto || isCrest ? 0.5 : isRule ? 0 : 0.8);
    return {
      id: layer.id, name: layer.name, kind, text, x: x * 100 / w, y: y * 100 / h,
      width: layer.width * 100 / w, height: layer.height * 100 / h,
      size: (isCrest ? Math.min(layer.width, layer.height) : isRule ? layer.height : layer.fontSize) / scale,
      color: layer.color, visible: layer.visible !== false && (!(isPhoto || isCrest) || !!text), locked: layer.locked,
      align: alignToRepo[layer.align], font: layer.nativeFont, weight: layer.fontWeight, rotate: layer.rotation,
      opacity: layer.opacity, tracking: layer.nativeTracking, outline: layer.nativeOutline,
      shape: layer.shape, radius: layer.radius / scale, fit: layer.fit,
      outlineEnabled: layer.outlineEnabled, outlineColor: layer.outlineColor,
      outlineWidth: layer.outlineWidth === undefined ? undefined : layer.outlineWidth / scale,
      shadowEnabled: layer.shadowEnabled, shadowColor: layer.shadowColor, shadowOpacity: layer.shadowOpacity,
      shadowOffsetX: layer.shadowOffsetX === undefined ? undefined : layer.shadowOffsetX / scale,
      shadowOffsetY: layer.shadowOffsetY === undefined ? undefined : layer.shadowOffsetY / scale,
      shadowBlur: layer.shadowBlur === undefined ? undefined : layer.shadowBlur / scale,
    };
  });
}
