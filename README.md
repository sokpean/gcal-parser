# Text to Google Calendar

Highlight text on any page and turn it into a Google Calendar event.

## Install (Chrome, Edge, Brave, Arc)

1. Unzip this folder somewhere permanent.
2. Go to `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the `text-to-gcal` folder.
5. Optional: pin the icon from the puzzle-piece menu.

## Use

- **Right-click:** highlight text → right-click → *Add “…” to Google Calendar*. Opens Google Calendar's new-event page, pre-filled.
- **Popup:** click the icon (or press **Alt+Shift+G**). Whatever you've highlighted is loaded in; otherwise paste text. Check or fix the parsed fields, then **Open in Google Calendar** (or Ctrl/⌘+Enter).

Nothing is added to your calendar until you press **Save** in Google Calendar, so you always get a final review. No Google sign-in, API keys or data leaving your browser — it just builds a pre-filled Calendar link.

## What it understands

| Kind | Examples |
|---|---|
| Dates | `today`, `tonight`, `tomorrow`, `Friday`, `next Thu`, `Nov 12`, `12 November 2026`, `11/12`, `2026-11-12`, `the 15th`, `in 3 days` |
| Times | `3pm`, `3:30 p.m.`, `15:00`, `noon`, `at 7` (→ 7pm), `3-4:30pm`, `from 1:00 PM to 2:30 PM` |
| Length | `for 45 min`, `for 2 hours`, `for an hour` (default is 1 hour) |
| Place | `at Blue Bottle`, `@ Maya's place`, `in Room 204`, `Where: …`, Zoom/Meet/Teams links |

No time → all-day event. A bare time that's already passed today → tomorrow. A month/day that's already passed → next year. The original text and the page URL go into the event description.

## Files

- `parser.js` — the text → event parser and Calendar link builder (no dependencies)
- `background.js` — right-click menu
- `popup.html / popup.js / popup.css` — review-and-edit popup
