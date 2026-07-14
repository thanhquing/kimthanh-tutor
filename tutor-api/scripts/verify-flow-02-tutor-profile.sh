#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PSQL_URL="${PSQL_URL:-postgresql://postgres:postgres@db:5432/tutor}"
PHONE="${PHONE:-091$(date +%H%M%S)}"

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

seed_legal_docs() {
  psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "update legal_documents set is_active = false where doc_type in ('terms','privacy'); insert into legal_documents (id, doc_type, version, locale, title, content_url, checksum, is_active, published_at) values ('01KXFLOWTERMS0000000000000','terms','2026-07-flow','vi-VN','Dieu khoan su dung','https://example.test/legal/terms-2026-07','dev-terms-checksum',true,now()), ('01KXFLOWPRIVACY00000000000','privacy','2026-07-flow','vi-VN','Chinh sach bao mat','https://example.test/legal/privacy-2026-07','dev-privacy-checksum',true,now()) on conflict (doc_type, version) do update set is_active = excluded.is_active, content_url = excluded.content_url, checksum = excluded.checksum, published_at = excluded.published_at;"
}

login_and_consent() {
  otp_http="$(curl -sS -o /tmp/flow02-otp-request.json -w "%{http_code}" \
    -X POST "$API/auth/otp/request" \
    -H "Content-Type: application/json" \
    --data "{\"channel\":\"sms\",\"destination\":\"$PHONE\"}")"
  require_code "$otp_http" "201" "OTP request" /tmp/flow02-otp-request.json
  request_id="$(json_get /tmp/flow02-otp-request.json request_id)"
  dev_code="$(json_get /tmp/flow02-otp-request.json dev_code)"

  verify_http="$(curl -sS -o /tmp/flow02-otp-verify.json -w "%{http_code}" \
    -X POST "$API/auth/otp/verify" \
    -H "Content-Type: application/json" \
    --data "{\"request_id\":\"$request_id\",\"code\":\"$dev_code\"}")"
  require_code "$verify_http" "201" "OTP verify" /tmp/flow02-otp-verify.json
  ACCESS_TOKEN="$(json_get /tmp/flow02-otp-verify.json access_token)"

  curl -sS -o /tmp/flow02-legal-docs.json "$API/legal/documents/active"
  terms_id="$(json_get /tmp/flow02-legal-docs.json terms.id)"
  privacy_id="$(json_get /tmp/flow02-legal-docs.json privacy.id)"

  consent_http="$(curl -sS -o /tmp/flow02-consent.json -w "%{http_code}" \
    -X POST "$API/legal/consents" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    --data "{\"terms_document_id\":\"$terms_id\",\"privacy_document_id\":\"$privacy_id\",\"scroll_reached_bottom\":true,\"consent_method\":\"scroll_and_click\"}")"
  require_code "$consent_http" "201" "Record consent" /tmp/flow02-consent.json
}

echo "== Flow 2 setup: seed legal docs + login active tutor candidate =="
seed_legal_docs
login_and_consent
AUTH="Authorization: Bearer $ACCESS_TOKEN"

echo "== Flow 2 Step 1: create tutor profile =="
profile_http="$(curl -sS -o /tmp/flow02-profile.json -w "%{http_code}" \
  -X POST "$API/tutors/me/profile" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  --data '{
    "display_name": "Co Linh",
    "bio": "Gia su Toan cap 2, uu tien nen tang co ban va thoi quen tu hoc.",
    "region": "Ha Noi",
    "voice_accent": "mien_bac",
    "gender": "female",
    "education_level": "university",
    "school_name": "Dai hoc Su pham Ha Noi",
    "student_year": 3,
    "exam_score": 27.5,
    "gpa": 3.4,
    "expected_fee_min": 180000,
    "expected_fee_max": 250000,
    "subjects": ["math"],
    "grade_levels": [6, 7, 8, 9],
    "teaching_modes": ["online", "offline"],
    "offline_areas": [
      { "province_code": "HN", "district_code": "CG" }
    ]
  }')"
cat /tmp/flow02-profile.json
echo
require_code "$profile_http" "201" "Create tutor profile" /tmp/flow02-profile.json
require_json_value /tmp/flow02-profile.json display_name "Co Linh"
require_json_value /tmp/flow02-profile.json status draft
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"

echo "== Flow 2 Step 2: add availability =="
availability_http="$(curl -sS -o /tmp/flow02-availability.json -w "%{http_code}" \
  -X POST "$API/tutors/me/availabilities" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  --data '{
    "day_of_week": 2,
    "start_time": "19:00",
    "end_time": "21:00",
    "type": "available",
    "note": "Day online hoac quanh Cau Giay"
  }')"
cat /tmp/flow02-availability.json
echo
require_code "$availability_http" "201" "Add availability" /tmp/flow02-availability.json
json_get /tmp/flow02-availability.json id >/dev/null

echo "== Flow 2 Step 3: add payout account =="
payout_http="$(curl -sS -o /tmp/flow02-payout.json -w "%{http_code}" \
  -X POST "$API/tutors/me/payout-accounts" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  --data '{
    "bank_code": "970436",
    "account_number": "1234567890",
    "account_holder": "NGUYEN THI LINH",
    "is_default": true
  }')"
cat /tmp/flow02-payout.json
echo
require_code "$payout_http" "201" "Add payout account" /tmp/flow02-payout.json
require_json_value /tmp/flow02-payout.json bank_code "970436"
require_json_value /tmp/flow02-payout.json account_number_masked "****7890"
require_json_value /tmp/flow02-payout.json account_holder "NGUYEN THI LINH"
require_json_value /tmp/flow02-payout.json is_default true

echo "== Flow 2 Step 4: publish tutor profile =="
publish_http="$(curl -sS -o /tmp/flow02-publish.json -w "%{http_code}" \
  -X POST "$API/tutors/me/profile/publish" \
  -H "$AUTH")"
cat /tmp/flow02-publish.json
echo
require_code "$publish_http" "201" "Publish tutor profile" /tmp/flow02-publish.json
require_json_value /tmp/flow02-publish.json status published

echo "OK: Flow 2 Tutor profile setup verified end-to-end for tutor_profile_id $TUTOR_PROFILE_ID"
