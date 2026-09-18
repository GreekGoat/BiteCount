# BiteCount

A calorie tracker for the phone. You say what you ate the way you'd say it out loud —
"2 rotis and a bowl of chicken curry" — and BiteCount asks the few details that actually
change the number, then does the maths.

**Live: https://greekgoat.github.io/BiteCount/** — open it in Safari, then Share → Add to
Home Screen to get it as an app that works with no signal.

## The plan it follows

1. **Maintenance** — body weight (kg) × 2.2 × 15
2. **Deficit** — take 10% off (adjustable from 0 to 25%)
3. **Macros** — protein at 2 g/kg, fat at 0.8 g/kg, carbs fill what is left of the budget

For 60 kg: 1,980 maintenance → 1,782 kcal a day → 120 g protein, 48 g fat, 217 g carbs.

## How it works out what you ate

**Offline, on the phone.** About 270 foods with local names (bhat, cha, murgir jhol,
kacchi) and realistic portions. It reads amounts and details straight out of the sentence
("half plate biryani", "restaurant style", "with bones", "2 sugars"), then asks about
whatever still matters — portion, oil, bones, sides. Dishes it does not know get estimated
from what kind of dish they are and what is mostly in them, and are saved for next time.

**With AI, if you want it.** Add your own API key under You → AI estimation and anything
you type, or a photo of the plate, goes to the model, which asks a couple of clarifying
questions and returns a per-item breakdown. Two providers are supported:

- **Google Gemini** (AI Studio) — free tier, reads meal photos.
- **Groq** — very fast and free to start, typed descriptions only (no photos).
- **Anthropic Claude** — pay as you go, reads meal photos.

Checking a key lists the models that key can actually use, so the picker always
matches your account.

Keys are stored only on the phone, never in this repo or any backup file, and requests go
straight from the phone to the provider. For Groq you can instead deploy the small proxy in
`server/groq-proxy` and keep the key on a server, so the phone never holds one.

## Running it

```bash
npm install
npm run dev      # local dev server
npm test         # formula and food-engine tests
npm run build    # production build
```

Pushing to `main` builds and deploys to GitHub Pages automatically.

## Notes

- Dictation, meal photos, one-tap repeats, copying yesterday's meal, undo on delete and an
  offline food browser are all built in.
- Everything — profile, food log, weights — lives in the browser on your phone. No account,
  no server. Back it up from You → Your data before clearing browser data or changing phones.
- Calorie figures are estimates from standard food composition tables. Good enough to steer
  by; not medical advice.
