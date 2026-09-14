# Cabinet regression tests

Run against the **live** Supabase project (there is no staging). They log in only as the
project owner's Telegram account `413606412` by signing a Telegram Login payload with
`BOT_TOKEN` from `bot/.env`, so the real `tg-auth` → session flow is exercised.

| File | What it checks | Side effects |
|---|---|---|
| `rls_auth_test.py` | tg-auth hash/expiry checks, session claims, every RLS allow/deny rule | Updates owner's `opened_at` on one lesson and `lang='uk'` (same value) |
| `claim_order_test.py` | claim-order: 401/400/404, failed, pending, first claim, idempotent repeat, claimed-by-other | Two synthetic `test-claim-*` payment rows, always deleted |
| `ui_test.mjs` | All cabinet pages in headless Chrome (desktop + 390 px), claim banner, success page links, header link, no console errors / overflow | Marks one lesson complete; `run.sh` restores it. GA/Meta requests blocked |

```bash
tools/cabinet-tests/run.sh          # API tests
tools/cabinet-tests/run.sh --ui     # + build, preview and UI test (needs nvm Node 22 + Google Chrome)
```

Rules: never add tests that create auth users or claims for real customers; always clean up
synthetic rows in `finally`.
