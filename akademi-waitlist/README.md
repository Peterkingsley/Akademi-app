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
