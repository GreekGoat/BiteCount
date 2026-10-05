# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A mobile web app installed to the iPhone home screen (PWA). Its owner uses an iPhone 15 on iOS 27 and wants it to look and behave like a native iOS 27 app (see Brand Commitments).

## Users

One person, the owner, tracking their own food intake to lose weight steadily. They log several times a day on their phone, often from memory at the end of the day, and eat a lot of South Asian home and restaurant food (rice, roti, curries, cha) alongside fast food.

## Product Purpose

Turn plain-language descriptions of what was eaten into calorie and macro numbers measured against a personal daily budget, and coach the next decision ("what can I still eat?", "should I have this?"). Success is that logging a whole day takes one message, and the numbers are believable.

## Positioning

The user describes food the way they would say it out loud, including a whole day at once ("breakfast was 2 parathas and cha, lunch rice and chicken curry…"), and the app works out the items, the meal each belongs to, and the calories. It understands local dishes and names offline, asks only the follow-up questions that change the number, and can use an AI model for anything it does not know.

## Operating Context

- Used one-handed on an iPhone 15, light and dark mode, often with the keyboard up.
- Logging happens in bursts: right after a meal, or as a recap of the whole day.
- The daily plan comes from a fixed formula the user chose: maintenance = body weight (kg) × 2.2 × 15; budget = maintenance − 10%; protein 2 g/kg, fat 0.8 g/kg, carbs fill the rest.

## Capabilities and Constraints

- Static site on GitHub Pages; no server. All data lives in the phone's browser storage.
- Offline food engine: ~270 foods, a natural-language parser, follow-up questions, and an estimator for unknown dishes.
- AI providers: Groq (the owner's active one, text only), Google Gemini, Anthropic Claude. Keys are stored on the device only and must never be committed; the repo is public.
- Features: calorie ring and macros, meals by time of day, water, streaks, weight log, progress charts, plan editor, saved foods, dictation, photo logging (vision providers only), backup/export.

## Brand Commitments

- Name: BiteCount. App icon: a bitten plate with a calorie ring on an emerald → azure → indigo gradient.
- Visual language pinned by the owner (2026-10-06): a faithful copy of Apple's iOS 27 Liquid Glass UI. San Francisco is the typeface (chosen over the earlier Geist). Glass belongs to the floating navigation layer.
- Navigation pinned by the owner: one persistent tab bar, Today · Coach · (+) · Progress · Plan; profile and settings open from an avatar at the top right.
- Motion must feel butter smooth on an iPhone 15.

## Evidence on Hand

No testimonials, users, or published accuracy figures exist. Calorie values are estimates from standard food tables and must not be presented as medical advice.

## Product Principles

1. One message should be enough to log a whole day.
2. Ask only what changes the number.
3. Numbers stay tied to the owner's own formula, shown openly.
4. Native first: if an iPhone user would hesitate at a control, it is wrong.
5. The phone holds the data and the keys; nothing sensitive leaves it except AI requests.
