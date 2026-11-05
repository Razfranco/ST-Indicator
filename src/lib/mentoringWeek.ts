export function israelDateKey(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem'}).format(date)}
export function shiftDateKey(key:string,days:number){const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export function weekStartKey(date=new Date()){const key=israelDateKey(date);return shiftDateKey(key,-new Date(key+'T12:00:00Z').getUTCDay())}
