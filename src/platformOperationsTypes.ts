/** Platform operations carry no contribution payloads, media, players or personal registration details. */
export const jobGroups = ['failed','awaiting_confirmation','in_progress','paused','published','cancelled','other'] as const;
export type JobGroup = typeof jobGroups[number];
export type OperationalJob = {
  id:string; clubId:string; clubName:string; channel:string; status:string; group:JobGroup;
  revision:number; attempt:number; scheduledAt:string|null; confirmedAt:string|null;
  confirmation:'sandbox'|'provider'|null; providerMode:'demo'|'live'|'unknown';
};
export type JobOperations = {total:number; counts:Record<JobGroup,number>; items:OperationalJob[]; limit:number; truncated:boolean};
export type TemplateOperations = {total:number; active:number; drafts:number; recent:{id:string;name:string;version:number;publishedAt:string}[]};
export type OperationsData = {
  jobs:JobOperations;
  registrations:{total:number;pending:number};
  privacy:{open:number;nextDeadline:string|null};
  mail:{incidents:number};
  templates:TemplateOperations;
};
export type OperationsSource<T> = {status:'ok';data:T}|{status:'unavailable'};
export type PlatformOperations = {generatedAt:string;sources:{[K in keyof OperationsData]:OperationsSource<OperationsData[K]>}};
export const operationLabels:Record<keyof OperationsData,string> = {
  jobs:'kanaalopdrachten',registrations:'registraties',privacy:'privacyzaken',mail:'e-mail',templates:'templates',
};
export function jobGroup(status:string,confirmed:boolean):JobGroup {
  if(status==='published')return confirmed?'published':'awaiting_confirmation';
  if(['queued','scheduled','processing','running'].includes(status))return 'in_progress';
  return ['failed','awaiting_confirmation','paused','cancelled'].includes(status)?status as JobGroup:'other';
}
export const emptyJobCounts = ():Record<JobGroup,number> => ({failed:0,awaiting_confirmation:0,in_progress:0,paused:0,published:0,cancelled:0,other:0});
