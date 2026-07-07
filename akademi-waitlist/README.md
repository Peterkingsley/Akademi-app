# Akademi Waitlist Static Site

This folder is a standalone static landing page for the Akademi beta waitlist.

## Render Static Site Settings

- Root Directory: `akademi-waitlist`
- Build Command: leave empty
- Publish Directory: `.`

The form posts waitlist submissions to the live Akademi API. The static site now
tries these hosts in order and automatically falls back if one is unavailable:

- `https://akademi-app-1.onrender.com`
- `https://akademi-app.onrender.com`

To point at another API host later, set `window.AKADEMI_API_URL` before loading
`script.js`. To provide multiple hosts, set `window.AKADEMI_API_FALLBACK_URLS`
to a comma-separated list.

## Built-in waitlist analytics

The site now sends first-party waitlist events directly to the Akademi backend:

- `waitlist_page_view`
- `waitlist_form_started`
- `waitlist_school_search`
- `waitlist_school_selected`
- `waitlist_submit_success`
- `waitlist_redirect_whatsapp`

These are stored in the backend and surfaced inside the admin waitlist screen so
you can track traffic, conversion, search demand, and WhatsApp redirect follow-through
without adding a third-party analytics script.

## Trackable links

Two link formats are attributed the same way — captured on page load and saved
on the waitlist signup itself if the visitor joins, not just on the page view
event:

- **Pretty path links**, e.g. `https://akademi.study/KELLYPEACE` — the single
  path segment is read as the source code (case-insensitive) with medium
  `referral`. This relies on the `_redirects` file in this folder, which tells
  Render to serve `index.html` for any path instead of 404ing so the code stays
  visible in the URL and readable by `script.js`. If your Render static site
  doesn't pick up `_redirects` automatically, add the same rule manually under
  the site's Settings -> Redirects/Rewrites: source `/*`, destination
  `/index.html`, type `Rewrite`.
- **Query string links**, e.g. `https://akademi.study/?utm_source=<code>`
  (optionally with `utm_medium` and `utm_campaign`) — takes priority over a
  path code if both are present.

The admin waitlist screen has a "Generate a trackable link" tool that builds
the pretty path links and shows a "Signups by link" breakdown so you can see
how many people each link actually converted, filterable down to schools,
faculties, and departments for just that link's audience.
