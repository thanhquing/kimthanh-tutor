#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

json_get() {
  file="$1"
  path="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (cur === undefined) process.exit(2); if (cur === null) { process.stdout.write('null'); process.exit(0); } process.stdout.write(String(cur));" "$file" "$path"
}

json_array_contains_id() {
  file="$1"
  path="$2"
  id="$3"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (!Array.isArray(cur)) process.exit(2); process.exit(cur.some((item) => item?.id === process.argv[3]) ? 0 : 3);" "$file" "$path" "$id"
}

require_code() {
  actual="$1"
  expected="$2"
  label="$3"
  file="$4"
  [ "$actual" = "$expected" ] || {
    echo "--- response ---" >&2
    [ -f "$file" ] && cat "$file" >&2
    fail "$label expected HTTP $expected, got $actual"
  }
}

require_json_value() {
  file="$1"
  path="$2"
  expected="$3"
  actual="$(json_get "$file" "$path")"
  [ "$actual" = "$expected" ] || fail "$path expected $expected, got $actual"
}

echo "== Flow 3 setup: create and publish tutor via Flow 2 =="
sh /app/tutor-api/scripts/verify-flow-02-tutor-profile.sh
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"

echo "== Flow 3 Step 1: guest search tutors =="
search_http="$(curl -sS -o /tmp/flow03-search.json -w "%{http_code}" \
  "$API/tutors/search?subject=math&grade_level=9&teaching_mode=online&fee_max=250000&sort=rating&limit=10")"
cat /tmp/flow03-search.json
echo
require_code "$search_http" "200" "Tutor search" /tmp/flow03-search.json
json_array_contains_id /tmp/flow03-search.json items "$TUTOR_PROFILE_ID" || fail "Search results did not include tutor_profile_id $TUTOR_PROFILE_ID"

echo "== Flow 3 Step 2: guest public detail shows paywall =="
detail_http="$(curl -sS -o /tmp/flow03-public-detail.json -w "%{http_code}" \
  "$API/tutors/$TUTOR_PROFILE_ID/public")"
cat /tmp/flow03-public-detail.json
echo
require_code "$detail_http" "200" "Tutor public detail" /tmp/flow03-public-detail.json
require_json_value /tmp/flow03-public-detail.json id "$TUTOR_PROFILE_ID"
require_json_value /tmp/flow03-public-detail.json unlock_state locked
require_json_value /tmp/flow03-public-detail.json unlock_via null

echo "OK: Flow 3 Guest search + paywall verified end-to-end for tutor_profile_id $TUTOR_PROFILE_ID"
