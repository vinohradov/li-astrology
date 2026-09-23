# Cabinet regression tests

Run against the **live** Supabase project (there is no staging). They log in only as the
project owner's Telegram account `413606412` by signing a Telegram Login payload with
`BOT_TOKEN` from `bot/.env`, so the real `tg-auth` → session flow is exercised.

| File | What it checks | Side effects |
|---|---|---|
| `rls_auth_test.py` | tg-auth hash/expiry checks, session claims, every RLS allow/deny rule | Updates owner's `opened_at` on one lesson and `lang='uk'` (same value) |
| `claim_order_test.py` | claim-order: 401/400/404, failed, pending, first claim, idempotent repeat, claimed-by-other | Two synthetic `test-claim-*` payment rows, always deleted |
| `bot_audience_test.ts` | Bot nurture/inactivity/broadcast audiences exclude website-only sign-ups (`started_bot_at` NULL), cold anchor = bot start | Two synthetic `bot_users` rows (ids 990000000001/2), always deleted |
| `ui_test.mjs` | All cabinet pages in headless Chrome (desktop + 390 px), claim banner, success page links, header link, no console errors / overflow | Marks one lesson complete; `run.sh` restores it. GA/Meta requests blocked |

```bash
tools/cabinet-tests/run.sh          # API tests
tools/cabinet-tests/run.sh --ui     # + build, preview and UI test (needs nvm Node 22 + Google Chrome)
nvm use 22 && bot/node_modules/.bin/tsx --env-file=bot/.env tools/cabinet-tests/bot_audience_test.ts
```

Rules: never add tests that create auth users or claims for real customers; always clean up
synthetic rows in `finally`.
