// US releases that move gold, EUR/USD and crypto. Times are UTC; `high` releases pause the AI agent around them.
// Update this list from the official schedules (BLS, Federal Reserve) before the last date passes.
export const CALENDAR=Object.freeze([
  {at:'2026-10-14T12:30:00Z',name:'Inflation CPI · septembre',url:'https://www.bls.gov/schedule/2026/10_sched_list.htm',source:'BLS',high:true},
  {at:'2026-10-15T12:30:00Z',name:'Inflation PPI · septembre',url:'https://www.bls.gov/schedule/2026/10_sched_list.htm',source:'BLS'},
  {at:'2026-10-28T18:00:00Z',name:'Décision de la Fed · FOMC',url:'https://www.federalreserve.gov/newsevents/2026-october.htm',source:'Federal Reserve',high:true},
  {at:'2026-10-30T12:30:00Z',name:'Coût de l’emploi · T3',url:'https://www.bls.gov/schedule/2026/10_sched_list.htm',source:'BLS'},
  {at:'2026-11-03T15:00:00Z',name:'Offres d’emploi JOLTS · septembre',url:'https://www.bls.gov/schedule/2026/11_sched_list.htm',source:'BLS'},
  {at:'2026-11-06T13:30:00Z',name:'Emploi américain · octobre',url:'https://www.bls.gov/schedule/2026/11_sched_list.htm',source:'BLS',high:true},
  {at:'2026-11-10T13:30:00Z',name:'Inflation CPI · octobre',url:'https://www.bls.gov/schedule/2026/11_sched_list.htm',source:'BLS',high:true},
  {at:'2026-11-13T13:30:00Z',name:'Inflation PPI · octobre',url:'https://www.bls.gov/schedule/2026/11_sched_list.htm',source:'BLS'},
  {at:'2026-12-04T13:30:00Z',name:'Emploi américain · novembre (date à confirmer)',url:'https://www.bls.gov/schedule/2026/12_sched_list.htm',source:'BLS',high:true},
  {at:'2026-12-09T19:00:00Z',name:'Décision de la Fed · FOMC',url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',source:'Federal Reserve',high:true}
]);
export const NEWS_WINDOW_MS=30*60000;
// The high-impact release within 30 minutes of `now`, before or after.
export function newsWindow(now=Date.now(),calendar=CALENDAR){
  return calendar.find(e=>e.high&&Math.abs(Date.parse(e.at)-now)<=NEWS_WINDOW_MS)||null;
}
// The next high-impact release before `until`, to warn about a plan that is still open when it lands.
export function nextNews(now,until,calendar=CALENDAR){
  return calendar.filter(e=>e.high&&Date.parse(e.at)>now&&Date.parse(e.at)-NEWS_WINDOW_MS<until).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0]||null;
}
