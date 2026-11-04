/** Club planning uses an explicit IANA zone, independently of the device's timezone. */
const defaultZone='Europe/Amsterdam';
type WallTime={year:number;month:number;day:number;hour:number;minute:number;second:number;millisecond:number};
const localPattern=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/;
const pad=(value:number,size=2)=>String(value).padStart(size,'0');

function formatter(timeZone:string){
 try{return new Intl.DateTimeFormat('en-GB',{timeZone,calendar:'iso8601',numberingSystem:'latn',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});}
 catch{throw new Error('De clubtijdzone is ongeldig. Laat de clubbeheerder een geldige tijdzone instellen.');}
}

function wallTimestamp(time:WallTime){
 const date=new Date(0);date.setUTCFullYear(time.year,time.month-1,time.day);date.setUTCHours(time.hour,time.minute,time.second,time.millisecond);return date.getTime();
}

function parseWall(value:string){
 if(typeof value!=='string'||!value.trim())throw new Error('Kies een datum en tijd voor de publicatie.');
 const match=localPattern.exec(value);if(!match)throw new Error('Gebruik een geldige datum en tijd, bijvoorbeeld 2026-11-07T10:30.');
 const time:WallTime={year:Number(match[1]),month:Number(match[2]),day:Number(match[3]),hour:Number(match[4]),minute:Number(match[5]),second:Number(match[6]||0),millisecond:Number((match[7]||'').padEnd(3,'0'))};
 const stamp=wallTimestamp(time),date=new Date(stamp);
 if(time.year<1||date.getUTCFullYear()!==time.year||date.getUTCMonth()+1!==time.month||date.getUTCDate()!==time.day||date.getUTCHours()!==time.hour||date.getUTCMinutes()!==time.minute||date.getUTCSeconds()!==time.second)throw new Error('Deze datum of tijd bestaat niet. Kies een geldige kalenderdatum en tijd.');
 return {time,stamp,offset:match[8]};
}

function wallAt(stamp:number,format:Intl.DateTimeFormat):WallTime {
 const parts:Record<string,number>={};for(const part of format.formatToParts(new Date(stamp)))if(['year','month','day','hour','minute','second'].includes(part.type))parts[part.type]=Number(part.value);
 return {...parts,millisecond:0} as WallTime;
}

function sameWall(a:WallTime,b:WallTime){return a.year===b.year&&a.month===b.month&&a.day===b.day&&a.hour===b.hour&&a.minute===b.minute&&a.second===b.second;}

/**
 * Convert a datetime-local value to an unambiguous ISO instant.
 * DST gaps and overlaps are rejected. An explicit offset resolves an overlap only
 * when that offset really belongs to the selected club timezone at that instant.
 */
export function parseClubLocalTime(value:string,timeZone=defaultZone):string {
 const {time,stamp,offset}=parseWall(value),format=formatter(timeZone);
 if(offset){
  const hours=offset==='Z'?0:Number(offset.slice(1,3)),minutes=offset==='Z'?0:Number(offset.slice(4,6));
  if(hours>23||minutes>59)throw new Error('De opgegeven tijdzone-offset is ongeldig.');
  const sign=offset[0]==='-'?-1:1,candidate=stamp-sign*(hours*60+minutes)*60000;
  if(!sameWall(time,wallAt(candidate,format)))throw new Error(`De opgegeven offset hoort niet bij deze tijd in ${timeZone}. Kies een geldige clubtijd.`);
  return new Date(candidate).toISOString();
 }
 // Obtain actual offsets on both sides of nearby transitions. This also supports
 // zones with 30/45-minute offsets or a 30-minute daylight-saving transition.
 const offsets=new Set<number>();
 for(let hours=-36;hours<=36;hours+=6){const probe=stamp+hours*3600000;offsets.add(wallTimestamp(wallAt(probe,format))-Math.floor(probe/1000)*1000);}
 const candidates=[...offsets].map(zoneOffset=>stamp-zoneOffset).filter(candidate=>sameWall(time,wallAt(candidate,format)));
 if(!candidates.length)throw new Error(`Deze tijd bestaat niet in ${timeZone} door de overgang naar zomertijd. Kies een ander tijdstip.`);
 if(candidates.length>1)throw new Error(`Deze tijd komt twee keer voor in ${timeZone} door de overgang naar wintertijd. Kies een tijdstip buiten dit dubbele uur of geef een expliciete geldige offset op.`);
 return new Date(candidates[0]).toISOString();
}

/** Format an ISO instant for a datetime-local input, to minute precision. */
export function formatClubTime(instant:string,timeZone=defaultZone):string {
 if(typeof instant!=='string'||!localPattern.test(instant)||!/(Z|[+-]\d{2}:\d{2})$/.test(instant))throw new Error('Een geldig opgeslagen tijdstip met tijdzone is vereist.');
 const {stamp,offset}=parseWall(instant),hours=offset==='Z'?0:Number(offset!.slice(1,3)),minutes=offset==='Z'?0:Number(offset!.slice(4,6));
 if(hours>23||minutes>59)throw new Error('Het opgeslagen tijdstip heeft een ongeldige offset.');
 const value=stamp-(offset![0]==='-'?-1:1)*(hours*60+minutes)*60000,time=wallAt(value,formatter(timeZone));
 return `${pad(time.year,4)}-${pad(time.month)}-${pad(time.day)}T${pad(time.hour)}:${pad(time.minute)}`;
}
