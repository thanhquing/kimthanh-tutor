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
  EMAIL="${EMAIL:-e2e-${PHONE}@gmail.com}"
  PASSWORD="${PASSWORD:-flow-pass-12345}"

  reg_http="$(curl -sS -o /tmp/flow02-register.json -w "%{http_code}" \
    -X POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
  require_code "$reg_http" "201" "Register" /tmp/flow02-register.json
  verify_link="$(json_get /tmp/flow02-register.json dev_verification_link)"
  verify_token="$(printf '%s' "$verify_link" | sed -n 's/.*token=\([^&]*\).*/\1/p')"
  curl -sS -o /tmp/flow02-verify.json -X POST "$API/auth/email/verify" \
    -H "Content-Type: application/json" \
    --data "{\"token\":\"$verify_token\"}" >/dev/null

  login_http="$(curl -sS -o /tmp/flow02-otp-verify.json -w "%{http_code}" \
    -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    --data "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"
  require_code "$login_http" "201" "Login" /tmp/flow02-otp-verify.json
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

echo "== Flow 2 Step 1b: reload own profile (GET matches POST shape) =="
me_http="$(curl -sS -o /tmp/flow02-me-profile.json -w "%{http_code}" \
  "$API/tutors/me/profile" -H "$AUTH")"
require_code "$me_http" "200" "Get own tutor profile" /tmp/flow02-me-profile.json
require_json_value /tmp/flow02-me-profile.json display_name "Co Linh"
require_json_value /tmp/flow02-me-profile.json subjects.0 "math"

echo "== Flow 2 Step 1c: negative — impossible fee range rejected (validation) =="
badfee_http="$(curl -sS -o /tmp/flow02-badfee.json -w "%{http_code}" \
  -X PATCH "$API/tutors/me/profile" \
  -H "Content-Type: application/json" -H "$AUTH" \
  --data '{ "expected_fee_min": 400000, "expected_fee_max": 100000 }')"
require_code "$badfee_http" "400" "Reject impossible fee range" /tmp/flow02-badfee.json
require_json_value /tmp/flow02-badfee.json code "VALIDATION_ERROR"

echo "== Flow 2 Step 1d: request signed avatar upload URL =="
media_http="$(curl -sS -o /tmp/flow02-media.json -w "%{http_code}" \
  -X POST "$API/media/upload-url" \
  -H "Content-Type: application/json" -H "$AUTH" \
  --data '{ "kind": "avatar", "content_type": "image/png", "size": 20480 }')"
cat /tmp/flow02-media.json
echo
require_code "$media_http" "201" "Create media upload URL" /tmp/flow02-media.json
MEDIA_ID="$(json_get /tmp/flow02-media.json media_id)"
json_get /tmp/flow02-media.json upload_url >/dev/null

echo "== Flow 2 Step 1e: read owner media status (pending scan/moderation) =="
mstatus_http="$(curl -sS -o /tmp/flow02-media-status.json -w "%{http_code}" \
  "$API/media/$MEDIA_ID" -H "$AUTH")"
cat /tmp/flow02-media-status.json
echo
require_code "$mstatus_http" "200" "Get media status" /tmp/flow02-media-status.json
require_json_value /tmp/flow02-media-status.json kind "avatar"
require_json_value /tmp/flow02-media-status.json scan_status "pending"
require_json_value /tmp/flow02-media-status.json moderation_status "pending"

echo "== Flow 2 Step 1f: negative — foreign/unknown media fails closed (404) =="
foreign_http="$(curl -sS -o /tmp/flow02-media-foreign.json -w "%{http_code}" \
  "$API/media/01KXNOTMYMEDIA000000000000" -H "$AUTH")"
require_code "$foreign_http" "404" "Media ownership fail-closed" /tmp/flow02-media-foreign.json
require_json_value /tmp/flow02-media-foreign.json code "RESOURCE_NOT_FOUND"

echo "== Flow 2 Step 1g: attach avatar to profile =="
attach_http="$(curl -sS -o /tmp/flow02-attach.json -w "%{http_code}" \
  -X PATCH "$API/tutors/me/profile" \
  -H "Content-Type: application/json" -H "$AUTH" \
  --data "{ \"avatar_media_id\": \"$MEDIA_ID\" }")"
require_code "$attach_http" "200" "Attach avatar media" /tmp/flow02-attach.json
require_json_value /tmp/flow02-attach.json avatar_media_id "$MEDIA_ID"

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
AVAIL_ID="$(json_get /tmp/flow02-availability.json id)"

echo "== Flow 2 Step 2b: negative — availability with end before start rejected (validation) =="
bad_avail_http="$(curl -sS -o /tmp/flow02-availability-bad.json -w "%{http_code}" \
  -X POST "$API/tutors/me/availabilities" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  --data '{"day_of_week":2,"start_time":"21:00","end_time":"19:00","type":"available"}')"
cat /tmp/flow02-availability-bad.json
echo
[ "$bad_avail_http" = "400" ] || [ "$bad_avail_http" = "422" ] || {
  cat /tmp/flow02-availability-bad.json >&2
  fail "Invalid availability expected HTTP 400/422, got $bad_avail_http"
}

echo "== Flow 2 Step 2c: negative — delete unknown/foreign availability fails closed (404) =="
foreign_del_http="$(curl -sS -o /tmp/flow02-availability-foreign.json -w "%{http_code}" \
  -X DELETE "$API/tutors/me/availabilities/01KXFOREIGNAVAIL0000000000" \
  -H "$AUTH")"
require_code "$foreign_del_http" "404" "Delete foreign availability" /tmp/flow02-availability-foreign.json

echo "== Flow 2 Step 2d: delete own availability succeeds =="
del_http="$(curl -sS -o /tmp/flow02-availability-del.json -w "%{http_code}" \
  -X DELETE "$API/tutors/me/availabilities/$AVAIL_ID" \
  -H "$AUTH")"
require_code "$del_http" "200" "Delete own availability" /tmp/flow02-availability-del.json
require_json_value /tmp/flow02-availability-del.json ok true
# Re-add so downstream steps keep a valid weekly availability on the profile.
curl -sS -o /dev/null -X POST "$API/tutors/me/availabilities" \
  -H "Content-Type: application/json" -H "$AUTH" \
  --data '{"day_of_week":2,"start_time":"19:00","end_time":"21:00","type":"available","note":"Day online hoac quanh Cau Giay"}'

echo "== Flow 2 Step 3a: load configured payout-bank catalog =="
banks_http="$(curl -sS -o /tmp/flow02-payout-banks.json -w "%{http_code}" \
  "$API/tutors/me/payout-accounts/banks" \
  -H "$AUTH")"
require_code "$banks_http" "200" "List payout banks" /tmp/flow02-payout-banks.json
require_json_value /tmp/flow02-payout-banks.json items.0.bank_code "970436"

echo "== Flow 2 Step 3b: add payout account =="
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
