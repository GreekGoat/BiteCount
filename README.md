# BiteCount

A calorie tracker for the phone. You say what you ate the way you'd say it out loud,
even a whole day at once ("breakfast was 2 parathas and cha, lunch biryani, dal and rice
for dinner"), and BiteCount sorts every item into its meal and does the maths. A coach
answers "what should I eat next?" and "can I have this?" from your own log.

**Live: https://greekgoat.github.io/BiteCount/**. Open it in Safari, then Share → Add to
Home Screen to get it as an app that works with no signal.

## The plan it follows

1. **Maintenance**: body weight (kg) × 2.2 × 15
2. **Deficit**: take 10% off (adjustable from 0 to 25%)
3. **Macros**: protein at 2 g/kg, fat at 0.8 g/kg, carbs fill what is left of the budget

For 60 kg: 1,980 maintenance → 1,782 kcal a day → 120 g protein, 48 g fat, 217 g carbs.

## Logging

**A whole day in one go.** Name the meals as you would in conversation ("for breakfast…",
"in the evening…", "dinner was…") and each item lands in the right meal. Food with no time
given waits for you to pick. This works offline, and with AI.

**Offline, on the phone.** About 270 foods with local names (bhat, cha, murgir jhol,
kacchi) and realistic portions. It reads amounts and details straight out of the sentence
("half plate biryani", "restaurant style", "with bones", "2 sugars"), then asks about
whatever still matters. Dishes it does not know are estimated from what kind of dish they
are, and saved for next time.

**With AI.** Add your own API key under You → AI and the model handles anything the offline
list does not know, plus meal photos (Gemini and Claude).

## The coach

The Coach tab is a chat that knows today's log, your plan and the last week:

- **Tell it what you ate**, a snack or the whole day, and it logs it by meal straight
  away, with Undo and per-item remove.
- **Ask what to eat next** and it suggests 2 to 4 options that fit what is left, protein
  first, each one tap to log.
- **Ask "should I eat this?"** and it answers yes, a smaller portion, or not today, with a
  lighter swap.
- It never logs food you are only thinking about.

## AI providers

- **Groq**: very fast and free to start, text only. The free tier allows about 8,000
  tokens a minute (a coach reply uses roughly 2,000), so the app keeps prompts lean, sends
  only the last few messages, and waits out a short rate limit by itself with a countdown.
- **Google Gemini** (AI Studio): free tier, reads meal photos.
- **Anthropic Claude**: pay as you go, reads meal photos.

If the selected provider has no key but another one does, that one is used. Keys are
stored only on the phone, never in this repo or any backup file, and requests go straight
from the phone to the provider. For Groq you can instead deploy the small proxy in
`server/groq-proxy` and keep the key on a server.

## Design

The interface follows Apple's iOS 27 Liquid Glass: San Francisco type, the iOS system
colours in light and dark, grouped lists, a single floating glass tab bar (Today · Coach ·
add · Progress · Plan), glass sheets and banners, and profile and settings behind the
avatar. Glass is used only on the floating layer and every animation is transform or
opacity, so scrolling stays smooth. You → Appearance switches the glass between Clear
and Tinted.

## Running it

```bash
npm install
npm run dev      # local dev server
npm test         # formula, food-engine, whole-day parser and coach tests
npm run build    # production build
```

Pushing to `main` builds and deploys to GitHub Pages automatically.

## Notes

- Dictation, meal photos, one-tap repeats, copying yesterday's meal, swipe to delete with
  undo, and an offline food browser are all built in.
- Everything (profile, food log, weights, the coach chat) lives in the browser on your
  phone. No account, no server. Back it up from You → Your data before clearing browser
  data or changing phones.
- Calorie figures are estimates from standard food composition tables. Good enough to steer
  by; not medical advice.
