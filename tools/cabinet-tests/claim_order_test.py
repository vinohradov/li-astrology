"""Live tests for the claim-order edge function.

Logs in as the project owner's Telegram account (413606412) only. Creates two synthetic
payment rows (order_id prefix `test-claim-`, amount 1, course intensiv which the owner
already has) and always deletes them. Never touches real customer orders.

Run from the repo root:
  set -a; source bot/.env; set +a
  ANON=$(grep -o "eyJ[^']*" web/src/config/site.ts | head -1) python3 tools/cabinet-tests/claim_order_test.py
"""
import hashlib, hmac, json, os, time, urllib.error, urllib.request

URL = os.environ['SUPABASE_URL']; ANON = os.environ['ANON']; SVC = os.environ['SUPABASE_SERVICE_KEY']; BOT = os.environ['BOT_TOKEN']
ME = 413606412
OTHER = 920770570  # any other existing bot_users id
fails = []


def req(method, path, body=None, key=ANON, bearer=None, headers=None):
    h = {'apikey': key, 'Authorization': f'Bearer {bearer or key}', 'Content-Type': 'application/json'}
    h.update(headers or {})
    r = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode(); return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try: return e.code, json.loads(raw)
        except Exception: return e.code, raw


def expect(name, ok, detail=''):
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail else ''))
    if not ok: fails.append(name)


def login():
    _, u = req('GET', f'/rest/v1/bot_users?id=eq.{ME}&select=first_name,username', key=SVC)
    d = {'id': ME, 'first_name': u[0]['first_name'] or 'x', 'auth_date': int(time.time())}
    if u[0].get('username'): d['username'] = u[0]['username']
    cs = '\n'.join(f'{k}={d[k]}' for k in sorted(d))
    d['hash'] = hmac.new(hashlib.sha256(BOT.encode()).digest(), cs.encode(), hashlib.sha256).hexdigest()
    th = req('POST', '/functions/v1/tg-auth', d)[1]['token_hash']
    return req('POST', '/auth/v1/verify', {'type': 'magiclink', 'token_hash': th})[1]['access_token']


tok = login()
C = lambda oid, bearer=tok: req('POST', '/functions/v1/claim-order', {'order_id': oid}, bearer=bearer)

expect('no session → 401', C('x', bearer=ANON)[0] == 401)
expect('garbage token → 401', C('x', bearer='abc.def.ghi')[0] == 401)
st, b = C('web-intensiv-nonexistent'); expect('unknown order → 404', st == 404, f'{st} {b}')
st, b = req('POST', '/functions/v1/claim-order', {}, bearer=tok); expect('missing order_id → 400', st == 400, f'{st} {b}')

_, failed = req('GET', '/rest/v1/payments?status=eq.failed&select=order_id&limit=1', key=SVC)
if failed:
    st, b = C(failed[0]['order_id']); expect('failed order → failed', st == 200 and b.get('status') == 'failed', f'{st} {b}')
# Only reuse an order whose course the owner ALREADY has: claiming any other paid order
# would (correctly) grant that course and change real access.
_, owned_rows = req('GET', f'/rest/v1/user_courses?user_id=eq.{ME}&payment_id=not.is.null&select=payment_id', key=SVC)
mine = None
for r in owned_rows or []:
    _, p = req('GET', f"/rest/v1/payments?order_id=eq.{r['payment_id']}&status=eq.paid&telegram_user_id=eq.{ME}&select=order_id", key=SVC)
    if p: mine = p[0]['order_id']; break
if mine:
    st, b = C(mine); expect('own paid order for owned course → granted (idempotent)', st == 200 and b.get('status') == 'granted', f'{st} {b}')
else:
    print('SKIP  no paid order linked to an owned course')
_, others = req('GET', f'/rest/v1/payments?status=eq.paid&telegram_user_id=not.is.null&telegram_user_id=neq.{ME}&select=order_id&limit=1', key=SVC)
if others:
    st, b = C(others[0]['order_id']); expect("someone else's paid order → 403", st == 403 and b.get('status') == 'claimed_by_other', f'{st} {b}')

ts = int(time.time() * 1000); paid_id = f'test-claim-paid-{ts}'; pend_id = f'test-claim-pending-{ts}'
base = {'provider': 'monobank', 'course_slug': 'intensiv', 'amount': 1, 'source': 'web', 'telegram_user_id': None}
req('POST', '/rest/v1/payments', [{**base, 'order_id': paid_id, 'status': 'paid'}, {**base, 'order_id': pend_id, 'status': 'pending'}],
    key=SVC, headers={'Prefer': 'return=minimal'})
try:
    st, b = C(pend_id); expect('pending order → pending', st == 200 and b.get('status') == 'pending', f'{st} {b}')
    _, uc_before = req('GET', f'/rest/v1/user_courses?user_id=eq.{ME}&select=course_id,payment_id', key=SVC)
    st, b = C(paid_id); expect('unclaimed paid order → granted', st == 200 and b.get('status') == 'granted', f'{st} {b}')
    _, p = req('GET', f'/rest/v1/payments?order_id=eq.{paid_id}&select=telegram_user_id', key=SVC)
    expect('payment bound to caller', p[0]['telegram_user_id'] == ME, str(p))
    _, uc_after = req('GET', f'/rest/v1/user_courses?user_id=eq.{ME}&select=course_id,payment_id', key=SVC)
    expect('existing user_courses row untouched', uc_before == uc_after, str(uc_after))
    st, b = C(paid_id); expect('repeat claim → granted', st == 200 and b.get('status') == 'granted', str(st))
    req('PATCH', f'/rest/v1/payments?order_id=eq.{paid_id}', {'telegram_user_id': OTHER}, key=SVC)
    st, b = C(paid_id); expect('order owned by another user → 403', st == 403 and b.get('status') == 'claimed_by_other', f'{st} {b}')
finally:
    req('DELETE', f'/rest/v1/payments?order_id=in.({paid_id},{pend_id})', key=SVC)
    _, left = req('GET', '/rest/v1/payments?order_id=like.test-claim-*&select=order_id', key=SVC)
    print('leftover synthetic rows:', left)

print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAILED: {fails}')
