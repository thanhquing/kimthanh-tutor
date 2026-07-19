#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PHONE="${PHONE:-092$(date +%H%M%S)}"
GUEST_PHONE="${GUEST_PHONE:-091$(date +%H%M%S)}"
GUEST_EMAIL="${GUEST_EMAIL:-minh+$GUEST_PHONE@example.com}"

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

echo "== Flow 4 setup: create and publish tutor via Flow 2 =="
PHONE="$PHONE" sh /app/tutor-api/scripts/verify-flow-02-tutor-profile.sh
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"
TUTOR_TOKEN="$(json_get /tmp/flow02-otp-verify.json access_token)"
TUTOR_AUTH="Authorization: Bearer $TUTOR_TOKEN"

echo "== Flow 4 Step 1: guest submits trial request =="
trial_http="$(curl -sS -o /tmp/flow04-trial.json -w "%{http_code}" \
  -X POST "$API/trials" \
  -H "Content-Type: application/json" \
  --data "{
    \"tutor_profile_id\": \"$TUTOR_PROFILE_ID\",
    \"subject\": \"math\",
    \"grade\": \"9\",
    \"learning_goal\": \"Lay lai goc dai so va on thi vao 10\",
    \"teaching_mode\": \"online\",
    \"preferred_schedule\": \"Thu 3, Thu 5 sau 19:00\",
    \"message\": \"Muon hoc thu 1 buoi truoc khi chot lich dai han.\",
    \"contact_name\": \"Anh Minh\",
    \"contact_phone\": \"$GUEST_PHONE\",
    \"contact_email\": \"$GUEST_EMAIL\"
  }")"
cat /tmp/flow04-trial.json
echo
require_code "$trial_http" "201" "Create guest trial" /tmp/flow04-trial.json
require_json_value /tmp/flow04-trial.json status pending
require_json_value /tmp/flow04-trial.json tutor_profile_id "$TUTOR_PROFILE_ID"
TRIAL_ID="$(json_get /tmp/flow04-trial.json id)"
json_get /tmp/flow04-trial.json lead_id >/dev/null

echo "== Flow 4 Step 2: tutor accepts trial =="
accept_http="$(curl -sS -o /tmp/flow04-accept.json -w "%{http_code}" \
  -X POST "$API/trials/$TRIAL_ID/accept" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data '{"expected_version":0}')"
cat /tmp/flow04-accept.json
echo
require_code "$accept_http" "201" "Accept guest trial" /tmp/flow04-accept.json
require_json_value /tmp/flow04-accept.json trial.id "$TRIAL_ID"
require_json_value /tmp/flow04-accept.json trial.status accepted
require_json_value /tmp/flow04-accept.json trial.activation.state link_created
require_json_value /tmp/flow04-accept.json class_contract.status trial_accepted
CLASS_ID="$(json_get /tmp/flow04-accept.json class_contract.id)"
ACTIVATION_TOKEN="$(json_get /tmp/flow04-accept.json activation_token)"
[ "$ACTIVATION_TOKEN" != "null" ] || fail "Guest lead accept must return a one-time activation_token"

echo "== Flow 4 Step 3: guest completes activation link =="
activation_http="$(curl -sS -o /tmp/flow04-activation.json -w "%{http_code}" \
  -X POST "$API/activation/complete" \
  -H "Content-Type: application/json" \
  --data "{
    \"activation_token\": \"$ACTIVATION_TOKEN\"
  }")"
cat /tmp/flow04-activation.json
echo
require_code "$activation_http" "201" "Complete guest activation" /tmp/flow04-activation.json
require_json_value /tmp/flow04-activation.json user.phone "$GUEST_PHONE"
require_json_value /tmp/flow04-activation.json user.status pending_consent
require_json_value /tmp/flow04-activation.json class_contract.id "$CLASS_ID"
require_json_value /tmp/flow04-activation.json class_contract.status trial_accepted
require_json_value /tmp/flow04-activation.json consent_required true

echo "OK: Flow 4 Guest trial + activation verified end-to-end for trial_id $TRIAL_ID class_id $CLASS_ID"
