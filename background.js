import { parseEvent, buildGcalUrl } from './parser.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'add-to-gcal',
    title: 'Add “%s” to Google Calendar',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'add-to-gcal' || !info.selectionText) return;
  const ev = parseEvent(info.selectionText);
  const src = info.pageUrl || tab?.url;
  if (src && /^https?:/.test(src)) ev.details = [ev.details, `Source: ${src}`].filter(Boolean).join('\n\n');
  chrome.tabs.create({ url: buildGcalUrl(ev), index: tab ? tab.index + 1 : undefined });
});
