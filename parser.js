// parser.js — turns free-form text into a calendar event.
// No dependencies. Handles things like:
//   "Lunch with Sam tomorrow at noon at Blue Bottle"
//   "Team sync Fri 3-4:30pm in Room 204"
//   "Dentist Nov 12, 2026 at 9:15am for 45 min"
//   "Book club next Thursday 7pm @ Maya's place"
//   "Offsite 12/3 – all day"

const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WD = '(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)';
const MER = '(?:a\\.?m\\.?|p\\.?m\\.?)';
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WEEKDAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const WORD_NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const FULL_WD = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/i;
const END = '(?=\\s*(?:[,.;!?()\\n|]|\\s(?:on|at|from|for|with|to|until|between)\\s|$))';

const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

function to24(hStr, mStr, mer, eveningHint) {
  let h = +hStr;
  const min = +(mStr || 0);
  if (mer) {
    const pm = /p/i.test(mer);
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  } else if (!/^0/.test(hStr) && h < 12 && (eveningHint || (h >= 1 && h <= 7))) {
    h += 12; // "at 7" almost always means 7pm; "tonight at 9" means 9pm
  }
  return h * 60 + min;
}

export function parseEvent(input, now = new Date()) {
  const original = (input || '').trim();
  let s = ' ' + original.replace(/[ \t\u00a0]+/g, ' ').replace(/\r/g, '') + ' ';
  s = s.replace(/\bnoon\b/gi, '12pm').replace(/\bmidnight\b/gi, '12am');

  // Find a match, optionally vet it, then cut it out of the working string.
  const take = (re, accept = () => true) => {
    const m = re.exec(s);
    if (!m || !accept(m)) return null;
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
    return m;
  };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = null;          // Date at local midnight
  let dateIsRelative = false;
  let evening = false;
  let m;

  // --- URLs (kept for details; a meeting link can serve as the location)
  const urls = [];
  while ((m = take(/https?:\/\/[^\s)>\]]+/i))) urls.push(m[0].replace(/[.,;]+$/, ''));

  // --- Labelled location ("Where: ...", "Location: ...")
  let location = '';
  if ((m = take(/\b(?:location|where|venue|place|address)\s*:\s*([^\n|]+)/i))) location = m[1].trim();

  // --- Absolute dates
  const mkDate = (y, mo, d, explicitYear) => {
    let x = new Date(y, mo, d);
    if (!explicitYear && x < today) x = new Date(y + 1, mo, d); // "Mar 3" in November = next March
    return x;
  };
  const wdPrefix = `(?:(?:on\\s+)?${WD}\\.?,?\\s+)?(?:on\\s+)?(?:the\\s+)?`;

  if ((m = take(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    date = new Date(+m[1], +m[2] - 1, +m[3]);
  } else if ((m = take(new RegExp(`\\b${wdPrefix}(?<mon>${MON})\\.?\\s+(?<day>\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?!\\s*(?:${MER}|:))(?:,?\\s+(?<year>\\d{4}))?\\b`, 'i')))) {
    const g = m.groups;
    date = mkDate(g.year ? +g.year : now.getFullYear(), MONTHS[g.mon.slice(0, 3).toLowerCase()], +g.day, !!g.year);
  } else if ((m = take(new RegExp(`\\b${wdPrefix}(?<day>\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(?<mon>${MON})\\.?(?:,?\\s+(?<year>\\d{4}))?\\b`, 'i')))) {
    const g = m.groups;
    date = mkDate(g.year ? +g.year : now.getFullYear(), MONTHS[g.mon.slice(0, 3).toLowerCase()], +g.day, !!g.year);
  } else if ((m = take(new RegExp(`\\b${wdPrefix}(?<a>\\d{1,2})\\/(?<b>\\d{1,2})(?:\\/(?<year>\\d{2,4}))?\\b`, 'i')))) {
    let { a, b, year } = m.groups;
    let mo = +a, d = +b;
    if (mo > 12) [mo, d] = [d, mo]; // 25/12 → day-first
    let y = year ? +year : now.getFullYear();
    if (y < 100) y += 2000;
    date = mkDate(y, mo - 1, d, !!year);
  } else if ((m = take(/\b(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)\b/i))) {
    let x = new Date(now.getFullYear(), now.getMonth(), +m[1]);
    if (x < today) x = new Date(now.getFullYear(), now.getMonth() + 1, +m[1]);
    date = x;
  }

  // --- Relative dates
  if (!date) {
    if ((m = take(/\b(?:the\s+)?day after tomorrow\b/i))) date = addDays(today, 2);
    else if ((m = take(/\b(?:tomorrow|tmrw|tmr|tmw)(?:\s+(morning|afternoon|evening|night))?\b/i))) {
      date = addDays(today, 1);
      evening = /evening|night/i.test(m[1] || '');
    } else if ((m = take(/\b(?:today|tonight|this (?:morning|afternoon|evening))\b/i))) {
      date = today;
      evening = /tonight|evening/i.test(m[0]);
    } else if ((m = take(/\bin\s+(\d+|an?|one|two|three|four|five|six)\s+(days?|weeks?)\b/i))) {
      const n = WORD_NUM[m[1].toLowerCase()] ?? +m[1];
      date = addDays(today, /week/i.test(m[2]) ? n * 7 : n);
    } else if ((m = take(/\bnext week\b/i))) date = addDays(today, 7);
    if (date) dateIsRelative = true;
  }

  // Weekday words: used as the date if we have none, stripped from the title either way.
  // Abbreviations ("sat", "sun") must be capitalised so "we sat in the sun" isn't a date.
  const wdRe = new RegExp(`\\b(?:(?<mod>next|this|coming|on)\\s+)?(?<wd>${WD})\\.?(?![a-z])`, 'i');
  const wdOk = (x) => FULL_WD.test(x.groups.wd) || /^[A-Z]/.test(x.groups.wd);
  while ((m = take(wdRe, wdOk))) {
    if (date) continue;
    const target = WEEKDAYS[m.groups.wd.slice(0, 3).toLowerCase()];
    let diff = (target - today.getDay() + 7) % 7;
    if (diff === 0 && /next/i.test(m.groups.mod || '')) diff = 7;
    date = addDays(today, diff);
    dateIsRelative = true;
  }

  // --- Times
  let startMin = null, endMin = null;
  const rangeRe = new RegExp(`(?:\\b(?:from|between)\\s+)?\\b(?<h1>\\d{1,2})(?::(?<m1>\\d{2}))?\\s*(?<p1>${MER})?\\s*(?:-|–|—|to|until|till|and)\\s*(?<h2>\\d{1,2})(?::(?<m2>\\d{2}))?\\s*(?<p2>${MER})?(?![a-z0-9])`, 'i');
  if ((m = take(rangeRe, (x) => { const g = x.groups; return (g.p1 || g.p2 || g.m1 || g.m2) && +g.h1 <= 23 && +g.h2 <= 23; }))) {
    const g = m.groups;
    if (g.p1 && !g.p2) {
      startMin = to24(g.h1, g.m1, g.p1);
      endMin = to24(g.h2, g.m2, null, startMin >= 12 * 60);
    } else {
      endMin = to24(g.h2, g.m2, g.p2, evening);
      startMin = to24(g.h1, g.m1, g.p1 || g.p2, evening);
      if (!g.p1 && g.p2 && startMin > endMin) startMin = to24(g.h1, g.m1, /p/i.test(g.p2) ? 'am' : 'pm');
    }
  } else if ((m = take(new RegExp(`(?:(?:\\bat|@)\\s*)?\\b(?<h>\\d{1,2})(?::(?<m>\\d{2}))?\\s*(?<p>${MER})(?![a-z])`, 'i'), (x) => +x.groups.h <= 12))) {
    startMin = to24(m.groups.h, m.groups.m, m.groups.p);
  } else if ((m = take(/(?:(?:\bat|@)\s*)?\b(?<h>[01]?\d|2[0-3]):(?<m>[0-5]\d)\b/))) {
    startMin = to24(m.groups.h, m.groups.m, null, evening);
  } else if ((m = take(/(?:\bat|@)\s*(?<h>\d{1,2})(?![\d:\/%a-z])/i, (x) => +x.groups.h >= 1 && +x.groups.h <= 12))) {
    startMin = to24(m.groups.h, null, null, evening);
  }

  // --- Duration ("for 2 hours", "for 45 min", "for an hour")
  let durationMin = null;
  if ((m = take(/\bfor\s+(?<n>\d+(?:\.\d+)?|an?|one|two|three|half an?)\s*(?<u>hours?|hrs?|h|minutes?|mins?|m)(?![a-z])/i))) {
    const raw = m.groups.n.toLowerCase();
    const n = raw.startsWith('half') ? 0.5 : (WORD_NUM[raw] ?? parseFloat(raw));
    durationMin = Math.round(/^h/i.test(m.groups.u) ? n * 60 : n);
  }
  take(/\ball[\s-]day\b/i); // explicit "all day" — no time is the same thing

  // --- Location ("at Blue Bottle", "@ Maya's", "in Room 204")
  if (!location) {
    if ((m = take(new RegExp(`(?:\\bat|@)\\s+(?<loc>(?:the\\s+)?[A-Z0-9][^,.;!?()\\n|]*?)${END}`)))) location = m.groups.loc.trim();
    else if ((m = take(new RegExp(`\\bin\\s+(?<loc>(?:the\\s+)?(?:room|conference|building|bldg|suite|office|hall|library|auditorium|lobby|studio)\\b[^,.;!?()\\n|]*?)${END}`, 'i')))) location = m.groups.loc.trim();
  }
  const meetLink = urls.find((u) => /zoom\.us|meet\.google|teams\.microsoft|webex/i.test(u));
  if (!location && meetLink) location = meetLink;

  // --- Title: first non-empty leftover line, tidied
  s = s.replace(/\b(?:when|date|time|title|event|subject)\s*:/gi, ' ');
  const tidy = (t) => {
    let prev;
    t = t.replace(/\s+/g, ' ').replace(/\(\s*[,;-]?\s*\)/g, '').replace(/\s+([,.;:!?])/g, '$1');
    do {
      prev = t;
      t = t.replace(/^[\s,.;:\-–—|·]+|[\s,;:\-–—|·]+$/g, '')
           .replace(/(?:^|\s)(?:on|at|from|to|for|until|this|next|the|in|between|by|and|@)$/i, '')
           .replace(/^(?:on|at|from|for|and)\s+/i, '');
    } while (t !== prev);
    return t;
  };
  let title = s.split('\n').map(tidy).find(Boolean) || 'New event';
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // --- Resolve start/end
  let base = date || today;
  const allDay = startMin == null;
  let start, end;
  if (allDay) {
    start = new Date(base);
    end = addDays(start, 1); // Google all-day end date is exclusive
  } else {
    start = new Date(base);
    start.setMinutes(startMin);
    if (!date && start < now) { start = addDays(start, 1); } // bare "3pm" that already passed → tomorrow
    end = new Date(start);
    if (endMin != null) {
      end.setHours(0, endMin, 0, 0);
      if (end <= start) end = addDays(end, 1);
    } else {
      end = new Date(start.getTime() + (durationMin ?? 60) * 60000);
    }
  }

  // --- Details: keep the original text (unless it *is* the title) plus any links
  const extra = urls.filter((u) => u !== location);
  const parts = [];
  if (original && original !== title) parts.push(original);
  else if (extra.length) parts.push(extra.join('\n'));

  return { title, allDay, start, end, location, details: parts.join('\n'), guessedDate: !date, dateIsRelative };
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const ymdhms = (d) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

// Builds a link to Google Calendar's "new event" editor, pre-filled.
export function buildGcalUrl(ev) {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title || 'New event' });
  p.set('dates', ev.allDay ? `${ymd(ev.start)}/${ymd(ev.end)}` : `${ymdhms(ev.start)}/${ymdhms(ev.end)}`);
  if (!ev.allDay) p.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (ev.details) p.set('details', ev.details);
  if (ev.location) p.set('location', ev.location);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
