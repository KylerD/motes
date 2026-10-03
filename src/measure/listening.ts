import {localDay,validDay} from '../scenes/edition';

/** Minutes of audible music in one week that make a browser an engaged listener. */
export const ENGAGED_MINUTES=20;
/** Minutes into a visit worth reporting: settling in, engaged, and a full evening. */
export const MILESTONES=[5,20,60] as const;

/** The only listening history a browser keeps: this week's minutes and the week it first listened. */
export interface WeekRecord {week:string;minutes:number;sent:boolean;first:string}
export type ReturnBucket='0'|'1'|'2'|'3'|'4+';

/** The local Monday that begins the week containing a moment. */
export function weekOf(date:Date):string {
  return localDay(new Date(date.getFullYear(),date.getMonth(),date.getDate()-(date.getDay()+6)%7));
}

const utcDay=(day:string)=>{const [y,m,d]=day.split('-').map(Number);return Date.UTC(y,m-1,d);};

export function weeksSinceFirst(record:WeekRecord):ReturnBucket {
  const weeks=Math.max(0,Math.round((utcDay(record.week)-utcDay(record.first))/(7*86400000)));
  return weeks>=4?'4+':String(weeks) as ReturnBucket;
}

/** Adds audible minutes to the current week. `engaged` is true only on the update that crosses the threshold. */
export function addListening(record:WeekRecord|undefined,week:string,minutes:number):{record:WeekRecord;engaged:boolean} {
  const current=record?.week===week?record:{week,minutes:0,sent:false,first:record?.first??week};
  const next={...current,minutes:current.minutes+Math.max(0,minutes)};
  const engaged=!next.sent&&next.minutes>=ENGAGED_MINUTES;
  return {record:engaged?{...next,sent:true}:next,engaged};
}

export function parseWeek(stored:string|null):WeekRecord|undefined {
  try {
    const value=JSON.parse(stored??'');
    if(value&&typeof value==='object'&&validDay(value.week)&&validDay(value.first)&&typeof value.sent==='boolean'
      &&typeof value.minutes==='number'&&Number.isFinite(value.minutes)&&value.minutes>=0)
      return {week:value.week,minutes:value.minutes,sent:value.sent,first:value.first};
  } catch { /* An unreadable record starts again. */ }
  return undefined;
}

/** Milestones passed between two points in a visit, in order. */
export function crossed(before:number,after:number):number[] {
  return MILESTONES.filter(mark=>before<mark&&after>=mark);
}
