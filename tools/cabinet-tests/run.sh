#!/usr/bin/env bash
# Runs all cabinet regression tests against the LIVE Supabase project.
# Usage (repo root): tools/cabinet-tests/run.sh [--ui]
set -euo pipefail
cd "$(dirname "$0")/../.."
set -a; source bot/.env; set +a
export ANON=$(grep -o "eyJ[^']*" web/src/config/site.ts | head -1)
export SCRATCH=${SCRATCH:-$(mktemp -d)}
K="$SUPABASE_SERVICE_KEY"; H=(-H "apikey: $K" -H "Authorization: Bearer $K")

python3 tools/cabinet-tests/rls_auth_test.py
python3 tools/cabinet-tests/claim_order_test.py

if [[ "${1:-}" == "--ui" ]]; then
  export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh" >/dev/null; nvm use 22 >/dev/null
  PW=${PW:-$(find ~/.npm/_npx -maxdepth 4 -path "*/node_modules/playwright/index.mjs" | head -1)}
  [[ -n "$PW" ]] || { echo "playwright not found: run 'npx playwright --version' once"; exit 1; }
  # First intensiv lesson the owner hasn't completed; restored after the run.
  read -r LESSON TITLE < <(curl -s "$SUPABASE_URL/rest/v1/user_lesson_progress?user_id=eq.413606412&completed=eq.false&select=lesson_id,lessons!inner(course_id,title)&lessons.course_id=eq.2ad83d74-35ce-4a85-afe1-44799076b22e&limit=1" "${H[@]}" \
    | python3 -c "import json,sys;r=json.load(sys.stdin)[0];print(r['lesson_id'], r['lessons']['title'])")
  LOCKED=$(curl -s "$SUPABASE_URL/rest/v1/lessons?course_id=eq.50626a23-7423-40d2-93d2-fd11d6d7cf23&position=eq.3&select=id" "${H[@]}" | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['id'])")
  BEFORE=$(curl -s "$SUPABASE_URL/rest/v1/user_lesson_progress?user_id=eq.413606412&lesson_id=eq.$LESSON&select=completed,completed_at,opened_at" "${H[@]}")
  (cd web && npm run build >/dev/null && (npx astro preview --port 4329 >/dev/null 2>&1 &))
  for _ in $(seq 1 40); do curl -s -o /dev/null http://localhost:4329/cabinet/ && break; sleep 0.5; done
  PW="$PW" node tools/cabinet-tests/ui_test.mjs "$SCRATCH" "$LESSON" "$TITLE" "$LOCKED" || true
  pkill -f "astro preview --port 4329" || true
  curl -s -o /dev/null -w "progress restored: %{http_code}\n" -X PATCH "$SUPABASE_URL/rest/v1/user_lesson_progress?user_id=eq.413606412&lesson_id=eq.$LESSON" \
    "${H[@]}" -H "Content-Type: application/json" -d "$(echo "$BEFORE" | python3 -c 'import json,sys;print(json.dumps(json.load(sys.stdin)[0]))')"
  echo "screenshots: $SCRATCH/run2/"
fi
