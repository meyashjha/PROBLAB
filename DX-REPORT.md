# DX Report

## Onboarding

Smooth. API key setup was quick, code examples in the Events & Markets doc are solid. First successful call in around 15 minutes. No complaints here.

E-mail use to get the api key: yashjha7463@gmail.com

## What Confused Me

### Undocumented Pagination Cap

`GET /events` documents `start` and `end` as index params with no mentioned maximum. Calling `start=0&end=200` silently returns 20 items with no error, no warning, just truncated data. You'd have no idea unless you counted.

### The Doc AI Gives Wrong Answers

I asked the built-in assistant whether `start=0&end=200` was valid. It said yes, confidently, citing `minimum: 0` with no upper bound.

![ai-assistant-fail.jpg](https://i.postimg.cc/gJZmbqg5/ai-assistant-fail.jpg)

A confidently wrong AI on your docs is worse than no AI. Devs will trust it and waste hours.

### Price Units Buried in docs

"1,000,000 native token units = $1.00" needs a dedicated section with better visibility, currently it's easy to miss, expensive to debug.

---

## API Issues

### Sometimes Missing API Key Returns 200

```js
const res = await fetch('https://api.jup.ag/prediction/v1/events');
console.log(res.status); // 200 — should be 401
```

No key → 200 with live data. Invalid key → 401. The inconsistency breaks any client-side auth check.

### Rate Limiting Swallows Real Errors

A 404 for an invalid event ID returns 429 when you're also being rate-limited. The specific error disappears entirely.

### No `Retry-After` on 429

```json
{ "code": 429, "message": "[API Gateway] Too many requests" }
```

No backoff info, nothing actionable. Every production SDK expects that header. The free-tier rate limit could also be increased.

---

## AI Tooling

The `integrating-jupiter` skill and `MCP tools` don't cover the Prediction API well. It couldn't figure out that the "View on Jupiter" button needs an `eventId`, I had to find that manually. The skill needs Prediction-specific context or it's more noise than signal.

---

## What I'd Change

- Document the 20-item cap in the parameter table, not a footnote
- Add a Prediction API quickstart: key → first event fetch → price unit interpretation, all in one place
- Fix unauthenticated requests returning 200
- Add `Retry-After` to every 429 response

