import {describe,expect,it} from 'vitest';
import {addListening,crossed,expired,parseWeek,weekOf,weeksSinceFirst} from '../src/measure/listening';

describe('weekly engaged listening',()=>{
  it('keys a week by its local Monday',()=>{
    expect(weekOf(new Date(2026,9,3,23,30))).toBe('2026-09-28'); // Saturday
    expect(weekOf(new Date(2026,9,4,12))).toBe('2026-09-28');    // Sunday ends the week
    expect(weekOf(new Date(2026,9,5,0,5))).toBe('2026-10-05');   // Monday starts the next
  });
  it('becomes engaged once, when a week first reaches 20 minutes',()=>{
    let step=addListening(undefined,'2026-09-28',12);
    expect(step).toMatchObject({engaged:false,record:{week:'2026-09-28',minutes:12,first:'2026-09-28',sent:false}});
    step=addListening(step.record,'2026-09-28',9);
    expect(step.engaged).toBe(true);
    step=addListening(step.record,'2026-09-28',40);
    expect(step.engaged).toBe(false);
    expect(step.record.minutes).toBe(61);
  });
  it('starts each week afresh but remembers the first week',()=>{
    const old=addListening(undefined,'2026-09-14',30).record;
    const step=addListening(old,'2026-10-05',25);
    expect(step).toMatchObject({engaged:true,record:{week:'2026-10-05',minutes:25,first:'2026-09-14'}});
    expect(weeksSinceFirst(step.record)).toBe('3');
  });
  it('buckets return weeks as 0, 1, 2, 3 or 4+',()=>{
    for(const [week,bucket] of [['2026-09-28','0'],['2026-10-05','1'],['2026-10-26','4+'],['2027-03-01','4+']] as const)
      expect(weeksSinceFirst({first:'2026-09-28',week,minutes:0,sent:false})).toBe(bucket);
  });
  it('crosses daylight-saving changes as whole weeks',()=>{
    expect(weeksSinceFirst({first:'2026-10-19',week:'2026-10-26',minutes:0,sent:false})).toBe('1');
    expect(weeksSinceFirst({first:'2026-03-23',week:'2026-03-30',minutes:0,sent:false})).toBe('1');
  });
  it('expires thirteen months after the first week, without being extended',()=>{
    const record={week:'2027-10-25',minutes:3,sent:false,first:'2026-09-28'};
    expect(expired(record,'2027-10-25')).toBe(false);
    expect(expired(record,'2027-11-01')).toBe(true);
    // Listening every week doesn't move the first week, so the record still ends on time.
    expect(addListening(record,'2027-10-25',30).record.first).toBe('2026-09-28');
    const fresh=addListening(record,'2027-11-01',25);
    expect(fresh).toMatchObject({engaged:true,record:{week:'2027-11-01',minutes:25,first:'2027-11-01',sent:true}});
    expect(weeksSinceFirst(fresh.record)).toBe('0');
  });
  it('accepts only a well-formed stored week',()=>{
    expect(parseWeek(JSON.stringify({week:'2026-09-28',minutes:4.5,sent:false,first:'2026-09-21'}))).toEqual({week:'2026-09-28',minutes:4.5,sent:false,first:'2026-09-21'});
    for(const bad of [null,'','{','[]','{"week":"soon","minutes":1,"sent":false,"first":"2026-09-21"}','{"week":"2026-09-28","minutes":-1,"sent":false,"first":"2026-09-21"}','{"week":"2026-09-28","minutes":1,"sent":"no","first":"2026-09-21"}'])
      expect(parseWeek(bad)).toBeUndefined();
  });
});

describe('visit milestones',()=>{
  it('reports each milestone once, including several crossed while hidden',()=>{
    expect(crossed(0,4.9)).toEqual([]);
    expect(crossed(4.9,5)).toEqual([5]);
    expect(crossed(5,19)).toEqual([]);
    expect(crossed(3,75)).toEqual([5,20,60]);
  });
});
