# Groq proxy (optional)

BiteCount is a static site on GitHub Pages: there is no server in it, so it cannot
hold a secret. By default the Groq key is stored in your phone's browser, the same
way the Gemini and Claude keys are — fine for your own phone, since only you use it.

Deploy this proxy if you want the key to live on a server instead. The phone then
sends the meal description to your proxy, and the proxy adds the key.

## Cloudflare Workers (free, about two minutes)

```bash
cd server/groq-proxy
npx wrangler secret put GROQ_API_KEY   # paste the key when prompted
npx wrangler deploy
```

Copy the deployed `https://…workers.dev` URL into the app under
**You → AI estimation → Server proxy**, and clear the key field. That is it: the
phone no longer holds a key.

`worker.js` only accepts requests from the origins listed at the top of the file
(the live app and localhost), so a leaked URL cannot be used to spend your quota.
Add your own origin there if you host the app elsewhere.

## Next.js / Vercel

If you run the app behind a Node host instead, copy `next-route-example.js` to
`app/api/estimate/route.js`, set `GROQ_API_KEY` in the host's environment
variables, and point the Server proxy field at `/api/estimate`.

That route also accepts a plain `{ "text": "grilled chicken sandwich" }` body and
replies with the parsed JSON, so it works for a simple frontend of your own.

## Local development

`.env.local` in the repo root holds `GROQ_API_KEY` for these server pieces. It is
covered by `.gitignore` and is never committed or bundled — the static app cannot
read it at runtime.
