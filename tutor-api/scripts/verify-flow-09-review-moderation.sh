#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PSQL_URL="${PSQL_URL:-postgresql://postgres:postgres@db:5432/tutor}"
TUTOR_PHONE="${TUTOR_PHONE:-0912$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-0913$(date +%H%M%S)}"
ADMIN_PHONE="${ADMIN_PHONE:-0914$(date +%H%M%S)}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

json_get() {
  file="$1"
  path="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (cur === undefined) process.exit(2); if (cur === null) { process.stdout.write('null'); process.exit(0); } process.stdout.write(String(cur));" "$file" "$path"
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

echo "== Flow 9 setup: active class + lesson log via Flow 6 =="
TUTOR_PHONE="$TUTOR_PHONE" PARENT_PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-06-tutor-inbox-lesson-log.sh
TUTOR_TOKEN="$(json_get /tmp/flow02-otp-verify.json access_token)"
PARENT_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
TUTOR_AUTH="Authorization: Bearer $TUTOR_TOKEN"
PARENT_AUTH="Authorization: Bearer $PARENT_TOKEN"
CLASS_ID="$(json_get /tmp/flow06-transition-active.json id)"

echo "== Flow 9 setup: login active admin candidate and grant admin role =="
PHONE="$ADMIN_PHONE" sh /app/tutor-api/scripts/verify-flow-01-auth-consent.sh
ADMIN_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
ADMIN_USER_ID="$(json_get /tmp/flow01-otp-verify.json user.id)"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "update users set roles = ARRAY['admin'] where id = '$ADMIN_USER_ID';"
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

echo "== Flow 9 Step 1: tutor transitions class to completed_pending_review =="
complete_http="$(curl -sS -o /tmp/flow09-class-complete-pending.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/transition" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{
    "to": "completed_pending_review"
  }')"
cat /tmp/flow09-class-complete-pending.json
echo
require_code "$complete_http" "201" "Transition class completed_pending_review" /tmp/flow09-class-complete-pending.json
require_json_value /tmp/flow09-class-complete-pending.json id "$CLASS_ID"
require_json_value /tmp/flow09-class-complete-pending.json status completed_pending_review

echo "== Flow 9 Step 2: parent views review capability =="
capability_http="$(curl -sS -o /tmp/flow09-review-capability.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/classes/$CLASS_ID/review")"
cat /tmp/flow09-review-capability.json
echo
require_code "$capability_http" "200" "Review capability" /tmp/flow09-review-capability.json
require_json_value /tmp/flow09-review-capability.json class_id "$CLASS_ID"
require_json_value /tmp/flow09-review-capability.json review null
require_json_value /tmp/flow09-review-capability.json can_create true

echo "== Flow 9 Step 3: parent creates review =="
review_http="$(curl -sS -o /tmp/flow09-review.json -w "%{http_code}" \
  -X POST "$API/classes/$CLASS_ID/review" \
  -H "Content-Type: application/json" \
  -H "$PARENT_AUTH" \
  --data '{
    "rating": 5,
    "comment": "Co Linh day rat de hieu, con tu tin hon sau 4 buoi."
  }')"
cat /tmp/flow09-review.json
echo
require_code "$review_http" "201" "Create review" /tmp/flow09-review.json
require_json_value /tmp/flow09-review.json class_contract_id "$CLASS_ID"
require_json_value /tmp/flow09-review.json rating 5
require_json_value /tmp/flow09-review.json status published
REVIEW_ID="$(json_get /tmp/flow09-review.json id)"

echo "== Flow 9 Step 4: tutor reports review =="
report_http="$(curl -sS -o /tmp/flow09-review-report.json -w "%{http_code}" \
  -X POST "$API/reviews/$REVIEW_ID/report" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{
    "reason": "Noi dung co thong tin lien he ngoai nen can admin xem lai."
  }')"
cat /tmp/flow09-review-report.json
echo
require_code "$report_http" "201" "Report review" /tmp/flow09-review-report.json
require_json_value /tmp/flow09-review-report.json status disputed

echo "== Flow 9 Step 5: admin hides disputed review =="
moderate_http="$(curl -sS -o /tmp/flow09-review-moderate.json -w "%{http_code}" \
  -X POST "$API/admin/reviews/$REVIEW_ID/moderate" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "action": "hide"
  }')"
cat /tmp/flow09-review-moderate.json
echo
require_code "$moderate_http" "201" "Admin moderate review" /tmp/flow09-review-moderate.json
require_json_value /tmp/flow09-review-moderate.json id "$REVIEW_ID"
require_json_value /tmp/flow09-review-moderate.json status hidden

echo "OK: Flow 9 Review + moderation verified end-to-end for class_id $CLASS_ID review_id $REVIEW_ID"
