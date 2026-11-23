import { BINDINGS, CASTIQ_PARTNER_PLAQUE, CLUBS, FORMATS, LAYER_EFFECT_DEFAULTS, PREVIEW_SCENARIOS } from './studio-model.mjs';
import { resizeSelection } from './resize-selection.mjs';

const ICONS = {
  back: '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.7 6.4M3 4v7h7m2-4v5l3 2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="9" r="1.5"/><path d="m3 17 5-4 4 3 4-5 5 5"/>',
  text: '<path d="M5 7V4h14v3m-7-3v16m-4 0h8"/>',
  shape: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/>',
  grid: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M4 15h16M10 4v16m5-16v16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  select: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 8v10a2 2 0 0 1-2 2H8m-.5-10 2 2L13 8"/>',
  group: '<rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6.5" y="8" width="4.5" height="4" rx=".5"/><rect x="13" y="12" width="4.5" height="4" rx=".5"/>',
  ungroup: '<path d="M7 4H4v3m16 0V4h-3m0 16h3v-3M4 17v3h3"/><rect x="6.5" y="7.5" width="4.5" height="4" rx=".5"/><rect x="13" y="12.5" width="4.5" height="4" rx=".5"/>',
  collapse: '<path d="m9 5 7 7-7 7"/>',
  shield: '<path d="M12 3 4 7v5c0 4 2.9 7.1 8 9 5.1-1.9 8-5 8-9V7l-8-4Z"/>'
};

const IMAGE_BINDINGS = new Set(['photo', 'homeLogo', 'awayLogo', 'clubLogo', 'sponsorLogo']);
const MATCH_TYPES = new Set(['match', 'result', 'lineup']);
const icon = (name, size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const html = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);
const option = (value, label, selected) => `<option value="${html(value)}"${value === selected ? ' selected' : ''}>${html(label)}</option>`;
const labelFor = (item, fallback) => typeof item === 'string' ? item : item?.label ?? fallback;
const colorValue = (value) => /^#[\da-f]{6}$/i.test(value || '') ? value : '#ffffff';
const dateLabel = (value) => value ? new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Amsterdam',
}).format(new Date(value)) : '';
const apply = (element, styles) => Object.assign(element.style, styles);
const clamp = (value, min, max) => Math.round(Math.max(min, Math.min(max, value)));
const percentageFields = new Set(['opacity', 'shadowOpacity']);
const usesModifier = (event) => event.shiftKey || event.metaKey || event.ctrlKey;
const resizeHandle = '<span data-resize-layer title="Houd Shift vast om de verhoudingen te behouden"></span>';

function rgba(hex, alpha) {
  const color = colorValue(hex).slice(1);
  const components = [0, 2, 4].map(index => Number.parseInt(color.slice(index, index + 2), 16));
  return `rgba(${components.join(', ')}, ${alpha})`;
}

function textEffects(layer) {
  const effects = { ...LAYER_EFFECT_DEFAULTS, ...layer };
  const outline = effects.outlineEnabled || (layer.outlineEnabled === undefined && layer.nativeOutline);
  return {
    WebkitTextStroke: outline ? `${effects.outlineWidth}px ${effects.outlineColor}` : '',
    textShadow: effects.shadowEnabled
      ? `${effects.shadowOffsetX}px ${effects.shadowOffsetY}px ${effects.shadowBlur}px ${rgba(effects.shadowColor, effects.shadowOpacity)}`
      : '',
    paintOrder: 'stroke fill',
  };
}

function layerBounds(layers) {
  if (!layers.length) return null;
  const x = Math.min(...layers.map(layer => layer.x));
  const y = Math.min(...layers.map(layer => layer.y));
  const width = Math.max(...layers.map(layer => layer.x + layer.width)) - x;
  const height = Math.max(...layers.map(layer => layer.y + layer.height)) - y;
  return { x, y, width, height, rotation: 0 };
}

function geometryLayers(selected) {
  const blockedGroups = new Set(selected.filter(layer => layer.locked).map(layer => layer.groupId).filter(Boolean));
  return selected.filter(layer => !layer.locked && !blockedGroups.has(layer.groupId));
}

function knownImage(value) {
  return typeof value === 'string' && /^(?:https?:\/\/|\.{0,2}\/|data:image\/|blob:)/i.test(value);
}

function imageContent(layer, fields, context) {
  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  image.decoding = 'async';
  image.style.objectFit = layer.fit ?? 'contain';
  const boundValue = layer.binding ? fields[layer.binding] : layer.text;
  const photoOverride = context.scenarioId === 'missing-photo' ? null : (
    typeof context.backgroundUrl === 'function'
      ? context.backgroundUrl(context)
      : context.backgroundUrl
  );
  if (knownImage(boundValue) || (layer.binding === 'photo' && knownImage(photoOverride))) {
    image.src = knownImage(boundValue) ? boundValue : photoOverride;
    return image;
  }

  const placeholder = document.createElement('span');
  if (layer.binding === 'photo') {
    placeholder.className = 'cq-art-photo-placeholder';
    return placeholder;
  }
  if (!boundValue) return placeholder;
  if (layer.binding === 'sponsorLogo') {
    placeholder.className = 'cq-art-sponsor';
    placeholder.textContent = boundValue;
    return placeholder;
  }
  placeholder.className = 'cq-art-crest';
  placeholder.style.setProperty('--crest-color', layer.binding === 'awayLogo' ? '#293851' : context.club?.color ?? '#113668');
  placeholder.innerHTML = icon('shield', 100);
  const initials = document.createElement('strong');
  initials.textContent = boundValue;
  placeholder.append(initials);
  return placeholder;
}

function layerArtwork(layer, fields, context) {
  if (layer.type === 'image') return imageContent(layer, fields, context);
  if (layer.type === 'shape') {
    const shape = document.createElement('span');
    shape.className = 'cq-art-shape';
    shape.style.background = layer.color;
    shape.style.borderRadius = layer.shape === 'circle' ? '50%' : `${layer.radius ?? 0}px`;
    return shape;
  }

  const text = document.createElement('span');
  text.className = 'cq-art-text';
  const value = layer.binding ? fields[layer.binding] : layer.text;
  text.textContent = value ?? '';
  apply(text, {
    color: layer.color,
    fontFamily: layer.nativeFont,
    fontSize: `${layer.fontSize}px`,
    fontWeight: layer.fontWeight,
    letterSpacing: layer.nativeTracking == null ? '' : `${layer.nativeTracking}px`,
    textAlign: layer.align,
    ...textEffects(layer),
  });
  return text;
}

function positionLayer(node, layer) {
  apply(node, {
    left: `${layer.x}px`, top: `${layer.y}px`,
    width: `${layer.width}px`, height: `${layer.height}px`,
    transform: `rotate(${layer.rotation ?? 0}deg)`,
  });
}

