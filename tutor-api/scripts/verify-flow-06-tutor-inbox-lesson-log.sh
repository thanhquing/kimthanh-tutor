#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PSQL_URL="${PSQL_URL:-postgresql://postgres:postgres@db:5432/tutor}"
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
PARENT_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
PARENT_AUTH="Authorization: Bearer $PARENT_TOKEN"
TRIAL_ID="$(json_get /tmp/flow05-trial.json id)"

echo "== Flow 6 Step 1: tutor views trial inbox =="
inbox_http="$(curl -sS -o /tmp/flow06-inbox.json -w "%{http_code}" \
  -H "$TUTOR_AUTH" \
  "$API/trials/mine?role=tutor&status=pending&limit=20")"
cat /tmp/flow06-inbox.json
echo
require_code "$inbox_http" "200" "Tutor trial inbox" /tmp/flow06-inbox.json
json_array_contains_id /tmp/flow06-inbox.json items "$TRIAL_ID" || fail "Tutor inbox did not include trial_id $TRIAL_ID"
require_json_value /tmp/flow06-inbox.json items.0.id "$TRIAL_ID"
require_json_value /tmp/flow06-inbox.json items.0.contact null
require_json_value /tmp/flow06-inbox.json items.0.capabilities.can_accept true
require_json_value /tmp/flow06-inbox.json items.0.capabilities.can_view_contact false
TRIAL_VERSION="$(json_get /tmp/flow06-inbox.json items.0.version)"

echo "== Flow 6 Step 2: accept trial =="
accept_http="$(curl -sS -o /tmp/flow06-accept.json -w "%{http_code}" \
  -X POST "$API/trials/$TRIAL_ID/accept" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data "{\"expected_version\":$TRIAL_VERSION}")"
cat /tmp/flow06-accept.json
echo
require_code "$accept_http" "201" "Accept parent trial" /tmp/flow06-accept.json
require_json_value /tmp/flow06-accept.json trial.status accepted
require_json_value /tmp/flow06-accept.json class_contract.status trial_accepted
CLASS_ID="$(json_get /tmp/flow06-accept.json class_contract.id)"

echo "== Flow 6 Step 2c: tutor lists and opens owner-safe class detail =="
classes_http="$(curl -sS -o /tmp/flow06-classes.json -w "%{http_code}" \
  -H "$TUTOR_AUTH" \
  "$API/classes/mine?role=tutor&limit=20")"
require_code "$classes_http" "200" "Tutor class list" /tmp/flow06-classes.json
json_array_contains_id /tmp/flow06-classes.json items "$CLASS_ID" || fail "Class list did not include $CLASS_ID"
require_json_value /tmp/flow06-classes.json items.0.capabilities.transitions "active,cancelled"
detail_http="$(curl -sS -o /tmp/flow06-class-detail.json -w "%{http_code}" -H "$TUTOR_AUTH" "$API/classes/$CLASS_ID")"
cat /tmp/flow06-class-detail.json
echo
require_code "$detail_http" "200" "Tutor class detail" /tmp/flow06-class-detail.json
require_json_value /tmp/flow06-class-detail.json id "$CLASS_ID"
require_json_value /tmp/flow06-class-detail.json student.name "Minh Chau"
require_json_value /tmp/flow06-class-detail.json requested_teaching_mode online
require_json_value /tmp/flow06-class-detail.json capabilities.can_create_lesson_log false

echo "== Flow 6 Step 2d: actor matrix and ownership fail closed =="
parent_pause_http="$(curl -sS -o /tmp/flow06-parent-pause.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/transition" -H "Content-Type: application/json" -H "$PARENT_AUTH" \
  --data '{"to":"paused","expected_version":0}')"
require_code "$parent_pause_http" "409" "Parent cannot pause class" /tmp/flow06-parent-pause.json
FOREIGN_USER_ID="01KXFOREIGNUSER00000000000"
FOREIGN_TUTOR_ID="01KXFOREIGNTUTOR0000000000"
FOREIGN_CLASS_ID="01KXFOREIGNCLASS0000000000"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 \
  -c "insert into users (id, roles, status, updated_at) values ('$FOREIGN_USER_ID', ARRAY['tutor'], 'active', now()) on conflict (id) do update set roles=excluded.roles, status=excluded.status, updated_at=now();" \
  -c "insert into tutor_profiles (id, user_id, display_name, status, updated_at) values ('$FOREIGN_TUTOR_ID', '$FOREIGN_USER_ID', 'Foreign Tutor', 'published', now()) on conflict (id) do update set user_id=excluded.user_id, status=excluded.status, updated_at=now();" \
  -c "insert into class_contracts (id, tutor_profile_id, subject, status, updated_at) values ('$FOREIGN_CLASS_ID', '$FOREIGN_TUTOR_ID', 'math', 'active', now()) on conflict (id) do update set tutor_profile_id=excluded.tutor_profile_id, status=excluded.status, updated_at=now();" >/dev/null
foreign_http="$(curl -sS -o /tmp/flow06-foreign-class.json -w "%{http_code}" -H "$TUTOR_AUTH" "$API/classes/$FOREIGN_CLASS_ID")"
require_code "$foreign_http" "404" "Foreign class detail" /tmp/flow06-foreign-class.json

echo "== Flow 6 Step 2b: stale double accept returns current state =="
double_http="$(curl -sS -o /tmp/flow06-double-accept.json -w "%{http_code}" \
  -X POST "$API/trials/$TRIAL_ID/accept" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data "{\"expected_version\":$TRIAL_VERSION}")"
cat /tmp/flow06-double-accept.json
echo
require_code "$double_http" "409" "Stale double accept" /tmp/flow06-double-accept.json
require_json_value /tmp/flow06-double-accept.json details.trial.status accepted
require_json_value /tmp/flow06-double-accept.json details.trial.class_contract_id "$CLASS_ID"

echo "== Flow 6 Step 3: transition class to active =="
transition_http="$(curl -sS -o /tmp/flow06-transition-active.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/transition" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{
    "to": "active",
    "expected_version": 0
  }')"
cat /tmp/flow06-transition-active.json
echo
require_code "$transition_http" "201" "Transition class active" /tmp/flow06-transition-active.json
require_json_value /tmp/flow06-transition-active.json id "$CLASS_ID"
require_json_value /tmp/flow06-transition-active.json status active
require_json_value /tmp/flow06-transition-active.json capabilities.can_create_lesson_log true

echo "== Flow 6 Step 3b: stale transition returns current state =="
stale_class_http="$(curl -sS -o /tmp/flow06-stale-class.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/transition" -H "Content-Type: application/json" -H "$TUTOR_AUTH" \
  --data '{"to":"active","expected_version":0}')"
require_code "$stale_class_http" "409" "Stale class transition" /tmp/flow06-stale-class.json
require_json_value /tmp/flow06-stale-class.json details.class_contract.status active
require_json_value /tmp/flow06-stale-class.json details.class_contract.version 1

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
