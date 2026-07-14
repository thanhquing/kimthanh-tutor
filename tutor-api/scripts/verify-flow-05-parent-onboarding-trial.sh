#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
TUTOR_PHONE="${TUTOR_PHONE:-093$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-094$(date +%H%M%S)}"
PARENT_EMAIL="${PARENT_EMAIL:-minh+$PARENT_PHONE@example.com}"

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

echo "== Flow 5 setup: create and publish tutor via Flow 2 =="
PHONE="$TUTOR_PHONE" sh /app/tutor-api/scripts/verify-flow-02-tutor-profile.sh
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"

echo "== Flow 5 setup: login active parent via Flow 1 =="
PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-01-auth-consent.sh
PARENT_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
PARENT_AUTH="Authorization: Bearer $PARENT_TOKEN"

echo "== Flow 5 Step 1: bootstrap parent profile =="
parent_http="$(curl -sS -o /tmp/flow05-parent.json -w "%{http_code}" \
  -X POST "$API/parents/me" \
  -H "Content-Type: application/json" \
  -H "$PARENT_AUTH" \
  --data "{
    \"display_name\": \"Anh Minh\",
    \"email\": \"$PARENT_EMAIL\"
  }")"
cat /tmp/flow05-parent.json
echo
require_code "$parent_http" "201" "Bootstrap parent profile" /tmp/flow05-parent.json
require_json_value /tmp/flow05-parent.json display_name "Anh Minh"
require_json_value /tmp/flow05-parent.json email "$PARENT_EMAIL"
PARENT_PROFILE_ID="$(json_get /tmp/flow05-parent.json id)"

echo "== Flow 5 Step 2: add student =="
student_http="$(curl -sS -o /tmp/flow05-student.json -w "%{http_code}" \
  -X POST "$API/parents/me/students" \
  -H "Content-Type: application/json" \
  -H "$PARENT_AUTH" \
  --data '{
    "name": "Minh Chau",
    "grade": "9",
    "learning_goals": "On thi vao lop 10 mon Toan"
  }')"
cat /tmp/flow05-student.json
echo
require_code "$student_http" "201" "Add student" /tmp/flow05-student.json
require_json_value /tmp/flow05-student.json name "Minh Chau"
require_json_value /tmp/flow05-student.json grade "9"
STUDENT_ID="$(json_get /tmp/flow05-student.json id)"

echo "== Flow 5 Step 3: parent submits trial request =="
trial_http="$(curl -sS -o /tmp/flow05-trial.json -w "%{http_code}" \
  -X POST "$API/trials" \
  -H "Content-Type: application/json" \
  -H "$PARENT_AUTH" \
  --data "{
    \"tutor_profile_id\": \"$TUTOR_PROFILE_ID\",
    \"student_id\": \"$STUDENT_ID\",
    \"subject\": \"math\",
    \"grade\": \"9\",
    \"learning_goal\": \"On thi vao lop 10\",
    \"teaching_mode\": \"online\",
    \"preferred_schedule\": \"Thu 2,4,6 sau 19:30\",
    \"message\": \"Can giao vien theo sat bai tap hang tuan.\"
  }")"
cat /tmp/flow05-trial.json
echo
require_code "$trial_http" "201" "Create parent trial" /tmp/flow05-trial.json
require_json_value /tmp/flow05-trial.json status pending
require_json_value /tmp/flow05-trial.json parent_profile_id "$PARENT_PROFILE_ID"
require_json_value /tmp/flow05-trial.json student_id "$STUDENT_ID"
TRIAL_ID="$(json_get /tmp/flow05-trial.json id)"

echo "== Flow 5 Step 4: parent views trial status =="
mine_http="$(curl -sS -o /tmp/flow05-trials-mine.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/trials/mine?role=parent")"
cat /tmp/flow05-trials-mine.json
echo
require_code "$mine_http" "200" "Parent trials mine" /tmp/flow05-trials-mine.json
json_array_contains_id /tmp/flow05-trials-mine.json items "$TRIAL_ID" || fail "Parent trial list did not include trial_id $TRIAL_ID"

echo "OK: Flow 5 Parent onboarding + trial verified end-to-end for parent_profile_id $PARENT_PROFILE_ID student_id $STUDENT_ID trial_id $TRIAL_ID"