function previewNativeTransform(item, patch, dimensions, resize) {
  const { nativeLayer, nativeTransform, nativeViewBox, layer } = item;
  if (!nativeLayer || !nativeViewBox) return;
  const scaleX = nativeViewBox.width / dimensions.width;
  const scaleY = nativeViewBox.height / dimensions.height;
  if (!resize) {
    const x = (patch.x - layer.x) * scaleX;
    const y = (patch.y - layer.y) * scaleY;
    nativeLayer.setAttribute('transform', `translate(${x} ${y}) ${nativeTransform}`);
    return;
  }

  const x = layer.x * scaleX;
  const y = layer.y * scaleY;
  const nextX = patch.x * scaleX;
  const nextY = patch.y * scaleY;
  const width = patch.width / layer.width;
  const height = patch.height / layer.height;
  nativeLayer.setAttribute('transform', `translate(${nextX} ${nextY}) scale(${width} ${height}) translate(${-x} ${-y}) ${nativeTransform}`);
}

function makeLayer(layer, fields, context, editable, active, primary, native) {
  const element = document.createElement('div');
  element.className = 'cq-art-layer';
  element.classList.toggle('is-native', native);
  element.classList.toggle('is-required', Boolean(layer.required));
  positionLayer(element, layer);
  if (editable) {
    element.dataset.canvasLayer = layer.id;
    element.classList.toggle('is-locked', layer.locked);
    element.classList.toggle('is-selected', active);
    element.setAttribute('role', 'button');
    element.setAttribute('aria-label', layer.name);
    element.setAttribute('aria-pressed', String(active));
    element.tabIndex = primary ? 0 : -1;
  }

  const artwork = document.createElement('div');
  artwork.className = 'cq-layer-artwork';
  artwork.style.opacity = layer.opacity;
  if (!native) {
    if (layer.required) {
      const { background, border, radius, padding } = CASTIQ_PARTNER_PLAQUE;
      apply(artwork, { background, border: `1px solid ${border}`, borderRadius: `${radius}px`, padding: `4px ${padding}px` });
    }
    artwork.append(layerArtwork(layer, fields, context));
  }
  element.append(artwork);
  return element;
}

function artboard(model, layers, format, context, options = {}) {
  const dimensions = FORMATS[format];
  const art = document.createElement('div');
  art.className = 'cq-artboard';
  const layersRoot = document.createElement('div');
  layersRoot.className = 'cq-art-surface';
  apply(layersRoot, { width: `${dimensions.width}px`, height: `${dimensions.height}px` });
  layersRoot.style.setProperty('--club-color', context.club?.color ?? '#19438b');
  layersRoot.style.setProperty('--club-accent', context.club?.secondaryColor ?? '#60a5fa');
  const fields = model.getPreviewFields(context.scenarioId, context.club?.id);
  let attachedArtwork;
  if (context.renderArtwork) {
    const underlay = document.createElement('div');
    underlay.className = 'cq-art-underlay';
    layersRoot.append(underlay);
    attachedArtwork = context.renderArtwork(underlay, {
      template: context.template, layers, format, fields, club: context.club, scenarioId: context.scenarioId,
    });
    if (!attachedArtwork) underlay.remove();
    art.cleanup = attachedArtwork?.cleanup;
  }
  const handledLayerIds = attachedArtwork instanceof Set ? attachedArtwork : attachedArtwork?.layerIds;
  const selected = options.editable ? layers.filter(layer => options.selectedIds?.has(layer.id)) : [];
  for (const layer of layers) {
    if (layer.visible === false) continue;
    const wasRendered = handledLayerIds?.has(layer.id) ?? Boolean(attachedArtwork && !layer.id.startsWith('laag-'));
    if (!wasRendered || options.editable) {
      layersRoot.append(makeLayer(layer, fields, context, Boolean(options.editable),
        options.selectedIds?.has(layer.id), layer.id === options.primaryId, wasRendered));
    }
  }

  if (options.guides) {
    const guides = document.createElement('div');
    guides.className = 'cq-art-guides';
    guides.setAttribute('aria-hidden', 'true');
    layersRoot.append(guides);
  }

  const visibleSelection = selected.filter(layer => layer.visible !== false);
  const movable = geometryLayers(selected);
  for (const layer of visibleSelection) {
    const border = document.createElement('div');
    border.className = 'cq-selection';
    border.dataset.selectionLayer = layer.id;
    positionLayer(border, layer);
    if (selected.length === 1 && !layer.locked) border.innerHTML = resizeHandle;
    layersRoot.append(border);
  }
  if (selected.length > 1 && movable.some(layer => layer.visible !== false)) {
    const bounds = document.createElement('div');
    bounds.className = 'cq-selection cq-selection-bounds';
    positionLayer(bounds, layerBounds(movable));
    bounds.innerHTML = resizeHandle;
    layersRoot.append(bounds);
  }

  art.append(layersRoot);
  return art;
}

