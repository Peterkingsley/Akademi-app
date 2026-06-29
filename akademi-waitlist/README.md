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
