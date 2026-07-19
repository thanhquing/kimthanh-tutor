#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
TUTOR_PHONE="${TUTOR_PHONE:-095$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-096$(date +%H%M%S)}"

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

echo "== Flow 6 setup: parent-authenticated pending trial via Flow 5 =="
TUTOR_PHONE="$TUTOR_PHONE" PARENT_PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-05-parent-onboarding-trial.sh
TUTOR_TOKEN="$(json_get /tmp/flow02-otp-verify.json access_token)"
TUTOR_AUTH="Authorization: Bearer $TUTOR_TOKEN"
TRIAL_ID="$(json_get /tmp/flow05-trial.json id)"

echo "== Flow 6 Step 1: tutor views trial inbox =="
inbox_http="$(curl -sS -o /tmp/flow06-inbox.json -w "%{http_code}" \
  -H "$TUTOR_AUTH" \
  "$API/trials/mine?role=tutor")"
cat /tmp/flow06-inbox.json
echo
require_code "$inbox_http" "200" "Tutor trial inbox" /tmp/flow06-inbox.json
json_array_contains_id /tmp/flow06-inbox.json items "$TRIAL_ID" || fail "Tutor inbox did not include trial_id $TRIAL_ID"

echo "== Flow 6 Step 2: accept trial =="
accept_http="$(curl -sS -o /tmp/flow06-accept.json -w "%{http_code}" \
  -X POST "$API/trials/$TRIAL_ID/accept" \
  -H "$TUTOR_AUTH")"
cat /tmp/flow06-accept.json
echo
require_code "$accept_http" "201" "Accept parent trial" /tmp/flow06-accept.json
require_json_value /tmp/flow06-accept.json trial.status accepted
require_json_value /tmp/flow06-accept.json class_contract.status trial_accepted
CLASS_ID="$(json_get /tmp/flow06-accept.json class_contract.id)"

echo "== Flow 6 Step 3: transition class to active =="
transition_http="$(curl -sS -o /tmp/flow06-transition-active.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/transition" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{
    "to": "active"
  }')"
cat /tmp/flow06-transition-active.json
echo
require_code "$transition_http" "201" "Transition class active" /tmp/flow06-transition-active.json
require_json_value /tmp/flow06-transition-active.json id "$CLASS_ID"
require_json_value /tmp/flow06-transition-active.json status active

echo "== Flow 6 Step 4: create lesson log =="
log_http="$(curl -sS -o /tmp/flow06-lesson-log.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/lesson-logs" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{
    "lesson_at": "2026-07-14T12:30:00.000Z",
    "subject": "math",
    "content": "On phuong trinh bac nhat va bai tap ap dung.",
    "homework": "Lam bai 1-8 trang 24.",
    "absorption_level": "normal",
    "tutor_note": "Can ren toc do bien doi bieu thuc."
  }')"
cat /tmp/flow06-lesson-log.json
echo
require_code "$log_http" "201" "Create lesson log" /tmp/flow06-lesson-log.json
require_json_value /tmp/flow06-lesson-log.json class_contract_id "$CLASS_ID"
require_json_value /tmp/flow06-lesson-log.json subject math
require_json_value /tmp/flow06-lesson-log.json absorption_level normal
require_json_value /tmp/flow06-lesson-log.json lesson_at "2026-07-14T12:30:00.000Z"
LESSON_LOG_ID="$(json_get /tmp/flow06-lesson-log.json id)"

echo "== Flow 6 Step 5: edit lesson log =="
patch_http="$(curl -sS -o /tmp/flow06-lesson-log-patch.json -w "%{http_code}" \
  -X PATCH "$API/lesson-logs/$LESSON_LOG_ID" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{
    "absorption_level": "good",
    "tutor_note": "Da nam bai sau khi sua loi."
  }')"
cat /tmp/flow06-lesson-log-patch.json
echo
require_code "$patch_http" "200" "Edit lesson log" /tmp/flow06-lesson-log-patch.json
require_json_value /tmp/flow06-lesson-log-patch.json id "$LESSON_LOG_ID"
require_json_value /tmp/flow06-lesson-log-patch.json absorption_level good
require_json_value /tmp/flow06-lesson-log-patch.json tutor_note "Da nam bai sau khi sua loi."

echo "== Flow 6 Step 6: read tutor work dashboard aggregate =="
dashboard_http="$(curl -sS -o /tmp/flow06-tutor-dashboard.json -w "%{http_code}" \
  -H "$TUTOR_AUTH" \
  "$API/dashboard/tutor/overview")"
cat /tmp/flow06-tutor-dashboard.json
echo
require_code "$dashboard_http" "200" "Tutor dashboard overview" /tmp/flow06-tutor-dashboard.json
require_json_value /tmp/flow06-tutor-dashboard.json summary.pending_trials 0
require_json_value /tmp/flow06-tutor-dashboard.json summary.teaching_classes 1
require_json_value /tmp/flow06-tutor-dashboard.json partial_errors ""
json_array_contains_id /tmp/flow06-tutor-dashboard.json teaching_classes "$CLASS_ID" || fail "Tutor dashboard did not include class_id $CLASS_ID"
require_json_value /tmp/flow06-tutor-dashboard.json teaching_classes.0.latest_lesson.id "$LESSON_LOG_ID"

echo "OK: Flow 6 Tutor inbox + lesson log verified end-to-end for trial_id $TRIAL_ID class_id $CLASS_ID lesson_log_id $LESSON_LOG_ID"