export function mountTemplateStudio(root, { model, templateId, onBack, onChange, backgroundUrl, renderArtwork } = {}) {
  const initial = model.getTemplate(templateId);
  if (!initial) throw new Error('De template is niet beschikbaar.');

  let format = '4:5';
  let previewFormat = format;
  let scenarioId = 'normal';
  let clubId = CLUBS[0]?.id;
  let primaryId = model.getLayers(templateId, format).find((layer) => !layer.locked)?.id;
  let selectedIds = new Set(primaryId ? [primaryId] : []);
  let multiMode = false;
  let inspectorTab = 'layer';
  const collapsedGroups = new Set();
  let guides = false;
  let modal = null;
  let version = null;
  let drag = null;
  let scale = 1;
  let noticeTimer;
  const controller = new AbortController();
  const { signal } = controller;
  const bind = (element, event, listener, options = {}) => element.addEventListener(event, listener, { ...options, signal });

  root.innerHTML = `
    <section class="cq-studio" aria-labelledby="cq-studio-title">
      <header class="cq-studio-header">
        <div class="cq-studio-title">
          <button type="button" class="cq-tool cq-back" data-action="back" aria-label="Terug naar templates" title="Terug naar templates">${icon('back', 19)}</button>
          <div>
            <div class="cq-studio-kicker">Template Studio</div>
            <h1 id="cq-studio-title">${html(initial.name)}</h1>
          </div>
        </div>
        <div class="cq-studio-actions">
          <span class="cq-draft-status" data-part="draft-status"></span>
          <button type="button" class="cq-btn" data-action="history">${icon('history')}<span>Versies</span></button>
          <button type="button" class="cq-btn" data-action="preview">${icon('eye')}<span>Voorbeeld</span></button>
          <button type="button" class="cq-btn" data-action="save">Concept opslaan</button>
          <button type="button" class="cq-btn cq-primary" data-action="publish">Versie publiceren</button>
        </div>
      </header>
      <div class="cq-studio-layout">
        <aside class="cq-studio-panel cq-layer-panel" aria-label="Lagen">
          <div class="cq-panel-header">
            <h2>${icon('layers')} Lagen</h2>
            <div class="cq-panel-actions">
              <button type="button" class="cq-tool" data-action="multi" aria-label="Meerdere lagen selecteren" aria-pressed="false" title="Meerdere lagen selecteren">${icon('select', 17)}</button>
              <button type="button" class="cq-tool" data-action="add" aria-label="Laag toevoegen" title="Laag toevoegen">${icon('plus', 17)}</button>
            </div>
          </div>
          <div class="cq-layer-selection" data-part="selection-tools" hidden></div>
          <div class="cq-layer-list" data-part="layers"></div>
          <div class="cq-panel-foot" data-part="layer-move"></div>
        </aside>
        <section class="cq-canvas-panel" aria-label="Canvas">
          <div class="cq-canvas-toolbar">
            <div class="cq-format-group" role="group" aria-label="Canvasformaat">
              ${Object.keys(FORMATS).map((key) => `<button type="button" data-format="${key}" aria-pressed="false"><span class="cq-aspect" data-aspect="${key}"></span>${key}</button>`).join('')}
            </div>
            <button type="button" class="cq-tool" data-action="guides" aria-pressed="false" aria-label="Hulplijnen" title="Hulplijnen">${icon('grid')}</button>
          </div>
          <div class="cq-canvas-viewport" data-part="viewport"></div>
          <div class="cq-canvas-foot" data-part="format-meta"></div>
        </section>
        <aside class="cq-studio-panel cq-inspector-panel" aria-label="Laageigenschappen">
          <div class="cq-panel-header"><h2>Eigenschappen</h2><small data-part="inspector-count"></small></div>
          <div class="cq-inspector-tabs" role="group" aria-label="Eigenschapsgroepen">
            <button type="button" data-tab="layer" aria-pressed="true">Laag</button>
            <button type="button" data-tab="style" aria-pressed="false">Vormgeving</button>
            <button type="button" data-tab="effects" aria-pressed="false">Effecten</button>
          </div>
          <div class="cq-inspector" data-part="inspector"></div>
        </aside>
      </div>
      <div class="cq-notice" data-part="notice" role="status" hidden></div>
      <dialog class="cq-studio-dialog" data-part="dialog"><div data-part="dialog-content"></div></dialog>
    </section>
  `;

  const studio = root.firstElementChild;
  const part = (name) => studio.querySelector(`[data-part="${name}"]`);
  const viewport = part('viewport');
  const dialog = part('dialog');
  const setPressed = (element, pressed) => element?.setAttribute('aria-pressed', String(pressed));
  const getTemplate = () => model.getTemplate(templateId);
  const getLayers = () => model.getLayers(templateId, format);
  const selectedLayers = (layers = getLayers()) => layers.filter(layer => selectedIds.has(layer.id));
  const getSelection = (layers = getLayers()) => layers.find(layer => layer.id === primaryId);
  const getGroup = (layers, groupId) => layers.filter(layer => layer.groupId === groupId);
  const setSelection = (ids, preferred) => {
    selectedIds = new Set(ids);
    primaryId = selectedIds.has(preferred) ? preferred : [...selectedIds].at(-1);
  };
  const getContext = () => ({
    scenarioId, club: CLUBS.find((club) => club.id === clubId) ?? CLUBS[0], backgroundUrl,
    template: getTemplate(), renderArtwork,
  });
  const clearArt = (element) => element?.firstElementChild?.cleanup?.();

  function notify(message) {
    const notice = part('notice');
    notice.textContent = message;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 3600);
  }

  function refreshHeader() {
    const template = getTemplate();
    const dirty = model.hasUnsavedChanges(templateId);
    part('draft-status').textContent = dirty
      ? 'Onopgeslagen wijzigingen'
      : template.draft ? 'Concept opgeslagen'
        : template.publishedVersion ? `Versie ${template.publishedVersion} gepubliceerd` : 'Concept';
    studio.querySelector('[data-action="save"]').disabled = !dirty && Boolean(template.draft || template.publishedVersion);
    studio.querySelector('[data-action="publish"]').disabled = !dirty && !template.draft && Boolean(template.publishedVersion);
    studio.querySelector('[data-action="history"]').disabled = !template.versions?.length;
  }

  function fitArt(container, art, activeFormat, isPreview = false) {
    const dimensions = FORMATS[activeFormat];
    const padding = isPreview ? 0 : 32;
    const maxWidth = container.clientWidth ? Math.max(80, container.clientWidth - padding) : 350;
    const maxHeight = isPreview ? Math.min(512, document.documentElement.clientHeight * 0.58) : Math.max(190, container.clientHeight - padding);
    const ratio = Math.min(maxWidth / dimensions.width, maxHeight / dimensions.height);
    if (!isPreview) {
      scale = ratio;
      art.style.setProperty('--cq-resize-size', `${12 / ratio}px`);
    }
    apply(art, { width: `${dimensions.width * ratio}px`, height: `${dimensions.height * ratio}px` });
    art.firstElementChild.style.transform = `scale(${ratio})`;
  }

  function renderCanvas() {
    const artwork = artboard(model, getLayers(), format, getContext(), { editable: true, selectedIds, primaryId, guides });
    clearArt(viewport);
    viewport.replaceChildren(artwork);
    fitArt(viewport, artwork, format);
    for (const button of studio.querySelectorAll('[data-format]')) setPressed(button, button.dataset.format === format);
    setPressed(studio.querySelector('[data-action="guides"]'), guides);
    const dimensions = FORMATS[format];
    part('format-meta').textContent = `${dimensions.label} · ${dimensions.width} × ${dimensions.height} px`;
  }

  function renderLayers() {
    const layers = getLayers();
    const selected = selectedLayers(layers);
    const structural = selected.flatMap(layer => layer.groupId ? getGroup(layers, layer.groupId) : [layer]);
    const structuralIds = new Set(structural.map(layer => layer.id));
    const canReorder = structuralIds.size > 0 && !structural.some(layer => layer.locked);
    const reorderableLayers = layers.filter(layer => !layer.required);
    const canMove = direction => canReorder && reorderableLayers.some((layer, index) => {
      const adjacent = reorderableLayers[index + direction];
      return structuralIds.has(layer.id) && adjacent && !structuralIds.has(adjacent.id);
    });
    const groupsInSelection = new Set(structural.map(layer => layer.groupId).filter(Boolean));
    const selectionTools = part('selection-tools');
    selectionTools.hidden = !multiMode && selected.length < 2 && !groupsInSelection.size;
    selectionTools.innerHTML = `
      <span>${selected.length} geselecteerd</span>
      ${selected.length ? '<button class="cq-text-action" type="button" data-action="clear-selection">Wissen</button>' : ''}
    `;
    setPressed(studio.querySelector('[data-action="multi"]'), multiMode);

    const renderLayer = (layer, child = false) => {
      const active = selectedIds.has(layer.id);
      return `<button type="button" class="cq-layer-button${active ? ' is-selected' : ''}${layer.visible === false ? ' is-hidden' : ''}${layer.required ? ' cq-required-layer' : ''}${child ? ' cq-group-child' : ''}" data-layer="${html(layer.id)}" aria-pressed="${active}">
        <span class="cq-layer-symbol">${icon(layer.required ? 'shield' : layer.type, 15)}</span>
        <span class="cq-layer-label" title="${html(layer.name)}">${html(layer.name)}${layer.required ? '<small>Verplichte laag</small>' : layer.binding ? `<small>${html(labelFor(BINDINGS[layer.binding], layer.binding))}</small>` : ''}</span>
        ${layer.locked ? `<span class="cq-layer-lock" aria-label="Vergrendeld">${icon('lock', 13)}</span>` : ''}
        ${multiMode && active ? `<span class="cq-layer-tick">${icon('check', 13)}</span>` : ''}
      </button>`;
    };
    const renderedGroups = new Set();
    part('layers').innerHTML = [...layers].reverse().map(layer => {
      if (!layer.groupId) return renderLayer(layer);
      if (renderedGroups.has(layer.groupId)) return '';
      renderedGroups.add(layer.groupId);
      const members = getGroup(layers, layer.groupId);
      const active = members.every(member => selectedIds.has(member.id));
      const expanded = !collapsedGroups.has(layer.groupId);
      return `<div class="cq-layer-group">
        <div class="cq-layer-group-head">
          <button class="cq-tool cq-collapse" type="button" data-collapse="${html(layer.groupId)}" aria-expanded="${expanded}" aria-label="${expanded ? 'Inklappen' : 'Uitklappen'} ${html(layer.groupName)}">${icon('collapse', 14)}</button>
          <button type="button" class="cq-layer-button cq-group-button${active ? ' is-selected' : ''}" data-group="${html(layer.groupId)}" aria-pressed="${active}">
            <span class="cq-layer-symbol">${icon('group', 14)}</span><span class="cq-layer-label">${html(layer.groupName)}</span><small>${members.length}</small>
          </button>
        </div>
        ${expanded ? `<div class="cq-layer-group-children">${[...members].reverse().map(member => renderLayer(member, true)).join('')}</div>` : ''}
      </div>`;
    }).join('') || '<p class="cq-empty">Voeg een laag toe om te beginnen.</p>';

    const oneGroupSelected = groupsInSelection.size === 1 && structural.every(layer => layer.groupId);
    const canGroup = selected.length > 1 && canReorder && !oneGroupSelected;
    const action = (key, glyph, label, disabled = false) => `<button type="button" class="cq-tool${key === 'remove' ? ' cq-remove' : ''}" data-action="${key}" title="${label}" aria-label="${label}"${disabled ? ' disabled' : ''}>${icon(glyph)}</button>`;
    part('layer-move').innerHTML = `
      ${action('forward', 'up', 'Selectie naar voren', !canMove(1))}
      ${action('backward', 'down', 'Selectie naar achteren', !canMove(-1))}
      ${selected.length > 1 ? action('group', 'group', 'Groeperen', !canGroup) : ''}
      ${groupsInSelection.size ? action('ungroup', 'ungroup', 'Groep opheffen') : ''}
      ${action('remove', 'trash', 'Selectie verwijderen', !canReorder)}
    `;
  }

  const numberField = (label, key, value, disabled, min, max) => `<label class="cq-field">
    <span>${label}</span><input type="number" data-field="${key}" min="${min}" max="${max}" step="1" value="${html(value)}"${value === undefined ? ' placeholder="Verschilt"' : ''}${disabled ? ' disabled' : ''}>
  </label>`;
  const checkboxField = (label, key, value) => `<label class="cq-check"><input type="checkbox" data-field="${key}"${value ? ' checked' : ''}${value === undefined ? ' data-mixed' : ''}>${label}</label>`;
  const colorField = (label, key, value, fallback) => `<label class="cq-field cq-color-field">
    <span>${label}</span><input type="color" data-field="${key}" value="${colorValue(value ?? fallback)}"><span class="cq-color-value">${html(value ?? 'Verschilt')}</span>
  </label>`;
  const selectField = (label, key, values, current) => `<label class="cq-field"><span>${label}</span><select data-field="${key}">
    ${current === undefined ? '<option value="" disabled selected>Verschilt</option>' : ''}
    ${values.map(([value, label]) => option(value, label, current)).join('')}
  </select></label>`;
  const unified = (layers, getValue) => {
    const value = getValue(layers[0]);
    return layers.every(layer => Object.is(getValue(layer), value)) ? value : undefined;
  };

  function renderInspector() {
    const layers = getLayers();
    const selected = selectedLayers(layers);
    const inspector = part('inspector');
    const scrollTop = inspector.scrollTop;
    const tabs = studio.querySelector('.cq-inspector-tabs');
    const textLayers = selected.filter(layer => layer.type === 'text');
    const requiredLayer = selected.length === 1 && selected[0].required ? selected[0] : null;
    tabs.hidden = !selected.length || Boolean(requiredLayer);
    part('inspector-count').textContent = selected.length > 1 ? `${selected.length} lagen` : '';
    if (!selected.length) {
      inspector.innerHTML = '<p class="cq-empty">Selecteer een laag op het canvas of in de lagenlijst.</p>';
      return;
    }
    if (requiredLayer) {
      inspector.innerHTML = `<div class="cq-property-block cq-required-info">
        <img src="${html(requiredLayer.text)}" alt="Castiq">
        <h3>Verplichte partnerlaag</h3>
        <p>Het logo verschijnt op clubvisuals bij het gratis pakket en als de club sponsorkorting heeft aangezet.</p>
      </div>`;
      return;
    }
    if (!textLayers.length && inspectorTab === 'effects') inspectorTab = 'style';
    for (const tab of tabs.querySelectorAll('[data-tab]')) {
      setPressed(tab, tab.dataset.tab === inspectorTab);
      tab.disabled = tab.dataset.tab === 'effects' && !textLayers.length;
    }
    const layer = getSelection(layers) ?? selected[0];
    const single = selected.length === 1;
    const group = layer.groupId ? getGroup(layers, layer.groupId) : [];
    const wholeGroup = group.length > 1 && group.length === selected.length && group.every(item => selectedIds.has(item.id));
    const dimensions = FORMATS[format];
    const locked = selected.every(item => item.locked);
    const sameType = selected.every(item => item.type === layer.type);
    const allPainted = selected.every(item => item.type !== 'image');
    const value = key => unified(selected, item => item[key]);
    const checkValue = (key, fallback = false) => unified(selected, item => item[key] ?? fallback);
    const opacity = unified(selected, item => Math.round(item.opacity * 100));
    const movable = geometryLayers(selected);
    const geometry = single ? layer : layerBounds(movable) ?? layerBounds(selected);
    const compatible = Object.entries(BINDINGS).filter(([key]) => layer.type === 'image' ? IMAGE_BINDINGS.has(key) : !IMAGE_BINDINGS.has(key));
    const source = single && layer.type !== 'shape' ? `
      ${selectField('Gegevensbron', 'binding', [['', layer.type === 'text' ? 'Vaste tekst' : 'Vaste afbeelding'], ...compatible.map(([key, binding]) => [key, labelFor(binding, key)])], layer.binding ?? '')}
      ${layer.binding ? '' : `<label class="cq-field"><span>${layer.type === 'text' ? 'Tekst' : 'Afbeeldings-URL'}</span><input type="text" data-field="text" value="${html(layer.text)}"></label>`}
    ` : '';

    if (inspectorTab === 'layer') {
      const lock = `<button type="button" class="cq-tool" data-action="toggle-lock" aria-label="${locked ? 'Positie ontgrendelen' : 'Positie vergrendelen'}" title="${locked ? 'Positie ontgrendelen' : 'Positie vergrendelen'}" aria-pressed="${locked}">${icon(locked ? 'lock' : 'unlock')}</button>`;
      inspector.innerHTML = `<div class="cq-property-block">
        <div class="cq-property-name">
          ${single ? `<label class="cq-field"><span>Laagnaam</span><input type="text" data-field="name" value="${html(layer.name)}" maxlength="64"></label>`
            : wholeGroup ? `<label class="cq-field"><span>Groepsnaam</span><input type="text" data-group-name="${html(layer.groupId)}" value="${html(layer.groupName)}" maxlength="64"></label>`
              : '<h3>Laagselectie</h3>'}
          ${lock}
        </div>
        ${source}
        ${checkboxField(single ? 'Laag zichtbaar' : 'Lagen zichtbaar', 'visible', checkValue('visible', true))}
        ${checkboxField('Club mag dit aanpassen', 'clubEditable', checkValue('clubEditable'))}
      </div>
      <div class="cq-property-block">
        <h3>Positie en formaat</h3>
        <div class="cq-field-grid">
          ${numberField('X', 'x', geometry.x, !movable.length, -dimensions.width, dimensions.width)}
          ${numberField('Y', 'y', geometry.y, !movable.length, -dimensions.height, dimensions.height)}
          ${numberField('Breedte', 'width', geometry.width, !movable.length, 1, dimensions.width * (movable.length > 1 ? 6 : 2))}
          ${numberField('Hoogte', 'height', geometry.height, !movable.length, 1, dimensions.height * (movable.length > 1 ? 6 : 2))}
          ${numberField('Rotatie (°)', 'rotation', value('rotation'), !movable.length, -360, 360)}
          ${numberField('Dekking (%)', 'opacity', opacity, false, 0, 100)}
        </div>
      </div>`;
    } else if (inspectorTab === 'style') {
      const styleFields = {
        text: `<div class="cq-field-grid">${numberField('Lettergrootte', 'fontSize', value('fontSize'), false, 8, 384)}
          ${selectField('Gewicht', 'fontWeight', [['400', 'Normaal'], ['500', 'Medium'], ['600', 'Halfvet'], ['700', 'Vet'], ['800', 'Extra vet'], ['900', 'Zwart']], value('fontWeight') === undefined ? undefined : String(value('fontWeight')))}</div>
          ${selectField('Uitlijning', 'align', [['left', 'Links'], ['center', 'Midden'], ['right', 'Rechts']], value('align'))}`,
        shape: `<div class="cq-field-grid">${selectField('Vorm', 'shape', [['rect', 'Rechthoek'], ['circle', 'Ellips']], value('shape'))}
          ${numberField('Hoekradius', 'radius', value('radius'), value('shape') === 'circle', 0, 540)}</div>`,
        image: selectField('Afbeelding', 'fit', [['cover', 'Opvullen'], ['contain', 'Passend maken']], value('fit')),
      };
      inspector.innerHTML = `<div class="cq-property-block">
        ${sameType ? styleFields[layer.type] : ''}
        ${allPainted ? colorField('Kleur', 'color', value('color'), '#ffffff') : ''}
        ${numberField('Dekking (%)', 'opacity', opacity, false, 0, 100)}
      </div>`;
    } else {
      const effect = (key, map = entry => entry) => unified(textLayers, item =>
        map(item[key] ?? (key === 'outlineEnabled' && item.nativeOutline ? true : LAYER_EFFECT_DEFAULTS[key])));
      const outlineEnabled = effect('outlineEnabled');
      const shadowEnabled = effect('shadowEnabled');
      inspector.innerHTML = `
        ${textLayers.length !== selected.length ? `<p class="cq-effect-scope">Toepassen op ${textLayers.length} ${textLayers.length === 1 ? 'tekstlaag' : 'tekstlagen'}</p>` : ''}
        <div class="cq-property-block">
          ${checkboxField('Tekstcontour', 'outlineEnabled', outlineEnabled)}
          <div class="cq-field-grid">
            ${colorField('Contourkleur', 'outlineColor', effect('outlineColor'), LAYER_EFFECT_DEFAULTS.outlineColor)}
            ${numberField('Dikte (px)', 'outlineWidth', effect('outlineWidth'), false, 0, 40)}
          </div>
        </div>
        <div class="cq-property-block">
          ${checkboxField('Schaduw', 'shadowEnabled', shadowEnabled)}
          <div class="cq-field-grid">
            ${colorField('Schaduwkleur', 'shadowColor', effect('shadowColor'), LAYER_EFFECT_DEFAULTS.shadowColor)}
            ${numberField('Dekking (%)', 'shadowOpacity', effect('shadowOpacity', entry => Math.round(entry * 100)), false, 0, 100)}
            ${numberField('Horizontaal (px)', 'shadowOffsetX', effect('shadowOffsetX'), false, -200, 200)}
            ${numberField('Verticaal (px)', 'shadowOffsetY', effect('shadowOffsetY'), false, -200, 200)}
          </div>
          ${numberField('Vervaging (px)', 'shadowBlur', effect('shadowBlur'), false, 0, 120)}
        </div>`;
    }
    for (const checkbox of inspector.querySelectorAll('[data-mixed]')) checkbox.indeterminate = true;
    inspector.scrollTop = scrollTop;
  }

  function refresh() {
    renderCanvas();
    renderLayers();
    renderInspector();
    refreshHeader();
  }

  function focusSelection(fromCanvas = false) {
    const scope = fromCanvas ? viewport : part('layers');
    const key = fromCanvas ? 'canvasLayer' : 'layer';
    const selector = fromCanvas ? '[data-canvas-layer]' : '[data-layer]';
    [...scope.querySelectorAll(selector)].find(element => element.dataset[key] === primaryId)
      ?.focus({ preventScroll: true });
  }

  function chooseLayers(ids, { additive = false, fromCanvas = false, preserve = false, preferred = ids.at(-1) } = {}) {
    const requiredIds = new Set(getLayers().filter(layer => layer.required).map(layer => layer.id));
    if (additive) ids = ids.filter(id => !requiredIds.has(id));
    if (!ids.length) return;
    const alreadySelected = ids.every(id => selectedIds.has(id));
    if (preserve && !additive && alreadySelected) {
      primaryId = preferred;
      return;
    }
    const next = additive ? new Set([...selectedIds].filter(id => !requiredIds.has(id))) : new Set();
    for (const id of ids) {
      if (additive && alreadySelected) next.delete(id);
      else next.add(id);
    }
    setSelection(next, preferred);
    refresh();
    focusSelection(fromCanvas);
  }

  function updateLayers(ids, patch, context = {}) {
    if (!ids.length) return;
    model.updateLayers(templateId, format, ids, patch);
    renderCanvas();
    refreshHeader();
    if (context.rerenderLayers) renderLayers();
    if (context.rerenderInspector) renderInspector();
  }

  function boundedDelta(layers, axis, delta, limit) {
    const coordinates = layers.map(layer => layer[axis]);
    const lower = -limit - Math.min(...coordinates);
    const upper = limit - Math.max(...coordinates);
    return lower <= upper ? clamp(delta, lower, upper) : 0;
  }

  function updateField(property, value, repaint = false) {
    if (model.isSaving?.()) return;
    const selected = selectedLayers();
    const context = {
      rerenderLayers: ['name', 'binding', 'visible'].includes(property),
      rerenderInspector: repaint && ['binding', 'shape', 'color', 'outlineColor', 'shadowColor', 'outlineEnabled', 'shadowEnabled', 'width', 'height', 'x', 'y'].includes(property),
    };
    let targets = selected;
    let patch = { [property]: value };
    if (Object.hasOwn(LAYER_EFFECT_DEFAULTS, property)) targets = selected.filter(layer => layer.type === 'text');
    if (['x', 'y', 'rotation', 'width', 'height'].includes(property)) targets = geometryLayers(selected);
    if (targets.length > 1 && (property === 'x' || property === 'y')) {
      const { width, height } = FORMATS[format];
      const delta = boundedDelta(targets, property, value - layerBounds(targets)[property], (property === 'x' ? width : height) * 2);
      patch = layer => ({ [property]: layer[property] + delta });
    }
    if (targets.length > 1 && (property === 'width' || property === 'height')) {
      const bounds = layerBounds(targets);
      const patches = resizeSelection(targets, bounds, FORMATS[format], {
        offsetX: property === 'width' ? value - bounds.width : 0,
        offsetY: property === 'height' ? value - bounds.height : 0,
      });
      patch = layer => patches.get(layer.id);
    }
    updateLayers(targets.map(layer => layer.id), patch, context);
  }

  function renderDialog() {
    const hasVersion = version !== null;
    const heading = {
      preview: hasVersion ? `Voorbeeld · versie ${version}` : 'Voorbeeld van je template',
      history: 'Versiegeschiedenis', publish: 'Templateversie publiceren', add: 'Laag toevoegen',
    };
    let body = '';
    if (modal === 'preview') {
      body = `
        <div class="cq-dialog-filters">
          <label class="cq-field"><span>Voorbeeldclub</span><select data-preview="club">${CLUBS.map((club) => option(club.id, club.name, clubId)).join('')}</select></label>
          <label class="cq-field"><span>Scenario</span><select data-preview="scenario">${Object.entries(PREVIEW_SCENARIOS).map(([id, item]) => option(id, labelFor(item, id), scenarioId)).join('')}</select></label>
          <label class="cq-field"><span>Formaat</span><select data-preview="format">${Object.keys(FORMATS).map((key) => option(key, key, previewFormat)).join('')}</select></label>
        </div>
        <div class="cq-dialog-art" data-part="dialog-art"></div>
      `;
    } else if (modal === 'history') {
      body = `<div class="cq-history-list">${[...getTemplate().versions].reverse().map((entry) => `
        <button type="button" class="cq-version-row" data-version="${entry.number}">
          <span><strong>Versie ${entry.number}</strong><small>${dateLabel(entry.publishedAt)}</small></span>
          <span>${entry.number === getTemplate().publishedVersion ? '<span class="cq-live-label">Huidig</span>' : ''}${icon('eye')}</span>
        </button>`).join('')}</div>`;
    } else if (modal === 'publish') {
      const template = getTemplate();
      const nextVersion = (template.publishedVersion ?? 0) + 1;
      body = `
        <p>Versie ${nextVersion} wordt gebruikt voor nieuwe posts zodra de template voor een club beschikbaar is. Bestaande en ingeplande posts behouden hun ontwerp.</p>
        <div class="cq-dialog-actions"><button type="button" class="cq-btn" data-action="close-dialog">Annuleren</button><button type="button" class="cq-btn cq-primary" data-action="confirm-publish">Versie ${nextVersion} publiceren</button></div>
      `;
    } else if (modal === 'add') {
      const applicable = MATCH_TYPES.has(getTemplate().postType)
        ? Object.entries(BINDINGS)
        : Object.entries(BINDINGS).filter(([key]) => ['clubName', 'photo', 'sponsorLogo', 'title', 'subtitle'].includes(key));
      body = `
        <div class="cq-add-grid">
          ${[['text', 'Tekst'], ['shape', 'Vorm'], ['image', 'Afbeelding']].map(([kind, label]) => `<button type="button" class="cq-btn" data-add-kind="${kind}">${icon(kind)}${label}</button>`).join('')}
        </div>
        <h3>Gekoppelde velden</h3>
        <div class="cq-add-grid">
          ${applicable.map(([key, binding]) => `<button type="button" class="cq-btn" data-add-kind="${IMAGE_BINDINGS.has(key) ? 'image' : 'text'}" data-add-binding="${key}">${icon(IMAGE_BINDINGS.has(key) ? 'image' : 'text')}${html(labelFor(binding, key))}</button>`).join('')}
        </div>
      `;
    }

    clearArt(part('dialog-art'));
    dialog.dataset.dialogMode = modal;
    dialog.setAttribute('aria-labelledby', 'cq-dialog-title');
    part('dialog-content').innerHTML = `
      <header class="cq-dialog-header"><h2 id="cq-dialog-title">${heading[modal]}</h2><button type="button" class="cq-tool" data-action="close-dialog" aria-label="Sluiten">${icon('close', 18)}</button></header>
      <div class="cq-dialog-body">${body}</div>
    `;
    if (!dialog.open) dialog.showModal();
    if (modal === 'preview') renderPreviewArt();
  }

  function renderPreviewArt() {
    const container = part('dialog-art');
    const layers = version === null ? model.getLayers(templateId, previewFormat) : model.getPublishedLayers(templateId, previewFormat, version);
    const artwork = artboard(model, layers ?? [], previewFormat, getContext());
    clearArt(container);
    container.replaceChildren(artwork);
    fitArt(container, artwork, previewFormat, true);
  }

  function openModal(next, selectedVersion = null) {
    modal = next;
    if (next === 'preview') previewFormat = format;
    version = selectedVersion;
    renderDialog();
  }

  function addLayer(kind, binding) {
    const label = labelFor(BINDINGS[binding], null);
    const dimensions = FORMATS[format];
    const layer = model.addLayer(templateId, format, {
      type: kind,
      binding: binding || null,
      name: label ?? { text: 'Nieuwe tekst', image: 'Nieuwe afbeelding', shape: 'Nieuwe vorm' }[kind],
      text: kind === 'text' && !binding ? 'Nieuwe tekst' : '',
      x: Math.round(dimensions.width * 0.25),
      y: Math.round(dimensions.height * 0.35),
      width: Math.round(dimensions.width * 0.5),
      height: kind === 'image' ? 250 : 110,
      fontSize: 58,
      fit: binding === 'photo' ? 'cover' : 'contain',
    });
    if (!layer) return;
    setSelection([layer.id]);
    inspectorTab = 'layer';
    dialog.close();
    refresh();
  }

  async function persist(method) {
    const controls = [...studio.querySelectorAll('button,input,select,textarea')].map(control => [control, control.disabled]);
    for (const [control] of controls) control.disabled = true;
    studio.setAttribute('aria-busy', 'true');
    part('draft-status').textContent = 'Opslaan…';
    try {return await model[method](templateId);}
    finally {for (const [control, disabled] of controls) control.disabled = disabled; studio.removeAttribute('aria-busy'); refreshHeader();}
  }

  async function perform(action) {
    if (model.isSaving?.()) return;
    switch (action) {
      case 'back': onBack?.(); break;
      case 'history': openModal('history'); break;
      case 'preview': openModal('preview'); break;
      case 'add': openModal('add'); break;
      case 'publish': openModal('publish'); break;
      case 'save':
        try {
          await persist('saveDraft');
        } catch (error) {
          notify(error.message);
          break;
        }
        refreshHeader();
        notify('Concept opgeslagen.');
        onChange?.(templateId);
        break;
      case 'confirm-publish':
        try {
          await persist('publishDraft');
        } catch (error) {
          dialog.close();
          notify(error.message);
          break;
        }
        dialog.close();
        refreshHeader();
        notify(`Versie ${getTemplate().publishedVersion} gepubliceerd.`);
        onChange?.(templateId);
        break;
      case 'close-dialog': dialog.close(); break;
      case 'multi':
        multiMode = !multiMode;
        renderLayers();
        break;
      case 'clear-selection':
        setSelection([]);
        refresh();
        studio.querySelector('[data-action="multi"]')?.focus();
        break;
      case 'guides':
        guides = !guides;
        renderCanvas();
        break;
      case 'toggle-lock':
        updateLayers([...selectedIds], { locked: !selectedLayers().every(layer => layer.locked) },
          { rerenderInspector: true, rerenderLayers: true });
        break;
      case 'forward':
      case 'backward':
        model.reorderLayers(templateId, format, [...selectedIds], action === 'forward' ? 1 : -1);
        refresh();
        break;
      case 'group': {
        const group = model.groupLayers(templateId, format, [...selectedIds]);
        if (!group) break;
        collapsedGroups.delete(group.id);
        setSelection(group.layerIds, primaryId);
        refresh();
        notify('Lagen gegroepeerd.');
        break;
      }
      case 'ungroup':
        model.ungroupLayers(templateId, format, [...selectedIds]);
        refresh();
        notify('Groep opgeheven.');
        break;
      case 'remove':
        model.removeLayers(templateId, format, [...selectedIds]);
        setSelection(getLayers().filter(layer => !layer.required).slice(-1).map(layer => layer.id));
        refresh();
        break;
    }
  }

  bind(studio, 'click', (event) => {
    if (model.isSaving?.()) return;
    if (!(event.target instanceof Element)) return;
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.action) perform(target.dataset.action);
    const additive = multiMode || usesModifier(event);
    if (target.dataset.layer) chooseLayers([target.dataset.layer], { additive });
    if (target.dataset.group) {
      const groupId = target.dataset.group;
      chooseLayers(getGroup(getLayers(), groupId).map(layer => layer.id), { additive });
      [...part('layers').querySelectorAll('[data-group]')].find(button => button.dataset.group === groupId)
        ?.focus({ preventScroll: true });
    }
    if (target.dataset.collapse) {
      const groupId = target.dataset.collapse;
      if (collapsedGroups.has(groupId)) collapsedGroups.delete(groupId);
      else collapsedGroups.add(groupId);
      renderLayers();
      [...part('layers').querySelectorAll('[data-collapse]')].find(button => button.dataset.collapse === groupId)
        ?.focus({ preventScroll: true });
    }
    if (target.dataset.format && target.dataset.format !== format) {
      format = target.dataset.format;
      const layers = getLayers();
      const current = selectedLayers(layers);
      const fallback = layers.find(layer => !layer.locked) ?? layers.at(-1);
      setSelection(current.length ? current.map(layer => layer.id) : fallback ? [fallback.id] : [], primaryId);
      refresh();
    }
    if (target.dataset.tab) {
      inspectorTab = target.dataset.tab;
      renderInspector();
      part('inspector').scrollTop = 0;
    }
    if (target.dataset.addKind) addLayer(target.dataset.addKind, target.dataset.addBinding);
    if (target.dataset.version) openModal('preview', Number(target.dataset.version));
  });

  bind(studio, 'input', (event) => {
    const control = event.target;
    if (!(control instanceof HTMLInputElement) || control.type !== 'number' || !control.dataset.field || control.value === '') return;
    const property = control.dataset.field;
    if ((property === 'width' || property === 'height') && selectedIds.size > 1) return;
    const value = Number(control.value);
    if (Number.isFinite(value)) updateField(property, percentageFields.has(property) ? value / 100 : value);
  });

  bind(studio, 'change', (event) => {
    if (model.isSaving?.()) return;
    const control = event.target;
    if (!(control instanceof HTMLElement)) return;
    if (control.dataset.preview) {
      if (control.dataset.preview === 'scenario') scenarioId = control.value;
      if (control.dataset.preview === 'club') clubId = control.value;
      if (control.dataset.preview === 'format') previewFormat = control.value;
      renderPreviewArt();
      return;
    }
    if (control.dataset.groupName) {
      model.renameGroup(templateId, format, control.dataset.groupName, control.value);
      renderLayers();
      renderInspector();
      refreshHeader();
      return;
    }

    const property = control.dataset.field;
    if (!property) return;
    let value = control.value;
    if (control.type === 'checkbox') value = control.checked;
    if (control.type === 'number' || property === 'fontWeight') {
      if (value === '' || !Number.isFinite(Number(value))) {
        renderInspector();
        return;
      }
      value = Number(value);
    }
    if (property === 'binding' && !value) value = null;
    if (percentageFields.has(property)) value /= 100;
    updateField(property, value, true);
  });

  bind(viewport, 'pointerdown', (event) => {
    if (model.isSaving?.()) return;
    if (drag || event.button !== 0 || !(event.target instanceof Element)) return;
    const handle = event.target.closest('[data-resize-layer]');
    const hit = event.target.closest('[data-canvas-layer]');
    const layers = getLayers();
    const layer = layers.find(item => item.id === (hit?.dataset.canvasLayer ?? (handle ? primaryId : null)));
    if (!layer) {
      setSelection([]);
      refresh();
      return;
    }
    event.preventDefault();
    const additive = !handle && (multiMode || usesModifier(event));
    const members = !additive && layer.groupId ? getGroup(layers, layer.groupId) : [layer];
    if (!handle) chooseLayers(members.map(item => item.id), { additive, fromCanvas: true, preserve: true, preferred: layer.id });
    if (additive || (!handle && layer.locked)) return;
    const selection = selectedLayers(layers);
    const moving = geometryLayers(selection);
    if (!moving.length) return;

    const nativeLayers = new Map([...viewport.querySelectorAll('.cq-art-underlay [data-layer-id]')].map(node => [node.dataset.layerId, node]));
    const hitAreas = new Map([...viewport.querySelectorAll('[data-canvas-layer]')].map(node => [node.dataset.canvasLayer, node]));
    const selectionBoxes = new Map([...viewport.querySelectorAll('[data-selection-layer]')].map(node => [node.dataset.selectionLayer, node]));
    const entries = moving.map(item => {
      const nativeLayer = nativeLayers.get(item.id);
      const hitArea = hitAreas.get(item.id);
      return {
        layer: item, nativeLayer, nativeTransform: nativeLayer?.getAttribute('transform') ?? '',
        nativeViewBox: nativeLayer?.ownerSVGElement?.closest('.cq-art-underlay > svg')?.viewBox?.baseVal,
        box: selectionBoxes.get(item.id), hit: hitArea, text: hitArea?.querySelector('.cq-art-text'),
      };
    });
    const boundsBox = viewport.querySelector('.cq-selection-bounds');
    const radians = (boundsBox ? 0 : layer.rotation ?? 0) * Math.PI / 180;
    drag = {
      x: event.clientX, y: event.clientY, id: event.pointerId, moving,
      entries, boundsBox, radians, resize: Boolean(handle), bounds: layerBounds(moving), patches: new Map(),
      lastX: event.clientX, lastY: event.clientY,
    };
    viewport.setPointerCapture(event.pointerId);
  });

  function previewDrag(clientX, clientY, proportional) {
    drag.lastX = clientX;
    drag.lastY = clientY;
    const dimensions = FORMATS[format];
    const offsetX = (clientX - drag.x) / scale;
    const offsetY = (clientY - drag.y) / scale;
    if (Math.abs(offsetX) < 2 && Math.abs(offsetY) < 2 && !drag.patches.size) return;
    let patches;
    if (drag.resize) {
      const cosine = Math.cos(drag.radians);
      const sine = Math.sin(drag.radians);
      patches = resizeSelection(drag.moving, drag.bounds, dimensions, {
        offsetX: offsetX * cosine + offsetY * sine,
        offsetY: offsetY * cosine - offsetX * sine,
        proportional,
      });
    } else {
      const deltaX = boundedDelta(drag.moving, 'x', offsetX, dimensions.width * 2);
      const deltaY = boundedDelta(drag.moving, 'y', offsetY, dimensions.height * 2);
      patches = new Map(drag.moving.map(layer => [layer.id, { x: layer.x + deltaX, y: layer.y + deltaY }]));
    }
    for (const entry of drag.entries) {
      const { layer } = entry;
      const patch = patches.get(layer.id);
      const next = { ...layer, ...patch };
      if (entry.hit) positionLayer(entry.hit, next);
      if (entry.box) positionLayer(entry.box, next);
      if (drag.resize && entry.text) entry.text.style.fontSize = `${next.fontSize}px`;
      previewNativeTransform(entry, patch, dimensions, drag.resize);
    }
    drag.patches = patches;
    const bounds = layerBounds(drag.moving.map(layer => ({ ...layer, ...patches.get(layer.id) })));
    if (drag.boundsBox) positionLayer(drag.boundsBox, bounds);
    for (const key of drag.resize ? ['width', 'height'] : ['x', 'y']) {
      const field = part('inspector').querySelector(`[data-field="${key}"]`);
      if (field) field.value = bounds[key];
    }
  }

  bind(viewport, 'pointermove', (event) => {
    if (drag?.id === event.pointerId) previewDrag(event.clientX, event.clientY, event.shiftKey);
  });
  for (const type of ['keydown', 'keyup']) {
    bind(document, type, (event) => {
      if (drag?.resize && event.key === 'Shift' && !event.repeat) previewDrag(drag.lastX, drag.lastY, event.shiftKey);
    });
  }

  function finishDrag(event, commit) {
    if (!drag || drag.id !== event.pointerId) return;
    const { patches } = drag;
    drag = null;
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (commit && patches.size) updateLayers([...patches.keys()], layer => patches.get(layer.id), { rerenderInspector: true });
    if (!commit) {
      renderCanvas();
      renderInspector();
    }
    focusSelection(true);
  }

  bind(viewport, 'pointerup', (event) => finishDrag(event, true));
  bind(viewport, 'pointercancel', (event) => finishDrag(event, false));
  bind(viewport, 'lostpointercapture', (event) => finishDrag(event, false));
  bind(viewport, 'keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    const moving = geometryLayers(selectedLayers());
    if (!moving.length) return;
    event.preventDefault();
    const dimensions = FORMATS[format];
    const step = event.shiftKey ? 10 : 1;
    const offsetX = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const offsetY = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const deltaX = boundedDelta(moving, 'x', offsetX, dimensions.width * 2);
    const deltaY = boundedDelta(moving, 'y', offsetY, dimensions.height * 2);
    updateLayers(moving.map(layer => layer.id), layer => ({ x: layer.x + deltaX, y: layer.y + deltaY }), { rerenderInspector: true });
    focusSelection(true);
  });

  bind(dialog, 'close', () => {
    clearArt(part('dialog-art'));
    part('dialog-content').replaceChildren();
    modal = null;
    version = null;
    refresh();
  });
  bind(dialog, 'click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  const observer = new ResizeObserver(() => {
    if (viewport.firstElementChild) fitArt(viewport, viewport.firstElementChild, format);
    if (modal === 'preview') {
      const container = part('dialog-art');
      if (container?.firstElementChild) fitArt(container, container.firstElementChild, previewFormat, true);
    }
  });
  observer.observe(viewport);

  refresh();
  return () => {
    controller.abort();
    observer.disconnect();
    clearTimeout(noticeTimer);
    clearArt(viewport);
    clearArt(part('dialog-art'));
    if (dialog.open) dialog.close();
    studio.remove();
  };
}
