import { parseEvent, buildGcalUrl } from './parser.js';

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, '0');
const dateVal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeVal = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
let sourceUrl = '';

function fill(ev) {
  $('title').value = ev.title;
  $('date').value = dateVal(ev.start);
  $('allday').checked = ev.allDay;
  $('start').value = ev.allDay ? '09:00' : timeVal(ev.start);
  $('end').value = ev.allDay ? '10:00' : timeVal(ev.end);
  $('location').value = ev.location;
  $('details').value = [ev.details, sourceUrl && `Source: ${sourceUrl}`].filter(Boolean).join('\n\n');
  $('hint').hidden = !ev.guessedDate || !$('text').value.trim();
  syncAllDay();
}

function syncAllDay() {
  $('times').style.display = $('allday').checked ? 'none' : '';
}

function readFields() {
  const d = $('date').value;
  if (!d) return null;
  const allDay = $('allday').checked;
  let start, end;
  if (allDay) {
    start = new Date(`${d}T00:00`);
    end = new Date(start);
    end.setDate(end.getDate() + 1);
  } else {
    start = new Date(`${d}T${$('start').value || '09:00'}`);
    end = $('end').value ? new Date(`${d}T${$('end').value}`) : new Date(start.getTime() + 3600e3);
    if (end <= start) end.setDate(end.getDate() + 1); // crosses midnight
  }
  return {
    title: $('title').value.trim() || 'New event',
    allDay, start, end,
    location: $('location').value.trim(),
    details: $('details').value.trim(),
  };
}

function open() {
  const ev = readFields();
  if (!ev) { $('date').focus(); return; }
  chrome.tabs.create({ url: buildGcalUrl(ev) });
  window.close();
}

let timer;
$('text').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => fill(parseEvent($('text').value)), 150);
});
$('allday').addEventListener('change', syncAllDay);
$('go').addEventListener('click', open);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); open(); }
});

(async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      if (/^https?:/.test(tab.url || '')) sourceUrl = tab.url;
      const [res] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.getSelection().toString(),
      });
      if (res?.result?.trim()) $('text').value = res.result.trim();
    }
  } catch { /* chrome:// pages, PDFs, the Web Store etc. don't allow scripting — just paste */ }
  fill(parseEvent($('text').value));
  $('text').focus();
  $('text').select();
})();
