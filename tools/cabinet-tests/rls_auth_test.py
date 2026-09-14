"""Live end-to-end check of tg-auth + RLS policies. Logs in ONLY as the project owner's Telegram
account (413606412). Writes the session to $SCRATCH/session.json for ui_test.mjs.
Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, BOT_TOKEN (source bot/.env), ANON, SCRATCH (any temp dir)."""
import os, json, time, hashlib, hmac, base64, urllib.request, urllib.error

URL = os.environ['SUPABASE_URL']; ANON = os.environ['ANON']; SVC = os.environ['SUPABASE_SERVICE_KEY']; BOT = os.environ['BOT_TOKEN']
OWNER = 413606412
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

def sign(d):
    cs = '\n'.join(f'{k}={d[k]}' for k in sorted(d))
    return hmac.new(hashlib.sha256(BOT.encode()).digest(), cs.encode(), hashlib.sha256).hexdigest()

_, u = req('GET', f'/rest/v1/bot_users?id=eq.{OWNER}&select=id,first_name,username', key=SVC); u = u[0]
_, uc = req('GET', f'/rest/v1/user_courses?user_id=eq.{OWNER}&select=course_id', key=SVC)
owned = {r['course_id'] for r in uc}
payload = {'id': OWNER, 'first_name': u['first_name'] or 'x', 'auth_date': int(time.time())}
if u.get('username'): payload['username'] = u['username']
payload['hash'] = sign(dict(payload))

st, b = req('POST', '/functions/v1/tg-auth', {**payload, 'hash': '0' * 64}); expect('tampered hash → 401 bad_hash', st == 401 and b.get('error') == 'bad_hash', f'{st} {b}')
old = {k: v for k, v in payload.items() if k != 'hash'}; old['auth_date'] -= 90000; old['hash'] = sign(dict(old))
st, b = req('POST', '/functions/v1/tg-auth', old); expect('stale auth_date → 401 expired', st == 401 and b.get('error') == 'expired', f'{st} {b}')
st, b = req('POST', '/functions/v1/tg-auth', {**payload, 'id': 1}); expect('swapped id → 401', st == 401, f'{st} {b}')

st, res = req('POST', '/functions/v1/tg-auth', payload); expect('valid payload → token_hash', st == 200 and 'token_hash' in res, f'{st}')
st, sess = req('POST', '/auth/v1/verify', {'type': 'magiclink', 'token_hash': res['token_hash']}); expect('verifyOtp → session', st == 200 and 'access_token' in sess, f'{st}')
tok = sess['access_token']
claims = json.loads(base64.urlsafe_b64decode(tok.split('.')[1] + '=='))
expect('JWT app_metadata.telegram_id', claims.get('app_metadata', {}).get('telegram_id') == OWNER, str(claims.get('app_metadata')))
json.dump(sess, open(os.environ['SCRATCH'] + '/session.json', 'w'))
st, _ = req('POST', '/auth/v1/verify', {'type': 'magiclink', 'token_hash': res['token_hash']}); expect('token_hash single-use', st >= 400, str(st))
st, res2 = req('POST', '/functions/v1/tg-auth', payload); expect('second login reuses same auth user', st == 200, str(st))

A = lambda m, p, b=None, h=None: req(m, p, b, bearer=tok, headers=h)
st, b = A('GET', '/rest/v1/bot_users?select=id,auth_uid'); expect('bot_users: only own row', st == 200 and len(b) == 1 and b[0]['id'] == OWNER and b[0]['auth_uid'] == claims['sub'], str(b))
st, b = A('GET', '/rest/v1/courses?select=slug'); expect('courses: 4 active', st == 200 and len(b) == 4, str([c['slug'] for c in b]))
st, b = A('GET', '/rest/v1/user_courses?select=course_id'); expect('user_courses: own only', st == 200 and {r['course_id'] for r in b} == owned, str(b))
st, ls = A('GET', '/rest/v1/lessons?select=id,course_id'); expect('lessons: owned courses only', st == 200 and ls and all(l['course_id'] in owned for l in ls), f'{len(ls)} rows')
st, ol = A('GET', '/rest/v1/lessons_outline?select=id,title'); expect('lessons_outline: all 48, no text', st == 200 and len(ol) == 48 and 'text_html' not in ol[0], f'{len(ol)}')
st, b = A('GET', '/rest/v1/payments?select=order_id&limit=1'); expect('payments denied', st in (401, 403), str(st))
st, b = A('GET', '/rest/v1/promotions?select=code&limit=1'); expect('promotions denied', st in (401, 403), str(st))
st, b = A('GET', '/rest/v1/reminders?select=id&limit=1'); expect('reminders denied', st in (401, 403), str(st))
st, b = A('PATCH', f'/rest/v1/bot_users?id=eq.{OWNER}', {'lang': 'uk'}, {'Prefer': 'return=representation'}); expect('update own lang allowed', st == 200 and len(b) == 1, f'{st} {b}')
st, b = A('PATCH', f'/rest/v1/bot_users?id=eq.{OWNER}', {'first_name': 'hacked'}); expect('update first_name denied', st in (401, 403), f'{st}')
st, b = A('PATCH', '/rest/v1/bot_users?id=eq.920770570', {'lang': 'ru'}, {'Prefer': 'return=representation'}); expect('update OTHER user lang → 0 rows', st == 200 and b == [], f'{st} {b}')
st, b = A('POST', '/rest/v1/user_courses', {'user_id': OWNER, 'course_id': '50626a23-7423-40d2-93d2-fd11d6d7cf23'}); expect('self-grant course denied', st in (401, 403), f'{st}')
st, pr = A('GET', '/rest/v1/user_lesson_progress?select=lesson_id,completed'); expect('progress readable', st == 200, f'{len(pr)} rows')
own_lesson = next(l for l in ls if any(p['lesson_id'] == l['id'] for p in pr)) if pr else ls[0]
before = {p['lesson_id']: p['completed'] for p in pr}.get(own_lesson['id'])
st, b = A('POST', '/rest/v1/user_lesson_progress?on_conflict=user_id,lesson_id', {'user_id': OWNER, 'lesson_id': own_lesson['id'], 'opened_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}, {'Prefer': 'resolution=merge-duplicates,return=representation'})
expect('upsert opened_at on owned lesson keeps completed', st in (200, 201) and b[0]['completed'] == (before or False), f'{st} {b}')
_, all_l = req('GET', '/rest/v1/lessons?select=id,course_id', key=SVC); unowned = next(l for l in all_l if l['course_id'] not in owned)
st, b = A('POST', '/rest/v1/user_lesson_progress', {'user_id': OWNER, 'lesson_id': unowned['id'], 'completed': True})
expect('progress on unowned lesson denied', st in (401, 403), f'{st}')
if st < 300: req('DELETE', f"/rest/v1/user_lesson_progress?user_id=eq.{OWNER}&lesson_id=eq.{unowned['id']}", key=SVC)
st, b = A('POST', '/rest/v1/user_lesson_progress', {'user_id': 920770570, 'lesson_id': own_lesson['id']}); expect('progress for other user denied', st in (401, 403), f'{st}')
st, _ = req('POST', '/rest/v1/rpc/owns_course', {'p_course_id': next(iter(owned))}); expect('anon rpc owns_course denied', st in (401, 403, 404), str(st))
st, _ = req('GET', '/rest/v1/lessons_outline?select=id&limit=1'); expect('anon lessons_outline denied', st in (401, 403), str(st))

print('\nRESULT:', 'ALL PASS' if not fails else f'{len(fails)} FAILED: {fails}')
