import {api} from '../serverClient';
import {createStudio} from './studio-model.mjs';
import type {ManagedTemplate} from './managedTemplates';

type Library = {templates: ManagedTemplate[]; clubs: {id: string; name: string}[]};
/** Working edits are page memory; only acknowledged responses become saved state. */
export function createCentralTemplateStudio() {
  const core = createStudio(null, {templates: [], includeFixtures: false, clubs: []});
  let clubs: Library['clubs'] = [], pending = false;
  function latest(id: string) {const template = core.getTemplate(id); if (!template || !Number.isInteger(template.revision)) throw new Error('Herlaad de centrale bibliotheek.'); return template;}
  async function mutate(id: string, operation: string, extra = {}) {
    if (pending) throw new Error('Wacht tot de huidige templatehandeling klaar is.');
    const template = latest(id); pending = true;
    try {
      const response = await api<{template: ManagedTemplate}>(`/api/admin/templates/${encodeURIComponent(id)}`, {method: 'PATCH', body: JSON.stringify({operation, expectedRevision: template.revision, ...extra})});
      core.replaceTemplate(response.template);
      return response.template;
    } finally {pending = false;}
  }
  const layouts = (id: string) => Object.fromEntries(['4:5','9:16','1:1','16:9'].map(format => [format, core.getLayers(id, format)]));
  return Object.assign(core, {
    isSaving: () => pending,
    getClubs: () => clubs,
    async load() {const response = await api<Library>('/api/admin/templates'); clubs = response.clubs; core.replaceState(response); return response;},
    async createTemplate(input: unknown) {
      if (pending) throw new Error('Wacht tot de huidige templatehandeling klaar is.'); pending = true;
      try {const response = await api<{template: ManagedTemplate}>('/api/admin/templates', {method: 'POST', body: JSON.stringify(input)}); core.replaceTemplate(response.template); return response.template;}
      finally {pending = false;}
    },
    configureTemplate: (id: string, input: unknown) => mutate(id, 'configure', input as object),
    setEnabled: (id: string, enabled: boolean) => mutate(id, 'availability', {enabled}),
    saveDraft: async (id: string) => (await mutate(id, 'save-draft', {layouts: layouts(id)})).draft,
    publishDraft: async (id: string) => {const template = await mutate(id, 'publish', {layouts: layouts(id)}); return template.versions.find(version => version.number === template.publishedVersion);},
    discardDraft: (id: string) => mutate(id, 'discard-draft'),
    restoreVersionAsDraft: (id: string, number: number) => mutate(id, 'restore-version', {number}),
  });
}
