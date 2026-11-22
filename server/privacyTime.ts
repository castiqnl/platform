/** UTC elapsed days; calendar months clamp to the last day of the target month. */
export const DAY_MS=86_400_000;
export const RETENTION_RULE_VERSION='2026-11-22.1';
export const RETENTION_DAYS={registration:7,selfDeletion:30,inactivity:90,backup:180,evidence:210} as const;
export function validInstant(value:string|Date){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('Ongeldig UTC-tijdstip.');return date;}
export function afterDays(value:string|Date,days:number){return new Date(validInstant(value).getTime()+days*DAY_MS).toISOString();}
export function afterMonths(value:string|Date,months:number){const source=validInstant(value),result=new Date(source);result.setUTCDate(1);result.setUTCMonth(source.getUTCMonth()+months);const last=new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate();result.setUTCDate(Math.min(source.getUTCDate(),last));return result.toISOString();}
export function accountDeadline(account:any):string|null{
 if(account.status==='deletion_pending'||account.status==='deleting')return account.deletion_due_at?new Date(account.deletion_due_at).toISOString():null;
 if(account.status==='registration_pending')return afterDays(account.registration_started_at,RETENTION_DAYS.registration);
 if(account.status!=='active')return null;
 const anchor=account.reliable_activity?(account.last_conscious_at||account.registration_completed_at):account.transition_announced_at&&account.transition_start_at;
 return anchor?afterDays(anchor,RETENTION_DAYS.inactivity):null;
}
export function warningOffsets(deadline:string,now:string){const remaining=validInstant(deadline).getTime()-validInstant(now).getTime();return [14,3].filter(days=>remaining>0&&remaining<=days*DAY_MS);}
export function displayAmsterdam(value:string){return new Intl.DateTimeFormat('nl-NL',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Amsterdam'}).format(validInstant(value));}
