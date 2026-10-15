/* V9 browser-first conversion engines. No API or network requests.
   Shared namespace: every V9 engine file merges into the same GVTV9 global, so load order does not matter.
   This file owns the epoch / time engine (integer nanosecond arithmetic, Intl-based zone maths) and the CSS curve helper. */
(function(root,factory){const api=factory();if(typeof module==="object"&&module.exports)module.exports=api;else root.GVTV9=Object.assign(root.GVTV9||{},api);})(typeof self!=="undefined"?self:globalThis,function(){"use strict";

/* ---------- Epoch & time engine ----------
   An instant is held as a BigInt count of nanoseconds since 1970-01-01T00:00:00Z. JS Number (and Date) cannot hold
   microsecond or nanosecond epochs exactly, so Date is only used for calendar display, never for storage. */
const NS={s:1000000000n,ms:1000000n,us:1000n,ns:1n};
const UNIT_LABEL={s:"seconds",ms:"milliseconds",us:"microseconds",ns:"nanoseconds"};
const MAX_MS=8640000000000000n;            /* ECMAScript Date range: +/-8.64e15 ms */
const MAX_INPUT_LENGTH=64;
const DAY_NAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTH_NAMES=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const pad=(n,w=2)=>String(Math.abs(n)).padStart(w,"0");
const floorDiv=(a,b)=>{const q=a/b;return (a%b!==0n&&((a<0n)!==(b<0n)))?q-1n:q;};
const mod=(a,b)=>((a%b)+b)%b;
const absBig=a=>a<0n?-a:a;

function unitOf(unit){
  const u=String(unit==null?"ms":unit).toLowerCase();
  if(u==="auto")return"auto";
  if(!NS[u])throw Error("Invalid epoch unit. Use s, ms, us, ns or auto.");
  return u;
}
/* Heuristic only: picks the unit whose magnitude gives a plausible date. Shown to the user as a guess. */
function detectUnit(intDigits){
  const n=absBig(BigInt(intDigits||"0"));
  if(n<100000000000n)return"s";            /* < year 5138 in seconds */
  if(n<100000000000000n)return"ms";
  if(n<100000000000000000n)return"us";
  return"ns";
}
/* Exact decimal parse: "1700000000.123456789" -> nanoseconds, with no floating point involved. */
function parseEpoch(value,unit){
  const raw=String(value==null?"":value).trim();
  if(!raw)throw Error("Enter an epoch timestamp.");
  if(raw.length>MAX_INPUT_LENGTH)throw Error("Epoch input is too long.");
  const m=/^([+-])?(\d+)(?:\.(\d+))?$/.exec(raw.replace(/[_,\s]/g,""));
  if(!m)throw Error("Enter an epoch timestamp: digits with an optional decimal fraction (no exponent).");
  let u=unitOf(unit),guessed=false;
  if(u==="auto"){u=detectUnit(m[2]);guessed=true;}
  const frac=m[3]||"";
  let ns=BigInt(m[2])*NS[u];
  let truncated=false;
  if(frac){
    const scale=10n**BigInt(frac.length);
    const part=BigInt(frac)*NS[u];
    ns+=part/scale;
    truncated=part%scale!==0n;           /* fraction finer than 1 ns is cut, not rounded */
  }
  if(m[1]==="-")ns=-ns;
  checkRange(ns);
  return{ns,unit:u,guessed,truncated};
}
function checkRange(ns){
  const ms=floorDiv(ns,NS.ms);
  if(ms>MAX_MS||ms<-MAX_MS)throw Error("Timestamp outside the supported date range (about +/-275,000 years).");
}

/* ---------- Time zones ---------- */
const FALLBACK_ZONES=["UTC","Africa/Cairo","Africa/Johannesburg","Africa/Lagos","Africa/Nairobi","America/Anchorage","America/Argentina/Buenos_Aires","America/Bogota","America/Chicago","America/Denver","America/Halifax","America/Los_Angeles","America/Mexico_City","America/New_York","America/Sao_Paulo","America/Toronto","America/Vancouver","Asia/Bangkok","Asia/Dhaka","Asia/Dubai","Asia/Hong_Kong","Asia/Jakarta","Asia/Karachi","Asia/Kolkata","Asia/Manila","Asia/Seoul","Asia/Shanghai","Asia/Singapore","Asia/Tehran","Asia/Tokyo","Atlantic/Reykjavik","Australia/Adelaide","Australia/Perth","Australia/Sydney","Europe/Amsterdam","Europe/Berlin","Europe/Istanbul","Europe/Lisbon","Europe/London","Europe/Madrid","Europe/Moscow","Europe/Paris","Europe/Rome","Europe/Zurich","Pacific/Auckland","Pacific/Honolulu","Pacific/Kiritimati"];
function zoneList(){
  let list=[];
  try{if(typeof Intl.supportedValuesOf==="function")list=Intl.supportedValuesOf("timeZone");}catch(e){list=[];}
  if(!list.length)list=FALLBACK_ZONES.slice();
  if(list.indexOf("UTC")<0)list=["UTC"].concat(list);
  return list;
}
function localZone(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC";}catch(e){return"UTC";}}
const dtfCache=new Map();
function dtf(zone,key,opts){
  const k=zone+"|"+key;let f=dtfCache.get(k);
  if(!f){
    try{f=new Intl.DateTimeFormat(opts.timeZoneName?"en-US":"en-GB",Object.assign({timeZone:zone},opts));}
    catch(e){throw Error("Unknown time zone: "+zone);}
    dtfCache.set(k,f);
  }
  return f;
}
function assertZone(zone){dtf(zone,"check",{year:"numeric"});return zone;}
function utcDateFromFields(y,mo,d,h,mi,s){const dt=new Date(0);dt.setUTCFullYear(y,mo-1,d);dt.setUTCHours(h,mi,s,0);return dt.getTime();}
/* Wall-clock fields of an instant in a zone (years 1..9999 only: Intl reports BCE years with an era). */
function fieldsAt(ms,zone){
  const f=dtf(zone,"fields",{hourCycle:"h23",year:"numeric",month:"numeric",day:"numeric",hour:"numeric",minute:"numeric",second:"numeric"});
  const o={};for(const p of f.formatToParts(new Date(ms)))if(p.type!=="literal")o[p.type]=Number(p.value);
  return o;
}
/* Offset from UTC in minutes (can be fractional for historic LMT) at an instant, or null when out of the supported years. */
function offsetMinutes(ms,zone){
  if(zone==="UTC")return 0;
  const yr=new Date(ms).getUTCFullYear();
  if(yr<1||yr>9999)return null;
  const p=fieldsAt(ms,zone);
  const wall=utcDateFromFields(p.year,p.month,p.day,p.hour===24?0:p.hour,p.minute,p.second);
  return (wall-Math.floor(ms/1000)*1000)/60000;
}
function formatOffset(min,colon=true){
  if(min==null)return"";
  const sign=min<0?"-":"+",a=Math.abs(min),h=Math.floor(a/60),m=Math.floor(a%60),s=Math.round((a-Math.floor(a))*60);
  return sign+pad(h)+(colon?":":"")+pad(m)+(s?(colon?":":"")+pad(s):"");
}
/* Daylight-saving flag: the offset is larger than the smaller of the January and July offsets of that year (a heuristic:
   zones with negative DST such as Europe/Dublin are reported by tzdata the other way round). */
function isDst(ms,zone){
  const off=offsetMinutes(ms,zone);if(off==null)return null;
  const y=new Date(ms).getUTCFullYear();
  const a=offsetMinutes(utcDateFromFields(y,1,1,12,0,0),zone),b=offsetMinutes(utcDateFromFields(y,7,1,12,0,0),zone);
  if(a==null||b==null||a===b)return false;
  return off>Math.min(a,b);
}

/* ---------- Rendering ---------- */
function msOf(ns){return Number(floorDiv(ns,NS.ms));}
function isoPrecise(ns){
  const ms=msOf(ns),rest=mod(ns,NS.ms);       /* nanoseconds within the millisecond */
  const iso=new Date(ms).toISOString();         /* ...T..:..:..mmmZ */
  return iso.replace(/\.(\d{3})Z$/,(_,m)=>"."+m+String(rest).padStart(6,"0")+"Z");
}
function decimalSeconds(ns){
  const neg=ns<0n,a=absBig(ns),s=a/NS.s,f=String(a%NS.s).padStart(9,"0").replace(/0+$/,"");
  return(neg?"-":"")+s+(f?"."+f:"");
}
function unitValue(ns,u){return(floorDiv(ns,NS[u])).toString();}
function zoneRow(ns,zone,refDay){
  const ms=msOf(ns),date=new Date(ms);
  const long=dtf(zone,"long",{dateStyle:"full",timeStyle:"long",hourCycle:"h23"}).format(date);
  const off=offsetMinutes(ms,zone);
  let abbr="";try{abbr=(dtf(zone,"abbr",{timeZoneName:"short"}).formatToParts(date).find(p=>p.type==="timeZoneName")||{}).value||"";}catch(e){}
  const row={zone,value:long,offsetMinutes:off,offset:off==null?"":formatOffset(off),abbr,dst:isDst(ms,zone)};
  if(off!=null){
    const p=fieldsAt(ms,zone),h=p.hour===24?0:p.hour;
    const frac=String(mod(ns,NS.s)).padStart(9,"0");
    row.date=p.year+"-"+pad(p.month)+"-"+pad(p.day);
    row.time=pad(h)+":"+pad(p.minute)+":"+pad(p.second);
    row.rfc3339=pad(p.year,4)+"-"+pad(p.month)+"-"+pad(p.day)+"T"+pad(h)+":"+pad(p.minute)+":"+pad(p.second)+"."+frac.slice(0,3)+(zone==="UTC"?"Z":formatOffset(off));
    row.weekday=DAY_NAMES[new Date(utcDateFromFields(p.year,p.month,p.day,0,0,0)).getUTCDay()];
    row.dayNumber=Math.floor(utcDateFromFields(p.year,p.month,p.day,0,0,0)/86400000);
    row.dayDelta=refDay==null?0:row.dayNumber-refDay;
  }
  return row;
}
/* Common log / interchange formats for one instant (UTC unless a zone is given). */
function formats(ns,zone){
  zone=zone||"UTC";
  const ms=msOf(ns),date=new Date(ms),off=offsetMinutes(ms,zone);
  const out={
    "Unix seconds":decimalSeconds(ns),
    "Unix milliseconds":unitValue(ns,"ms"),
    "Unix microseconds":unitValue(ns,"us"),
    "Unix nanoseconds":ns.toString(),
    "ISO 8601 (UTC)":isoPrecise(ns),
    "RFC 2822 (UTC)":date.toUTCString().replace("GMT","+0000"),
    "HTTP date (UTC)":date.toUTCString(),
    "Excel / Sheets serial (UTC)":(Number(floorDiv(ns,1000n))/86400000000+25569).toFixed(9),
    "Windows FILETIME":(floorDiv(ns,100n)+116444736000000000n).toString(),
    ".NET ticks":(floorDiv(ns,100n)+621355968000000000n).toString(),
    "Chrome/WebKit time (µs since 1601)":(floorDiv(ns,1000n)+11644473600000000n).toString()
  };
  if(off!=null){
    const p=fieldsAt(ms,zone),h=p.hour===24?0:p.hour;
    out["Apache/Nginx CLF ("+zone+")"]="["+pad(p.day)+"/"+MONTH_NAMES[p.month-1]+"/"+p.year+":"+pad(h)+":"+pad(p.minute)+":"+pad(p.second)+" "+formatOffset(off,false)+"]";
    out["Syslog ("+zone+", no year)"]=MONTH_NAMES[p.month-1]+" "+String(p.day).padStart(2," ")+" "+pad(h)+":"+pad(p.minute)+":"+pad(p.second);
  }
  return out;
}
function checkZones(zones){
  if(!Array.isArray(zones))throw Error("zones must be a list of IANA time-zone names.");
  if(zones.length>24)throw Error("Choose at most 24 time zones.");
  return zones.map(z=>assertZone(String(z).trim()));
}
function describe(ns,zones,extra){
  zones=checkZones(zones&&zones.length?zones:["UTC"]);
  const ms=msOf(ns),refRow=zoneRow(ns,zones[0],null);
  const refDay=refRow.dayNumber;
  return Object.assign({
    iso:new Date(ms).toISOString(),
    isoPrecise:isoPrecise(ns),
    milliseconds:floorDiv(ns,NS.ms).toString(),
    nanoseconds:ns.toString(),
    seconds:decimalSeconds(ns),
    units:{s:unitValue(ns,"s"),ms:unitValue(ns,"ms"),us:unitValue(ns,"us"),ns:ns.toString()},
    zones:zones.map(z=>zoneRow(ns,z,refDay)),
    formats:formats(ns,zones[0])
  },extra||{});
}
/* epoch(value, unit = "ms", zones = ["UTC"])  ->  a full description of the instant.
   Existing V9 callers keep working: iso, milliseconds and zones[].value are unchanged. */
function epoch(value,unit="ms",zones=["UTC"]){
  const r=parseEpoch(value,unit);
  const ms=msOf(r.ns);
  if(new Date(ms).toString()==="Invalid Date")throw Error("Timestamp outside the supported date range (about +/-275,000 years).");
  return describe(r.ns,zones,{unit:r.unit,unitLabel:UNIT_LABEL[r.unit],unitGuessed:r.guessed,truncated:r.truncated});
}

/* ---------- Parsing date/time text ---------- */
const MONTHS=Object.fromEntries(MONTH_NAMES.map((m,i)=>[m.toLowerCase(),i+1]));
const ZONE_ABBR={z:0,ut:0,utc:0,gmt:0,est:-300,edt:-240,cst:-360,cdt:-300,mst:-420,mdt:-360,pst:-480,pdt:-420};
function offsetToken(tok){
  if(tok==null||tok==="")return null;
  const t=String(tok).trim().toLowerCase();
  if(t in ZONE_ABBR)return ZONE_ABBR[t];
  const m=/^([+-])(\d{2})(?::?(\d{2}))?$/.exec(t);
  if(!m)return undefined;
  const mins=Number(m[2])*60+Number(m[3]||0);
  if(Number(m[2])>23||Number(m[3]||0)>59)return undefined;
  return(m[1]==="-"?-1:1)*mins;
}
function validDate(y,mo,d,h,mi,s){
  if(mo<1||mo>12||d<1||d>31||h>23||mi>59||s>60)return false;
  const t=new Date(utcDateFromFields(y,mo,d,0,0,0));
  return t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d;
}
/* Wall-clock time in a zone -> UTC milliseconds. Reports DST gaps (time never happened) and overlaps (happened twice). */
function wallToUtc(y,mo,d,h,mi,s,zone){
  const guess=utcDateFromFields(y,mo,d,h,mi,s);
  if(zone==="UTC")return{ms:guess,status:"ok"};
  const cand=new Set();
  for(const delta of[-86400000,0,86400000]){const o=offsetMinutes(guess+delta,zone);if(o!=null)cand.add(o);}
  const valid=[];
  for(const o of cand){const t=guess-o*60000;if(offsetMinutes(t,zone)===o)valid.push(t);}
  valid.sort((a,b)=>a-b);
  if(valid.length===1)return{ms:valid[0],status:"ok"};
  if(valid.length>1)return{ms:valid[0],status:"ambiguous",alternatives:valid};
  const before=offsetMinutes(guess-86400000,zone);
  return{ms:guess-(before==null?0:before)*60000,status:"gap"};
}
function nsFromParts(y,mo,d,h,mi,s,fracDigits,offMin,zone){
  if(!validDate(y,mo,d,h,mi,s))throw Error("That calendar date or time does not exist.");
  const fracNs=fracDigits?BigInt((fracDigits+"000000000").slice(0,9)):0n;
  let ms,status="ok",note="";
  if(offMin!=null){ms=utcDateFromFields(y,mo,d,h,mi,s)-offMin*60000;}
  else{
    const w=wallToUtc(y,mo,d,h,mi,s,zone);ms=w.ms;status=w.status;
    if(status==="ambiguous")note="This wall-clock time occurs twice in "+zone+" (clocks go back); the earlier occurrence is used.";
    if(status==="gap")note="This wall-clock time does not exist in "+zone+" (clocks go forward); it was moved ahead by the DST gap.";
  }
  const ns=BigInt(ms)*NS.ms+fracNs;
  checkRange(ns);
  return{ns,status,note};
}
/* parseInstant(text, {zone, unit}) accepts: epoch numbers (auto unit by default), ISO 8601 / RFC 3339 (with or without
   an offset), RFC 2822 / HTTP dates and Apache CLF timestamps. Text without an offset is read in `zone`.
   There is deliberately no Date.parse fallback: its behaviour for non-ISO text differs between browsers. */
function parseInstant(text,opts){
  opts=opts||{};
  const zone=assertZone(opts.zone||"UTC");
  const raw=String(text==null?"":text).trim().replace(/^\[|\]$/g,"").trim();
  if(!raw)throw Error("Enter a timestamp or date to convert.");
  if(raw.length>200)throw Error("Input is too long.");
  if(/^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(raw))throw Error("Exponent notation is not accepted because it loses digits. Write the full number.");
  if(/^[+-]?[\d_,.\s]+$/.test(raw)&&/\d/.test(raw)){
    const r=parseEpoch(raw,opts.unit||"auto");
    return{ns:r.ns,kind:"epoch "+r.unit+(r.guessed?" (unit guessed from size)":""),status:"ok",note:r.truncated?"Digits beyond nanoseconds were cut off.":""};
  }
  let m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ]\s*(\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?\s*(Z|z|[+-]\d{2}(?::?\d{2})?)?)?$/.exec(raw);
  if(m){
    const off=m[8]!=null?offsetToken(m[8]):null;
    const r=nsFromParts(+m[1],+m[2],+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0),m[7],off,zone);
    r.kind=m[8]!=null?"ISO 8601 with offset":"ISO 8601 read in "+zone;return r;
  }
  m=/^(\d{1,2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s+([+-]\d{4})$/.exec(raw);
  if(m){
    const mo=MONTHS[m[2].toLowerCase()];if(!mo)throw Error("Unknown month name in log timestamp.");
    const r=nsFromParts(+m[3],mo,+m[1],+m[4],+m[5],+m[6],"",offsetToken(m[7]),zone);r.kind="Apache/Nginx CLF";return r;
  }
  m=/^(?:[A-Za-z]{3},?\s+)?(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([A-Za-z]{1,4}|[+-]\d{4})?$/.exec(raw);
  if(m){
    const mo=MONTHS[m[2].toLowerCase()];if(!mo)throw Error("Unknown month name.");
    const off=m[7]!=null?offsetToken(m[7]):null;
    if(off===undefined)throw Error("Unrecognised zone token: "+m[7]+". Use GMT, UTC, a US zone abbreviation or +hhmm.");
    const r=nsFromParts(+m[3],mo,+m[1],+m[4],+m[5],+(m[6]||0),"",off,zone);r.kind="RFC 2822 / HTTP date";return r;
  }
  throw Error("Unrecognised format. Use an epoch number, ISO 8601 (2024-03-31T01:30:00+01:00), RFC 2822, HTTP date or Apache CLF.");
}
function fromText(text,opts){
  opts=opts||{};
  const p=parseInstant(text,opts);
  return describe(p.ns,opts.zones||["UTC"],{kind:p.kind,status:p.status,note:p.note,unit:undefined});
}
/* Finds the first timestamp-looking token in a log line (ISO 8601, Apache CLF, RFC 2822 / HTTP date, then a 9-19 digit epoch). */
const LINE_PATTERNS=[
  /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:[.,]\d+)?)?(?:\s?(?:Z|[+-]\d{2}(?::?\d{2})?))?/,
  /\d{1,2}\/[A-Za-z]{3}\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4}/,
  /(?:[A-Za-z]{3},\s+)?\d{1,2} [A-Za-z]{3} \d{4} \d{2}:\d{2}(?::\d{2})?(?: (?:GMT|UTC|UT|Z|[ECMP][SD]T|[+-]\d{4}))?/,
  /\d{4}-\d{2}-\d{2}(?![\d:])/,
  /(?<![\d.])\d{9,19}(?:\.\d{1,9})?(?![\d.])/
];
function findInLine(line){
  const s=String(line==null?"":line);
  for(const re of LINE_PATTERNS){const m=re.exec(s);if(m)return m[0].trim();}
  return null;
}
/* Signed difference between two instants with an exact, human-readable breakdown (no calendar months: fixed units only). */
function diff(nsA,nsB){
  const d=BigInt(nsB)-BigInt(nsA),a=absBig(d);
  const parts=[["d",86400n*NS.s],["h",3600n*NS.s],["m",60n*NS.s],["s",NS.s]];
  let rest=a;const bits=[];
  for(const[u,n]of parts){const q=rest/n;rest%=n;if(q>0n)bits.push(q+u);}
  if(rest>0n||!bits.length){bits.push((rest/NS.ms)+"ms"+(rest%NS.ms?" "+(rest%NS.ms)+"ns":""));}
  return{nanoseconds:d.toString(),milliseconds:(d/NS.ms).toString(),seconds:decimalSeconds(d),text:(d<0n?"-":"")+bits.join(" "),direction:d>0n?"later":d<0n?"earlier":"same"};
}

/* ---------- CSS curve helper (unchanged API) ---------- */
function bezier(x1,y1,x2,y2){const a=[x1,y1,x2,y2].map(Number);if(a.some(n=>!Number.isFinite(n))||a[0]<0||a[0]>1||a[2]<0||a[2]>1)throw Error("X coordinates must be between 0 and 1; all values must be finite.");return "cubic-bezier("+a.join(", ")+")";}

return{epoch,bezier,findInLine,parseEpoch,parseInstant,fromText,describe,diff,formats,zoneList,localZone,offsetMinutes,isDst,detectUnit,wallToUtc,isoPrecise};});
